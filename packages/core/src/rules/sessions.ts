/**
 * Sessions — a logged ride at a spot (T36). The rules, as pure functions.
 *
 * A session records **where and when** a rider rode, for how long, how it felt
 * and which tricks they worked on. Six owner's decisions govern it (Rachid,
 * 2026-09-13, in chat; plan §1 D1–D6), and this file is where each one is
 * *defined*. Where one is also *enforced*, the comment says where:
 *
 * - **D1 — a session stores a place and a time.** Amends plan §6.4 standard 10
 *   for sessions only. The "I rode today" tap stays location-free, and no
 *   analytics event carries a spot, an event, a time or a duration.
 * - **D2 — visibility is Public / Crew / Only me**, the profile privacy ids
 *   reused, default `private`. `sessionVisibleTo` is the definition; the
 *   `sessions` view rule in `1789603200_sessions.js` is the boundary.
 *   **This is a deliberate divergence from `video.ts`'s "no public", and it
 *   covers session clips only.** A trick video link still has no public state;
 *   nothing in that file moved.
 * - **D3 — "rode with" is crew-mates only**, refused otherwise in
 *   `66_sessions.pb.js`, and stripped from what a viewer is sent unless they
 *   could see that rider's own profile (the same file's enrich hook).
 * - **D4 — clips are YouTube, Instagram or TikTok links.** `clip-links.ts`.
 * - **D5 — session clips have their own allowance.** `sessionClipAllowance`.
 * - **D6 — Rookie logs four sessions a calendar month**, warned at three, with
 *   a one-off grace. **The ride and the streak always save**, even when the
 *   session is refused: `logSession` in `@landit/db` marks the ride before it
 *   asks for the session. Achievements are never for sale.
 *
 * And one rule that is not a decision so much as a promise the design makes:
 * **a stage move is one-way.** A landed trick entry promotes that trick's stage
 * once; editing or deleting the session never demotes it.
 *
 * No `URL`, no `Intl` outside `toDayKey`, no DOM. Several functions here are
 * transcribed for the hook into `pocketbase/hooks/lib/session_rules.js`, and
 * the ones that are say so.
 */

import {
  DEFAULT_SESSION_VISIBILITY,
  SESSION_DURATIONS,
  SESSION_DURATION_MINUTES,
  SESSION_FEELS,
  SESSION_FEEL_IDS,
  SESSION_LIMITS,
  SESSION_VISIBILITIES,
  SESSION_WEATHER,
  SESSION_WEATHER_IDS,
} from '../data/sessions';
import { SPORT_IDS } from '../data/sports';
import { STAGE, STAGE_IDS } from '../data/stages';
import type {
  DayKey,
  Instant,
  Plan,
  PrivacyId,
  RideSession,
  SessionAllowance,
  SessionDurationMinutes,
  SessionFeelId,
  SessionTrickEntry,
  SessionVisibilityId,
  SessionWeatherId,
  SportId,
  StageId,
} from '../types';
import { clipLinkProblem, CLIP_LINK_REFUSALS } from './clip-links';
import { riderToday, WEEKLY_RIDE_TARGET, type RiderClock } from './streak';
import { addDays, DEFAULT_TIMEZONE, MONTH_NAMES, toDayKey, weekStart } from './time';

/* ------------------------------------------------------------ visibility -- */

/**
 * Exactly `public`, `members` or `private`; anything else is `private`.
 *
 * Fail-closed, like `normaliseVideoVisibility`: an empty, misspelt or future
 * value is the most private state, never the least. Transcribed in the hook.
 */
export function normaliseSessionVisibility(raw: unknown): SessionVisibilityId {
  return raw === 'public' || raw === 'members' ? raw : 'private';
}

/** A profile privacy value read the same fail-closed way. */
function normalisePrivacy(raw: unknown): PrivacyId {
  return raw === 'public' || raw === 'members' ? raw : 'private';
}

/** "Public", "Crew", "Only me". */
export function sessionVisibilityLabel(visibility: unknown): string {
  const id = normaliseSessionVisibility(visibility);
  return SESSION_VISIBILITIES.find((v) => v.id === id)!.label;
}

/** Everything `sessionVisibleTo` needs, from whichever side has it. */
export interface SessionAudience {
  /** The session's own setting. */
  readonly visibility: unknown;
  readonly ownerId: string;
  /** The owner's profile privacy (`users.privacy`). */
  readonly ownerPrivacy: unknown;
  /** The owner is `pending` or `revoked` on the guardian-consent gate. */
  readonly ownerConsentLimited: boolean;
  readonly ownerSuspended: boolean;
  /** `null` for a signed-out visitor. */
  readonly viewerId: string | null;
  readonly viewerConsentLimited: boolean;
  /** The viewer and the owner are in at least one crew together. */
  readonly sharesCrew: boolean;
}

/**
 * Can this viewer see this session? **The stricter of the session and the
 * profile wins** (guarantee 1, as D2 applies it).
 *
 * | session ↓ / profile → | public | members | private |
 * | --- | --- | --- | --- |
 * | `public` | anyone, signed out too | signed-in riders | nobody |
 * | `members` (Crew) | signed-in crew-mates | signed-in crew-mates | nobody |
 * | `private` | nobody | nobody | nobody |
 *
 * "Nobody" always excepts the owner. A **consent-limited or suspended owner's
 * sessions reach nobody** whatever either setting says (guarantee 4, the same
 * as `event_attendance`), and a consent-limited viewer sees nobody's.
 *
 * This is the definition. The `sessions` list and view rules are the boundary,
 * and `pocketbase/tests/sessions.test.ts` runs this whole matrix against them.
 */
export function sessionVisibleTo(audience: SessionAudience): boolean {
  if (audience.viewerId !== null && audience.viewerId === audience.ownerId) return true;
  if (audience.ownerConsentLimited || audience.ownerSuspended) return false;

  const visibility = normaliseSessionVisibility(audience.visibility);
  const privacy = normalisePrivacy(audience.ownerPrivacy);
  if (visibility === 'private' || privacy === 'private') return false;

  if (audience.viewerId === null) {
    return visibility === 'public' && privacy === 'public';
  }
  if (audience.viewerConsentLimited) return false;
  if (visibility === 'public') return true;
  return audience.sharesCrew;
}

/** What `riderProfileVisibleTo` needs about one rider and one viewer. */
export interface ProfileAudience {
  readonly riderId: string;
  readonly riderPrivacy: unknown;
  readonly riderConsentLimited: boolean;
  readonly riderSuspended: boolean;
  readonly viewerId: string | null;
  readonly viewerConsentLimited: boolean;
}

/**
 * Could this viewer open this rider's profile? `users.viewRule`, restated.
 *
 * D3 uses it for "rode with": a tagged crew-mate is only ever named to a viewer
 * this returns `true` for. The enforcement is `canAccessRecord` against the
 * real `users` rule in the hook, not this copy — this one lets a screen or a
 * test reason about the same thing.
 */
export function riderProfileVisibleTo(audience: ProfileAudience): boolean {
  if (audience.viewerId !== null && audience.viewerId === audience.riderId) return true;
  if (audience.riderConsentLimited || audience.riderSuspended) return false;
  const privacy = normalisePrivacy(audience.riderPrivacy);
  if (audience.viewerId === null) return privacy === 'public';
  if (audience.viewerConsentLimited) return false;
  return privacy === 'public' || privacy === 'members';
}

/* ----------------------------------------------------------- the quota --- */

/**
 * Sessions Rookie logs in a calendar month. **The owner's number** (D6), not a
 * tunable default.
 */
export const ROOKIE_SESSIONS_PER_MONTH = 4;

/**
 * The session count at which the UI starts warning a Rookie rider — the third
 * of four, "one left this month". **The owner's number** (D6).
 *
 * `sessionQuotaStatus` expresses it as "one left", so a staff-tuned cap other
 * than four still warns on its last session rather than on its third.
 */
export const SESSION_QUOTA_WARN_AT = 3;

/** No sessions at all, and what every fail-closed path resolves to. */
export const NO_SESSIONS: SessionAllowance = { cap: 0, unlimited: false };

function allowanceOf(cap: unknown, unlimited: unknown): SessionAllowance {
  const n = typeof cap === 'number' && Number.isFinite(cap) ? Math.trunc(cap) : 0;
  return { cap: Math.max(0, n), unlimited: unlimited === true };
}

/**
 * The monthly session allowance a plan record grants — **`null` grants none**.
 *
 * A count and a boolean, not a number with a sentinel, for every reason
 * `videoLinkAllowance` gives. And the same fail-closed reading in the database:
 * a `plans` row nobody has updated reads `0` and `false`, which logs nothing.
 * The ride still saves (D6), so failing closed here costs a rider their notes,
 * never their streak.
 */
export function sessionAllowance(plan: Plan | null | undefined): SessionAllowance {
  if (!plan) return NO_SESSIONS;
  return allowanceOf(plan.sessionMonthCap, plan.sessionsUnlimited);
}

/** Where a rider stands against this month's allowance. */
export interface SessionQuotaStatus {
  /** Sessions logged this month. */
  readonly used: number;
  /** The cap, or `null` when the allowance is unlimited. */
  readonly cap: number | null;
  /** How many are left, or `null` when unlimited. */
  readonly remaining: number | null;
  /**
   * - `unlimited` — no cap applies.
   * - `open` — room, nothing to say.
   * - `warn` — the last one is left (the third of Rookie's four).
   * - `full` — the cap is reached; the next needs the grace or a plan.
   */
  readonly state: 'unlimited' | 'open' | 'warn' | 'full';
  /** A session can be saved without anything extra. */
  readonly canLog: boolean;
  /** The once-per-account grace has not been spent. */
  readonly graceAvailable: boolean;
  /** Full, and the grace would save this one. */
  readonly canLogWithGrace: boolean;
}

/**
 * The quota, resolved. `usedThisMonth` counts sessions **logged** in the
 * rider's current month (`sessions.month_key`), not sessions *dated* in it — a
 * session backfilled to last Tuesday still counts in the month it was written,
 * because counting by the date a rider types would make the cap a field they
 * could edit around. Recorded in plan §7, T36.
 */
export function sessionQuotaStatus(
  allowance: SessionAllowance,
  input: { usedThisMonth: number; graceUsed: boolean },
): SessionQuotaStatus {
  const used = Math.max(0, Math.trunc(input.usedThisMonth || 0));
  const graceAvailable = !input.graceUsed;
  if (allowance.unlimited) {
    return {
      used,
      cap: null,
      remaining: null,
      state: 'unlimited',
      canLog: true,
      graceAvailable,
      canLogWithGrace: false,
    };
  }
  const cap = allowance.cap;
  const remaining = Math.max(0, cap - used);
  const full = used >= cap;
  return {
    used,
    cap,
    remaining,
    state: full ? 'full' : remaining === 1 ? 'warn' : 'open',
    canLog: !full,
    graceAvailable,
    canLogWithGrace: full && graceAvailable,
  };
}

/**
 * What a create should do: save, save on the grace, or refuse.
 *
 * `wantsGrace` is the rider pressing "Save this one anyway". A rider with room
 * never spends the grace by asking for it — it is kept for the day it is
 * needed. Transcribed in the hook, where it is the boundary.
 */
export function sessionCreateDecision(
  status: SessionQuotaStatus,
  wantsGrace: boolean,
): 'allow' | 'grace' | 'refuse' {
  if (status.canLog) return 'allow';
  return wantsGrace && status.graceAvailable ? 'grace' : 'refuse';
}

/** One cell per session in the allowance, for the pips. Empty when unlimited. */
export function sessionQuotaPips(status: SessionQuotaStatus): ('used' | 'free')[] {
  if (status.cap === null) return [];
  return Array.from({ length: status.cap }, (_, i) => (i < status.used ? 'used' : 'free'));
}

const NUMBER_WORDS = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
];

function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The quota as the sidebar card and the wall say it: "One left this month",
 * "That is four this month", "Unlimited sessions". Gain-framed where it can be
 * (plan §6.4 standard 13): the count left, never a countdown to losing
 * anything.
 */
export function sessionQuotaLine(status: SessionQuotaStatus): string {
  if (status.cap === null) return 'Unlimited sessions';
  if (status.state === 'full') return `That is ${numberWord(status.cap)} this month`;
  return `${capitalise(numberWord(status.remaining ?? 0))} left this month`;
}

/**
 * A plan's monthly allowance for a plan card or the comparison table:
 * "Four a month", "Unlimited", "None". Rendered from the plan record so a card
 * cannot advertise a number the hook does not enforce.
 */
export function sessionsPerMonthLabel(allowance: SessionAllowance): string {
  if (allowance.unlimited) return 'Unlimited';
  if (allowance.cap === 0) return 'None';
  return `${capitalise(numberWord(allowance.cap))} a month`;
}

/* ----------------------------------------------------------- the month --- */

/** The rider's current month, `YYYY-MM`, on their own clock (like `riderToday`). */
export function riderMonthKey(clock: RiderClock = {}): string {
  return riderToday(clock).slice(0, 7);
}

/** The month an instant falls in, `YYYY-MM`, in a timezone. */
export function monthKeyOf(instant: Instant, timezone: string = DEFAULT_TIMEZONE): string {
  return toDayKey(instant, timezone).slice(0, 7);
}

/** The first day of the month after `monthKey`. */
export function nextMonthStart(monthKey: string): DayKey {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const next = new Date(Date.UTC(year, month, 1));
  return next.toISOString().slice(0, 10);
}

/** When the monthly count starts again: "1 October", and how many days away. */
export function sessionQuotaResets(clock: RiderClock = {}): {
  readonly on: DayKey;
  readonly label: string;
  readonly daysAway: number;
} {
  const today = riderToday(clock);
  const on = nextMonthStart(today.slice(0, 7));
  const daysAway = Math.round((Date.parse(on) - Date.parse(today)) / 86_400_000);
  return {
    on,
    label: `${Number(on.slice(8, 10))} ${MONTH_NAMES[Number(on.slice(5, 7)) - 1]}`,
    daysAway,
  };
}

/**
 * The furthest any timezone is from UTC, in hours: UTC−12 to UTC+14.
 *
 * The hook cannot compute a rider's month (goja has no `Intl`, LESSONS §5), so
 * the month key is computed in Node on the rider's clock and sent with the
 * write. The hook then checks it is a month **some** timezone is in right now.
 * That bounds what a lying client can do to choosing between two adjacent
 * months for a day around the turn — which spends the next month's allowance
 * early, never buys an extra session.
 */
export const MAX_UTC_OFFSET_HOURS = { behind: 12, ahead: 14 } as const;

/** The month keys that are "now" somewhere on Earth. Transcribed in the hook. */
export function plausibleMonthKeys(nowMs: number): string[] {
  const keys: string[] = [];
  for (const offset of [-MAX_UTC_OFFSET_HOURS.behind, 0, MAX_UTC_OFFSET_HOURS.ahead]) {
    const key = new Date(nowMs + offset * 3_600_000).toISOString().slice(0, 7);
    if (keys.indexOf(key) === -1) keys.push(key);
  }
  return keys;
}

/* ----------------------------------------------------------- clips ------- */

/**
 * How many **session clip links** Shredder holds. **A tunable default, not a
 * deliberated decision** — the same standing as `SHREDDER_VIDEO_LINK_CAP` and
 * `WEEKLY_RIDE_TARGET` (plan §1). Screenshots 1g and 2e give Shredder "Video
 * links, private until you say otherwise" with no number, so D5's fallback
 * applies: ten, matching the trick video link cap, so the two lines on a plan
 * card cannot read as a deliberate difference nobody decided. Rookie's zero
 * and Legend's unlimited are the owner's.
 */
export const SHREDDER_SESSION_CLIP_CAP = 10;

/** No session clips, and the fail-closed value. */
export const NO_SESSION_CLIPS: SessionAllowance = { cap: 0, unlimited: false };

/**
 * The session clip allowance a plan grants (D5) — separate from
 * `videoLinkAllowance`, and read from its own two plan fields. `null` grants
 * none. Enforced in `66_sessions.pb.js` at the model layer, no superuser bypass.
 */
export function sessionClipAllowance(plan: Plan | null | undefined): SessionAllowance {
  if (!plan) return NO_SESSION_CLIPS;
  return allowanceOf(plan.sessionClipCap, plan.sessionClipsUnlimited);
}

/** May a rider holding `held` session clips add another? */
export function canAddSessionClip(allowance: SessionAllowance, held: number): boolean {
  return allowance.unlimited || held < allowance.cap;
}

/** Clips left, or `null` when unlimited. */
export function sessionClipsRemaining(allowance: SessionAllowance, held: number): number | null {
  return allowance.unlimited ? null : Math.max(0, allowance.cap - held);
}

/** "Unlimited clip links", "10 clip links", "No clip links". */
export function sessionClipAllowanceLabel(allowance: SessionAllowance): string {
  if (allowance.unlimited) return 'Unlimited clip links';
  if (allowance.cap === 0) return 'No clip links';
  return `${allowance.cap} clip link${allowance.cap === 1 ? '' : 's'}`;
}

/* ----------------------------------------------------- stage promotion --- */

/**
 * The stage a landing moves a trick to, or `null` when there is nowhere to go.
 *
 * One step up the landed stages, floored at Sometimes: a trick the rider was
 * only wanting or learning (or not tracking) goes to **Sometimes**, because
 * landing it once is what Sometimes means; Sometimes goes to Most times, and
 * Most times to Every time. Every time stays put. Transcribed in the hook.
 */
export function landedStageAfter(current: StageId | null | undefined): StageId | null {
  if (current === 'some') return 'most';
  if (current === 'most') return 'every';
  if (current === 'every') return null;
  return 'some';
}

/**
 * Every stage a trick can be moved **up** to from where it is, in order.
 *
 * The session form's picker (Rachid, 2026-09-13, in chat). The old "Landed it"
 * tickbox offered one destination and did not name it, so a rider ticking it
 * could not tell that a trick they had been *learning* was about to become
 * *Sometimes*. The form now draws "Learning → …" and the rider chooses, which
 * means the list of what they may choose has to exist somewhere testable.
 *
 * **Up only, and never back to where it already is.** A trick at Learning
 * offers Sometimes, Most times and Every time; one at Most times offers Every
 * time alone; one at Every time offers nothing, because there is nothing above
 * it. An untracked trick — `null`, never logged — offers the whole ladder from
 * Learning, so a rider who worked on something they were not tracking can put
 * it at Learning rather than being forced to claim they landed it.
 *
 * That last case is the one thing this does not share with `landedStageAfter`,
 * which floors an untracked trick at Sometimes because ticking a box called
 * "Landed it" says so. Naming the destination is what makes Learning offerable.
 */
export function stagesAbove(current: StageId | null | undefined): readonly StageId[] {
  const from = current == null ? -1 : STAGE_IDS.indexOf(current);
  return STAGE_IDS.slice(from + 1);
}

/** Can a trick at `current` be moved to `target`? Up the ladder only. */
export function isStageMoveUp(
  current: StageId | null | undefined,
  target: StageId | null | undefined,
): target is StageId {
  return target != null && stagesAbove(current).includes(target);
}

/**
 * The move a trick entry causes: `{ stageFrom, stageTo }`, or `null`.
 *
 * **Once.** An entry that has already promoted (`alreadyPromoted`, i.e. it has
 * a `stageTo`) never promotes again, however many times the session is edited
 * and re-saved. And there is deliberately no inverse: unticking "Landed it",
 * removing the entry or deleting the session leaves the trick's stage where it
 * is — "you can tidy your diary without losing a trick you landed" (design
 * README). The hook applies this on create and on a landed flip, and nowhere
 * else.
 */
export function sessionStagePromotion(input: {
  landed: boolean;
  alreadyPromoted: boolean;
  current: StageId | null | undefined;
  /**
   * The stage the rider picked, when they picked one (2026-09-13). Honoured
   * only if it is *above* where the trick is; anything else falls through to
   * the one-step landing this has always done, so an old client that sends
   * `landed` alone behaves exactly as it did.
   */
  stagePick?: StageId | null;
}): { stageFrom: StageId | null; stageTo: StageId } | null {
  if (input.alreadyPromoted) return null;
  const picked = isStageMoveUp(input.current, input.stagePick) ? input.stagePick : null;
  if (!picked && !input.landed) return null;
  const stageTo = picked ?? landedStageAfter(input.current);
  if (!stageTo) return null;
  return { stageFrom: input.current ?? null, stageTo };
}

/** "→ Most times", the lime half of a trick pill. Empty when nothing moved. */
export function stageMoveLabel(entry: SessionTrickEntry): string {
  return entry.stageTo ? `→ ${STAGE[entry.stageTo].label}` : '';
}

/* ------------------------------------------------------------- the ride -- */

/**
 * Does this session count as **today's** ride (D6: logging a session is that
 * day's ride)?
 *
 * Only a session on the rider's today does. The streak stores no calendar —
 * one counter and two day keys (`WeeklyStreakState`) — so a session backfilled
 * to last week cannot be written into last week's count after the fact; it is
 * kept in the diary and moves no streak. `logWeeklyRide` is idempotent with
 * the "I rode today" tap, so a tap and a session on the same day are one ride.
 */
export function sessionCountsAsRideToday(startedAt: Instant, clock: RiderClock = {}): boolean {
  return toDayKey(startedAt, clock.timezone || DEFAULT_TIMEZONE) === riderToday(clock);
}

/* ------------------------------------------------------------ the form --- */

/** How far ahead of the server clock a start time may be: clock skew, not plans. */
export const SESSION_FUTURE_TOLERANCE_MINUTES = 60;

/** What a session form holds before it is sent. */
export interface SessionDraft {
  readonly startedAt: Instant | null | undefined;
  readonly durationMinutes: unknown;
  readonly sport: unknown;
  readonly spotId: string | null | undefined;
  readonly feel: unknown;
  readonly weather?: unknown;
  readonly aim?: string;
  readonly notes?: string;
  readonly crewIds?: readonly string[];
  /** The clip box, as typed. */
  readonly clip?: string;
  readonly trickIds?: readonly string[];
}

export type SessionField =
  | 'startedAt'
  | 'durationMinutes'
  | 'sport'
  | 'spotId'
  | 'feel'
  | 'weather'
  | 'aim'
  | 'notes'
  | 'crewIds'
  | 'clip'
  | 'tricks';

/**
 * The refusals a rider can meet, in words, written once. The hook sends the
 * same sentences (`lib/session_rules.js`), and a test holds the two in step,
 * so the form and the server never say the same thing two ways.
 */
export const SESSION_REFUSALS = {
  startedAt: 'Pick when you rode.',
  future: 'That time has not happened yet.',
  durationMinutes: 'Pick how long you rode for.',
  sport: 'Pick what you rode.',
  spotId: 'Pick where you rode.',
  spotHidden: 'That spot is not on the map.',
  eventHidden: 'That event is not on the calendar.',
  feel: 'Pick how it felt.',
  weather: 'That is not one of the weather options.',
  aim: `An aim can be up to ${SESSION_LIMITS.aimMax} characters.`,
  notes: `Notes can be up to ${SESSION_LIMITS.notesMax} characters.`,
  crewIds: `You can tag up to ${SESSION_LIMITS.crewMax} riders.`,
  crewNotMate: 'You can only tag riders who are in a crew with you.',
  tricks: `A session can hold up to ${SESSION_LIMITS.tricksMax} tricks.`,
  clipShortlink: CLIP_LINK_REFUSALS.shortlink,
  clipUnsupported: CLIP_LINK_REFUSALS.unsupported,
  clipNotOnPlan: 'Clip links on sessions come with Shredder.',
  clipCap: 'That is all your session clip links. Remove one to add another.',
  quotaFull: 'That is all your sessions this month. Your ride and your streak are already saved.',
  graceUsed:
    'You have already used your one-off save. Your ride and your streak are already saved.',
} as const;

/**
 * What is wrong with a draft, field by field. Empty when it can be sent.
 *
 * For the form's benefit only: the hook decides, and re-checks everything here
 * plus the things a form cannot know (the spot is live, the crew-mate is a
 * crew-mate, the plan allows a clip, the month has room).
 */
export function sessionProblems(
  draft: SessionDraft,
  now: number = Date.now(),
): Partial<Record<SessionField, string>> {
  const problems: Partial<Record<SessionField, string>> = {};

  const started =
    draft.startedAt == null || draft.startedAt === ''
      ? NaN
      : new Date(draft.startedAt as Instant).getTime();
  if (Number.isNaN(started)) problems.startedAt = SESSION_REFUSALS.startedAt;
  else if (started > now + SESSION_FUTURE_TOLERANCE_MINUTES * 60_000) {
    problems.startedAt = SESSION_REFUSALS.future;
  }

  if (!isSessionDuration(draft.durationMinutes)) {
    problems.durationMinutes = SESSION_REFUSALS.durationMinutes;
  }
  if (!(SPORT_IDS as readonly unknown[]).includes(draft.sport)) {
    problems.sport = SESSION_REFUSALS.sport;
  }
  if (!draft.spotId) problems.spotId = SESSION_REFUSALS.spotId;
  // Optional (Rachid, 2026-09-13, in chat): a rider logging the ride itself is
  // not made to rate it first. Only a value that is not one of the five is
  // refused — none at all is a session that says nothing about how it felt.
  if (draft.feel != null && draft.feel !== '' && !isSessionFeel(draft.feel)) {
    problems.feel = SESSION_REFUSALS.feel;
  }
  if (draft.weather != null && draft.weather !== '' && !isSessionWeather(draft.weather)) {
    problems.weather = SESSION_REFUSALS.weather;
  }
  if ((draft.aim ?? '').length > SESSION_LIMITS.aimMax) problems.aim = SESSION_REFUSALS.aim;
  if ((draft.notes ?? '').length > SESSION_LIMITS.notesMax) problems.notes = SESSION_REFUSALS.notes;
  if ((draft.crewIds ?? []).length > SESSION_LIMITS.crewMax) {
    problems.crewIds = SESSION_REFUSALS.crewIds;
  }
  if ((draft.trickIds ?? []).length > SESSION_LIMITS.tricksMax) {
    problems.tricks = SESSION_REFUSALS.tricks;
  }

  const clip = clipLinkProblem(draft.clip ?? '');
  if (clip === 'shortlink') problems.clip = SESSION_REFUSALS.clipShortlink;
  else if (clip === 'unsupported') problems.clip = SESSION_REFUSALS.clipUnsupported;

  return problems;
}

/* ---------------------------------------------------------- label tables -- */

export function isSessionDuration(value: unknown): value is SessionDurationMinutes {
  return (SESSION_DURATION_MINUTES as readonly unknown[]).includes(value);
}

export function isSessionFeel(value: unknown): value is SessionFeelId {
  return (SESSION_FEEL_IDS as readonly unknown[]).includes(value);
}

export function isSessionWeather(value: unknown): value is SessionWeatherId {
  return (SESSION_WEATHER_IDS as readonly unknown[]).includes(value);
}

/** "30m", "1h", "2h", "3h+". Empty for a value that is not one of the four. */
export function sessionDurationLabel(minutes: unknown): string {
  return SESSION_DURATIONS.find((d) => d.minutes === minutes)?.label ?? '';
}

/** "Sent it", "Good", … Empty for an unknown id. */
export function sessionFeelLabel(feel: unknown): string {
  return SESSION_FEELS.find((f) => f.id === feel)?.label ?? '';
}

/** The feel's swatch colour. Falls back to paper for an unknown id. */
export function sessionFeelColor(feel: unknown): string {
  return SESSION_FEELS.find((f) => f.id === feel)?.color ?? '#fffdf5';
}

/** "Sun", "Cloud", … Empty for none or an unknown id. */
export function sessionWeatherLabel(weather: unknown): string {
  return SESSION_WEATHER.find((w) => w.id === weather)?.label ?? '';
}

/**
 * A total of minutes as a rider reads it: "45m", "3h", "2h 30m". The month
 * summary and the spot block both use it.
 */
export function sessionTimeLabel(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes || 0));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** Whole and half hours, for the sidebar's big number: 390 minutes is 6.5. */
export function sessionHours(totalMinutes: number): number {
  return Math.round((Math.max(0, totalMinutes || 0) / 60) * 2) / 2;
}

/* ------------------------------------------------------- lists and pages -- */

/** Sessions on the feed, per page (design 1a/2a). */
export const SESSIONS_PER_PAGE = 3;

function startedMs(session: Pick<RideSession, 'startedAt'>): number {
  const ms = Date.parse(session.startedAt);
  return Number.isNaN(ms) ? 0 : ms;
}

/** Newest first; ties broken by id so the order is stable across renders. */
export function sortSessionsNewestFirst<T extends Pick<RideSession, 'startedAt' | 'id'>>(
  sessions: readonly T[],
): T[] {
  return [...sessions].sort((a, b) => startedMs(b) - startedMs(a) || (a.id < b.id ? 1 : -1));
}

/** The list filters: a sport, and "at an event". */
export interface SessionFilter {
  readonly sport?: SportId | null;
  readonly atEvent?: boolean;
}

export function filterSessions<T extends Pick<RideSession, 'sport' | 'eventId'>>(
  sessions: readonly T[],
  filter: SessionFilter = {},
): T[] {
  return sessions.filter(
    (s) => (!filter.sport || s.sport === filter.sport) && (!filter.atEvent || Boolean(s.eventId)),
  );
}

/** The newer and older neighbours of one session, for the detail page's pager. */
export function adjacentSessions(
  sessions: readonly Pick<RideSession, 'id' | 'startedAt'>[],
  id: string,
): { readonly newerId: string | null; readonly olderId: string | null } {
  const ordered = sortSessionsNewestFirst(sessions);
  const at = ordered.findIndex((s) => s.id === id);
  if (at === -1) return { newerId: null, olderId: null };
  return { newerId: ordered[at - 1]?.id ?? null, olderId: ordered[at + 1]?.id ?? null };
}

/** The trick entries in a session that moved a stage. */
export function sessionStageMoves(session: Pick<RideSession, 'trickEntries'>): SessionTrickEntry[] {
  return session.trickEntries.filter((entry) => Boolean(entry.stageTo));
}

/** One month of sessions, for the phone accordions and the desktop groups. */
export interface SessionMonthGroup<T> {
  /** `YYYY-MM`, the month the sessions were *ridden* in, on the rider's clock. */
  readonly monthKey: string;
  /** "September". */
  readonly monthName: string;
  readonly year: number;
  /** Newest first. */
  readonly sessions: readonly T[];
  readonly count: number;
  readonly minutes: number;
  readonly stageMoves: number;
}

/**
 * Sessions grouped by the month they were ridden in, newest month first.
 *
 * Ridden, not logged: this is the diary, and a session backfilled to August
 * belongs under August. (The quota counts the other way — see
 * `sessionQuotaStatus`.)
 */
export function groupSessionsByMonth<T extends RideSession>(
  sessions: readonly T[],
  timezone: string = DEFAULT_TIMEZONE,
): SessionMonthGroup<T>[] {
  const byMonth = new Map<string, T[]>();
  for (const session of sortSessionsNewestFirst(sessions)) {
    const key = monthKeyOf(session.startedAt, timezone);
    const list = byMonth.get(key);
    if (list) list.push(session);
    else byMonth.set(key, [session]);
  }
  return [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([monthKey, list]) => ({
      monthKey,
      monthName: MONTH_NAMES[Number(monthKey.slice(5, 7)) - 1] ?? '',
      year: Number(monthKey.slice(0, 4)),
      sessions: list,
      count: list.length,
      minutes: list.reduce((sum, s) => sum + s.durationMinutes, 0),
      stageMoves: list.reduce((sum, s) => sum + sessionStageMoves(s).length, 0),
    }));
}

/** The sidebar's month card: sessions, time, stage moves, spots ridden. */
export interface SessionMonthSummary {
  readonly sessions: number;
  readonly minutes: number;
  readonly hours: number;
  readonly stageMoves: number;
  readonly spotsRidden: number;
}

export function sessionMonthSummary(
  sessions: readonly RideSession[],
  monthKey: string,
  timezone: string = DEFAULT_TIMEZONE,
): SessionMonthSummary {
  const inMonth = sessions.filter((s) => monthKeyOf(s.startedAt, timezone) === monthKey);
  const minutes = inMonth.reduce((sum, s) => sum + s.durationMinutes, 0);
  return {
    sessions: inMonth.length,
    minutes,
    hours: sessionHours(minutes),
    stageMoves: inMonth.reduce((sum, s) => sum + sessionStageMoves(s).length, 0),
    spotsRidden: new Set(inMonth.map((s) => s.spotId).filter(Boolean)).size,
  };
}

/** One row of "Where you ride". `share` is 0–1 against the busiest spot. */
export interface TopSpot {
  readonly spotId: string;
  readonly count: number;
  readonly share: number;
}

/** The spots ridden most, busiest first; ties go to the more recent. */
export function topSpots(sessions: readonly RideSession[], limit = 4): TopSpot[] {
  const counts = new Map<string, { count: number; last: number }>();
  for (const session of sessions) {
    if (!session.spotId) continue;
    const entry = counts.get(session.spotId) ?? { count: 0, last: 0 };
    entry.count += 1;
    entry.last = Math.max(entry.last, startedMs(session));
    counts.set(session.spotId, entry);
  }
  const rows = [...counts.entries()].sort(
    (a, b) => b[1].count - a[1].count || b[1].last - a[1].last || (a[0] < b[0] ? -1 : 1),
  );
  const most = rows[0]?.[1].count ?? 0;
  return rows.slice(0, Math.max(0, limit)).map(([spotId, { count }]) => ({
    spotId,
    count,
    share: most === 0 ? 0 : count / most,
  }));
}

/** A rider's sessions at one spot, newest first, with the count and the time. */
export function spotSessionSummary(
  sessions: readonly RideSession[],
  spotId: string,
): { readonly sessions: RideSession[]; readonly count: number; readonly minutes: number } {
  const here = sortSessionsNewestFirst(sessions.filter((s) => s.spotId === spotId));
  return {
    sessions: here,
    count: here.length,
    minutes: here.reduce((sum, s) => sum + s.durationMinutes, 0),
  };
}

/** A rider's sessions at one event, newest first. */
export function eventSessions(sessions: readonly RideSession[], eventId: string): RideSession[] {
  return sortSessionsNewestFirst(sessions.filter((s) => s.eventId === eventId));
}

/** "Tailwhip in your sessions": the count, the first day, and the moves. */
export interface TrickSessionSummary {
  readonly sessions: RideSession[];
  readonly count: number;
  /** The rider-clock day of the earliest session that worked it. */
  readonly firstTriedOn: DayKey | null;
  readonly stageMoves: readonly {
    readonly sessionId: string;
    readonly stageFrom: StageId | null;
    readonly stageTo: StageId;
  }[];
}

export function trickSessionSummary(
  sessions: readonly RideSession[],
  trickId: string,
  timezone: string = DEFAULT_TIMEZONE,
): TrickSessionSummary {
  const worked = sortSessionsNewestFirst(
    sessions.filter((s) => s.trickEntries.some((e) => e.trickId === trickId)),
  );
  const earliest = worked[worked.length - 1];
  const stageMoves = worked.flatMap((s) =>
    s.trickEntries
      .filter((e) => e.trickId === trickId && e.stageTo)
      .map((e) => ({ sessionId: s.id, stageFrom: e.stageFrom ?? null, stageTo: e.stageTo! })),
  );
  return {
    sessions: worked,
    count: worked.length,
    firstTriedOn: earliest ? toDayKey(earliest.startedAt, timezone) : null,
    stageMoves,
  };
}

/* ------------------------------------------------ what this one changed --- */

/** One line on the "What this one changed" card. */
export type SessionChange =
  | {
      readonly kind: 'stage';
      readonly trickId: string;
      readonly stageFrom: StageId | null;
      readonly stageTo: StageId;
    }
  | { readonly kind: 'streak_held' }
  | { readonly kind: 'week_banked'; readonly rides: number }
  | { readonly kind: 'spot_count'; readonly n: number };

/**
 * The consequences of one session, derived from the rider's sessions — "the
 * card that makes a log feel worth keeping" (design 1e/2c).
 *
 * - **`stage`** — one per trick entry that moved a stage.
 * - **`streak_held`** — the session was the first on its day, so it was that
 *   day's ride (D6).
 * - **`week_banked`** — its day was the one that took its week to the weekly
 *   target, counting distinct session days.
 * - **`spot_count`** — which session at this spot it was, oldest first.
 *
 * **Derived from sessions alone.** An "I rode today" tap on another day of the
 * same week stores no calendar entry, so it cannot be seen here: a week banked
 * by one tap and one session reads as not banked on this card. That errs
 * towards saying less than happened, never more.
 */
export function sessionChanges(
  session: RideSession,
  allSessions: readonly RideSession[],
  options: { timezone?: string; target?: number } = {},
): SessionChange[] {
  const timezone = options.timezone || DEFAULT_TIMEZONE;
  const target = Math.max(1, Math.floor(options.target ?? WEEKLY_RIDE_TARGET));
  const changes: SessionChange[] = [];

  for (const entry of sessionStageMoves(session)) {
    changes.push({
      kind: 'stage',
      trickId: entry.trickId,
      stageFrom: entry.stageFrom ?? null,
      stageTo: entry.stageTo!,
    });
  }

  const pool = allSessions.some((s) => s.id === session.id)
    ? allSessions
    : [...allSessions, session];
  const oldestFirst = [...pool].sort(
    (a, b) => startedMs(a) - startedMs(b) || (a.id < b.id ? -1 : 1),
  );

  const day = toDayKey(session.startedAt, timezone);
  const firstOfDay = oldestFirst.find((s) => toDayKey(s.startedAt, timezone) === day);
  if (firstOfDay?.id === session.id) {
    changes.push({ kind: 'streak_held' });

    const week = weekStart(day);
    const days = [
      ...new Set(
        oldestFirst
          .map((s) => toDayKey(s.startedAt, timezone))
          .filter((d) => d >= week && d <= addDays(week, 6)),
      ),
    ].sort();
    if (days.indexOf(day) + 1 === target) {
      changes.push({ kind: 'week_banked', rides: target });
    }
  }

  if (session.spotId) {
    const atSpot = oldestFirst.filter((s) => s.spotId === session.spotId);
    const n = atSpot.findIndex((s) => s.id === session.id) + 1;
    if (n > 0) changes.push({ kind: 'spot_count', n });
  }

  return changes;
}

const ORDINALS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
];

function ordinal(n: number): string {
  if (ORDINALS[n - 1]) return ORDINALS[n - 1]!;
  const mod100 = n % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}

/**
 * A change as a line on the card. `trickName` is needed for a `stage` change;
 * the others ignore it. Gain-framed throughout (plan §6.4 standard 13).
 */
export function sessionChangeLabel(change: SessionChange, trickName = ''): string {
  switch (change.kind) {
    case 'stage': {
      const from = change.stageFrom ? STAGE[change.stageFrom].label : 'Not tracked';
      return `${trickName || 'A trick'}: ${from} → ${STAGE[change.stageTo].label}`;
    }
    case 'streak_held':
      return 'Counted as a ride for your weekly streak';
    case 'week_banked':
      return `Banked the week: ${change.rides} rides`;
    case 'spot_count':
      return `Your ${ordinal(change.n)} session at this spot`;
  }
}

/** The profile's default for new sessions, read fail-closed (D2). */
export function sessionVisibilityDefault(raw: unknown): SessionVisibilityId {
  return raw == null || raw === '' ? DEFAULT_SESSION_VISIBILITY : normaliseSessionVisibility(raw);
}
