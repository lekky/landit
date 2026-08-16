import type { DayKey } from '../types';
import { isDayKey } from './time';

/**
 * The guardian-consent rules: who needs consent, when it lapses, and what an
 * account may do while it is waiting (plan §6.2 and §6.3).
 *
 * Three things about this module are load-bearing.
 *
 * **The decision is made from the age *band*, never from a date of birth.** The
 * browser collects a date of birth, computes a band with `declareAge`, sends the
 * band and discards the date (plan §3). Nothing downstream — not the server, not
 * this module — ever sees it again. That is why every function below that
 * decides anything takes an `AgeBand`: if the decision needed the date, the
 * server would need the date, and the whole point of storing a band is that it
 * does not.
 *
 * **The consequence is that a threshold of 14 or 15 rounds up to 16.** The band
 * `13_15` cannot tell a 13 year old from a 15 year old, so a country that sets
 * its threshold at 14 gets consent asked of every rider in that band. That is
 * the fail-safe direction §6.3 asks for — the table "only ever lowers", and this
 * is what stops a lowered entry from *under*-protecting the youngest riders in
 * the band. It is a real cost, and it is written down here rather than
 * discovered: see `consentAge`.
 *
 * **The client renders the gate; `pocketbase/hooks/` enforces it** (§3 guarantee
 * 4). Nothing here is a security boundary. `canWhileConsentLimited` is the list
 * the UI reads to know what to grey out; the collection rules and hooks are what
 * make the refusal real, and the two are deliberately separate implementations.
 */

/* ------------------------------------------------------------------ bands -- */

/** How age is stored: a band, never a birth date (plan §3). */
export type AgeBand = 'under_13' | '13_15' | '16_17' | 'adult';

/** In order, youngest first. */
export const AGE_BANDS = [
  'under_13',
  '13_15',
  '16_17',
  'adult',
] as const satisfies readonly AgeBand[];

/**
 * The age at which a rider leaves each band. `adult` is the last one, so nobody
 * leaves it and it has no boundary.
 */
const BAND_ENDS_AT: Readonly<Record<AgeBand, number | null>> = {
  under_13: 13,
  '13_15': 16,
  '16_17': 18,
  adult: null,
};

const NEXT_BAND: Readonly<Record<AgeBand, AgeBand | null>> = {
  under_13: '13_15',
  '13_15': '16_17',
  '16_17': 'adult',
  adult: null,
};

/** `users.consent_state` (plan §3). Written only by the consent flow. */
export type ConsentState = 'not_required' | 'pending' | 'granted' | 'revoked';

/** The states that hold an account behind the gate. */
export const CONSENT_LIMITED_STATES = [
  'pending',
  'revoked',
] as const satisfies readonly ConsentState[];

/** Is this account held behind the guardian gate? */
export function isConsentLimited(state: ConsentState | string | null | undefined): boolean {
  return state === 'pending' || state === 'revoked';
}

/* -------------------------------------------------------------- thresholds -- */

/** The threshold everywhere the table does not say otherwise (plan §6.3). */
export const DEFAULT_CONSENT_AGE = 13;

/** The EEA default. Member states may lower it; none may raise it. */
export const EEA_CONSENT_AGE = 16;

/**
 * The EEA, as ISO-3166-1 alpha-2: the EU 27 plus Iceland, Liechtenstein and
 * Norway. The UK is deliberately not here — it left, and its threshold is 13.
 */
export const EEA_COUNTRIES = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IS',
  'IT',
  'LI',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'NO',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
  'ES',
] as const;

/**
 * Per-country entries that **lower** the EEA default, each with a cited source.
 *
 * **Deliberately empty.** Member states may set anything from 13 to 16 and many
 * have, but §6.3 admits an entry only with a citation, and "needs counsel:
 * confirm the EEA table's values" is still open. An unmaintained table has to
 * fail safe, and empty is the safest it gets: every EEA rider under 16 is asked
 * for consent until somebody with a source says otherwise.
 *
 * When counsel fills this in, note the rounding above: an entry of 14 or 15 is
 * honoured as 16 in practice, because the stored band cannot resolve it. An
 * entry of 13 works exactly.
 */
export const EEA_LOWERED_CONSENT_AGES: Readonly<Record<string, number>> = {};

/** Countries that decline an under-13 sign-up outright rather than consent it (§6.3). */
export const UNDER_13_DECLINED_COUNTRIES = ['US'] as const;

/**
 * A rider's country as a bare alpha-2 code.
 *
 * `users.country` holds ISO-3166-**2** (`GB`, or `GB-ENG` where a sign-up form
 * offered a subdivision), and the threshold is a national question either way.
 */
export function countryOf(country: string): string {
  return String(country ?? '')
    .trim()
    .toUpperCase()
    .slice(0, 2);
}

/**
 * The age at which a rider in this country can consent for themselves.
 *
 * UK 13, EEA 16 unless explicitly lowered, everywhere else 13 — all three
 * fail-safe in the same direction, so an unknown or malformed country gets the
 * default rather than an exemption.
 */
export function consentAge(
  country: string,
  lowered: Readonly<Record<string, number>> = EEA_LOWERED_CONSENT_AGES,
): number {
  const code = countryOf(country);
  const entry = lowered[code];
  // Clamped, not trusted: the table's job is to lower the default. An entry
  // above it is a data error, and honouring one would quietly raise a threshold
  // in a table documented as never doing that.
  if (entry !== undefined) return Math.min(entry, EEA_CONSENT_AGE);
  return (EEA_COUNTRIES as readonly string[]).includes(code)
    ? EEA_CONSENT_AGE
    : DEFAULT_CONSENT_AGE;
}

/* ---------------------------------------------------------- age from a DOB -- */

/**
 * The date a rider born on `dateOfBirth` reaches `age`.
 *
 * 29 February has no anniversary in most years; a rider born on one reaches
 * their birthday on 1 March, which is the direction that never lets somebody
 * out of the gate a day early.
 */
export function birthdayOn(dateOfBirth: DayKey, age: number): DayKey {
  assertDay(dateOfBirth, 'date of birth');
  const year = Number(dateOfBirth.slice(0, 4)) + age;
  const month = Number(dateOfBirth.slice(5, 7));
  const day = Number(dateOfBirth.slice(8, 10));
  const stamp = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC rolls 29 Feb into 1 March by itself. Reading the result back rather
  // than trusting the inputs is what makes that visible instead of accidental.
  return stamp.toISOString().slice(0, 10);
}

/** Whole years from `dateOfBirth` to `on`. */
export function ageOn(dateOfBirth: DayKey, on: DayKey): number {
  assertDay(dateOfBirth, 'date of birth');
  assertDay(on, 'day');
  let age = Number(on.slice(0, 4)) - Number(dateOfBirth.slice(0, 4));
  if (on < birthdayOn(dateOfBirth, age)) age -= 1;
  return age;
}

/** What the browser computes at sign-up, and all it may send. */
export interface AgeDeclaration {
  readonly band: AgeBand;
  /** The day the rider leaves this band. `null` on `adult`, which nobody leaves. */
  readonly bandNextChangeOn: DayKey | null;
}

/**
 * Turn a date of birth into the band and the boundary date.
 *
 * **This is the only function in the product that takes a date of birth**, it
 * runs in the browser, and its input is discarded the moment it returns
 * (plan §3, §6.2). Both outputs are safe to store: the band is coarse, and the
 * boundary is what makes the transition automatic without a job scanning birth
 * dates.
 */
export function declareAge(dateOfBirth: DayKey, today: DayKey): AgeDeclaration {
  const age = ageOn(dateOfBirth, today);
  const band = bandForAge(age);
  const endsAt = BAND_ENDS_AT[band];
  return { band, bandNextChangeOn: endsAt === null ? null : birthdayOn(dateOfBirth, endsAt) };
}

/** The band an age falls in. */
export function bandForAge(age: number): AgeBand {
  if (age < 13) return 'under_13';
  if (age < 16) return '13_15';
  if (age < 18) return '16_17';
  return 'adult';
}

/**
 * Move a rider on if their boundary has passed — the whole of "consent lapses
 * on the 13th birthday without anyone doing anything" (§6.2).
 *
 * It needs no date of birth: the boundaries are three years apart (13 → 16) and
 * then two (16 → 18), so the next one is arithmetic on the last. Loops, because
 * an account can sit dormant for years and come back several boundaries late.
 */
export function advanceBand(declaration: AgeDeclaration, today: DayKey): AgeDeclaration {
  let { band, bandNextChangeOn } = declaration;

  while (bandNextChangeOn !== null && bandNextChangeOn <= today) {
    const next = NEXT_BAND[band];
    if (next === null) return { band, bandNextChangeOn: null };
    const endsAt = BAND_ENDS_AT[next];
    const leaving = BAND_ENDS_AT[band];
    band = next;
    bandNextChangeOn =
      endsAt === null || leaving === null ? null : addYears(bandNextChangeOn, endsAt - leaving);
  }

  return { band, bandNextChangeOn };
}

/* ------------------------------------------------------ the sign-up decision -- */

/**
 * What happens when this rider presses "create account".
 *
 * - `open` — an ordinary account, `consent_state` of `not_required`.
 * - `consent_required` — the account is created and held at `pending` until a
 *   guardian approves it.
 * - `declined` — no account is created. US under-13 only, and deliberately:
 *   COPPA wants verifiable parental consent, which is a different and much
 *   heavier mechanism than an approval email, and we are not building it at
 *   launch (§6.3). A plain explanation is owed, not a generic error.
 */
export type SignupOutcome = 'open' | 'consent_required' | 'declined';

export function signupOutcome(country: string, band: AgeBand): SignupOutcome {
  if (
    band === 'under_13' &&
    (UNDER_13_DECLINED_COUNTRIES as readonly string[]).includes(countryOf(country))
  ) {
    return 'declined';
  }
  return consentRequired(country, band) ? 'consent_required' : 'open';
}

/**
 * Does a rider in this band, in this country, need a guardian?
 *
 * Band-granular on purpose — see the module note. `13_15` needs consent wherever
 * the threshold is above 13, which is every EEA country until counsel lowers
 * one to exactly 13.
 */
export function consentRequired(country: string, band: AgeBand): boolean {
  const threshold = consentAge(country);
  if (band === 'under_13') return threshold > 12;
  if (band === '13_15') return threshold > 13;
  if (band === '16_17') return threshold > 16;
  return false;
}

/** The state a fresh account starts in. Never `granted`: only a guardian grants. */
export function initialConsentState(country: string, band: AgeBand): ConsentState {
  return consentRequired(country, band) ? 'pending' : 'not_required';
}

/**
 * The day this rider stops needing a guardian, or `null` if they never did.
 *
 * Derived rather than stored, and it can be: consent is owed for whole bands, so
 * the day it stops being owed is always the day a band ends. With a threshold of
 * 13 that is the 13th birthday, which `bandNextChangeOn` already holds; with
 * anything above it, the 16th — three years later for a rider still in
 * `under_13`, and `bandNextChangeOn` itself once they are in `13_15`.
 *
 * A stored `consent_lapses_on` field was the first design here and would have
 * been a second source of truth for a value this already answers exactly.
 */
export function consentLapsesOn(country: string, declaration: AgeDeclaration): DayKey | null {
  if (!consentRequired(country, declaration.band)) return null;
  const { band, bandNextChangeOn } = declaration;
  if (bandNextChangeOn === null) return null;
  if (band === '13_15') return bandNextChangeOn;
  if (band === 'under_13') {
    return consentAge(country) <= 13 ? bandNextChangeOn : addYears(bandNextChangeOn, 3);
  }
  return bandNextChangeOn;
}

/**
 * The whole "has anything changed while they were away" question, in one call:
 * advance the band if a boundary has passed, then say what consent state that
 * leaves the account in.
 *
 * `granted` and `revoked` are a guardian's decisions and are never *taken away*
 * here — a lapsed band clears a `pending`, and leaves a live grant alone until
 * it stops applying. Revocation persists until the rider ages out.
 */
export function refreshConsent(input: {
  readonly country: string;
  readonly declaration: AgeDeclaration;
  readonly state: ConsentState;
  readonly today: DayKey;
}): { readonly declaration: AgeDeclaration; readonly state: ConsentState } {
  const declaration = advanceBand(input.declaration, input.today);
  const stillNeeded = consentRequired(input.country, declaration.band);
  return { declaration, state: stillNeeded ? input.state : 'not_required' };
}

/* -------------------------------------------------- what a pending account can do -- */

/**
 * The things an account either can or cannot do, named so the allow list and the
 * deny list are the same vocabulary the plan uses (§6.2).
 */
export type RiderCapability =
  | 'sign_in'
  | 'browse_library'
  | 'log_trick'
  | 'write_notes'
  | 'build_streak'
  | 'see_own_progress'
  | 'edit_own_profile'
  | 'be_visible_to_riders'
  | 'appear_on_crew_board'
  | 'join_or_create_crew'
  | 'receive_crew_invite'
  | 'submit_spot'
  | 'attend_event'
  | 'upload_clip'
  | 'hold_subscription';

/** Everything that touches only the rider's own data (§6.2). */
export const CONSENT_LIMITED_ALLOWS = [
  'sign_in',
  'browse_library',
  'log_trick',
  'write_notes',
  'build_streak',
  'see_own_progress',
  'edit_own_profile',
] as const satisfies readonly RiderCapability[];

/**
 * Everything that would make the rider visible, reachable or billable.
 *
 * This list is the client's copy. The enforced copy is the collection rules and
 * hooks (§3 guarantee 4), which is what a rider actually runs into — a client
 * gate protects nobody, and this one is a promise made to a parent.
 */
export const CONSENT_LIMITED_DENIES = [
  'be_visible_to_riders',
  'appear_on_crew_board',
  'join_or_create_crew',
  'receive_crew_invite',
  'submit_spot',
  'attend_event',
  'upload_clip',
  'hold_subscription',
] as const satisfies readonly RiderCapability[];

/** May an account held behind the gate do this? */
export function canWhileConsentLimited(capability: RiderCapability): boolean {
  return (CONSENT_LIMITED_ALLOWS as readonly RiderCapability[]).includes(capability);
}

/** May an account in this consent state do this? */
export function canWithConsent(state: ConsentState, capability: RiderCapability): boolean {
  return isConsentLimited(state) ? canWhileConsentLimited(capability) : true;
}

/* --------------------------------------------------------------- the email -- */

/**
 * How long an approval link lives.
 *
 * A week, not a day: the rider is held at `pending` the whole time and a parent
 * who reads their email at the weekend should not have to ask for a second link.
 * A fresh link can always be requested, and the revocation link — a different
 * link, in the same email — never expires at all (§6.2).
 */
export const CONSENT_APPROVAL_WINDOW_DAYS = 7;

/** Has this approval link run out? */
export function approvalExpired(expires: DayKey | string | null | undefined, now: Date): boolean {
  if (!expires) return true;
  const at = new Date(expires);
  return Number.isNaN(at.getTime()) || at.getTime() <= now.getTime();
}

/* ------------------------------------------------------------------ helpers -- */

function assertDay(value: unknown, what: string): asserts value is DayKey {
  if (!isDayKey(value)) throw new RangeError(`Not a ${what}: ${String(value)}`);
}

function addYears(day: DayKey, years: number): DayKey {
  return birthdayOn(day, years);
}
