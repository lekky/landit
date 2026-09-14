import {
  DEFAULT_TIMEZONE,
  MONTH_LABELS,
  SESSION_LIMITS,
  SESSION_REFUSALS,
  SESSION_VISIBILITIES,
  SPORT_IDS,
  STAGE,
  STAGE_IDS,
  distanceKm,
  isSessionDuration,
  isSessionFeel,
  isSessionWeather,
  normaliseSessionVisibility,
  sessionProblems,
  sessionQuotaLine,
  sessionQuotaPips,
  weekdayName,
  weeklyStreakLabel,
  type DayKey,
  type Instant,
  type SessionDraft,
  type SessionDurationMinutes,
  type SessionFeelId,
  type SessionField,
  type SessionQuotaStatus,
  type SessionVisibilityId,
  type SessionWeatherId,
  type SportId,
  type StageId,
} from '@landit/core';
import type { SessionInput, SessionPatch, SessionRefusal } from '@landit/db';

import type { NewSessionPrefill } from './sessionRoutes';

/**
 * The session form's rules (T38), kept out of the components so they can be
 * tested without a browser.
 *
 * Nothing here decides anything the server does not decide again: the hook in
 * `pocketbase/hooks/66_sessions.pb.js` re-checks every field, the quota, the
 * clip allowance and the crew tags. What lives here is the form's side of it —
 * what a form opens holding, what it sends, and what a refusal turns into on
 * screen.
 *
 * **Nothing here reads or holds a position.** The spot is an id chosen from the
 * map's own list; the only coordinates are a spot's and an event's, which are
 * ours (plan §6.4 standard 10, amended 2026-09-13).
 */

/* ------------------------------------------------------------ the values -- */

/** "Right now" or "Pick a time". */
export type WhenMode = 'now' | 'pick';

export interface SessionTrickValue {
  readonly trickId: string;
  readonly landed: boolean;
  /**
   * The stage the rider is moving this trick to, or `null` for "worked on it,
   * moved nothing" (2026-09-13). `landed` follows it — a landed stage is a
   * landing — so the two can never say different things.
   */
  readonly stagePick?: StageId | null;
}

/** Everything the form holds. Plain data, so it can cross into a server action. */
export interface SessionFormValues {
  readonly when: WhenMode;
  /** `YYYY-MM-DDTHH:mm` on the rider's clock. Only read when `when` is `pick`. */
  readonly pickedAt: string;
  readonly durationMinutes: SessionDurationMinutes;
  readonly spotId: string;
  /** `''` for no event. */
  readonly eventId: string;
  readonly sport: SportId;
  readonly aim: string;
  readonly tricks: readonly SessionTrickValue[];
  /** `null` until the rider picks one — there is no default feeling. */
  readonly feel: SessionFeelId | null;
  readonly weather: SessionWeatherId | null;
  readonly notes: string;
  readonly crewIds: readonly string[];
  /** The clip box exactly as typed (D4: never pre-parsed). */
  readonly clip: string;
  readonly visibility: SessionVisibilityId;
}

/**
 * How long the quick log says a session was. The quick log has no duration
 * control (1d, 2f), and a session must carry one, so it sends an hour. **A
 * tunable default the design does not state**, recorded in plan §7 T38.
 */
export const QUICK_LOG_DURATION_MINUTES: SessionDurationMinutes = 60;

/** The rider's sports, or the first sport when the record has none. */
function sportsOrDefault(sports: readonly SportId[]): readonly SportId[] {
  return sports.length ? sports : [SPORT_IDS[0] as SportId];
}

/**
 * What a new form opens holding.
 *
 * - **Where**: the spot the link named (a spot, event or trick page), else the
 *   rider's most recent spot, else nothing — the rider picks one.
 * - **Event**: only the one the link named. The "is on here today" band offers
 *   one; it is never attached without a press.
 * - **Sport**: the sport the link implies (an event's or a trick's) when the
 *   rider rides it, else their first.
 * - **Tricks**: the trick the link named, unticked for "Landed it".
 * - **Who can see it**: the profile default (D2), which reads `private` when
 *   the rider has never chosen.
 */
export function newSessionValues(input: {
  readonly prefill: NewSessionPrefill;
  readonly sports: readonly SportId[];
  readonly recentSpotId?: string | null;
  readonly impliedSport?: SportId | null;
  readonly visibilityDefault: SessionVisibilityId;
  readonly nowLocal: string;
}): SessionFormValues {
  const sports = sportsOrDefault(input.sports);
  const sport =
    input.impliedSport && sports.includes(input.impliedSport)
      ? input.impliedSport
      : (sports[0] as SportId);
  return {
    when: 'now',
    pickedAt: input.nowLocal,
    durationMinutes: QUICK_LOG_DURATION_MINUTES,
    spotId: input.prefill.spot ?? input.recentSpotId ?? '',
    eventId: input.prefill.event ?? '',
    sport,
    aim: '',
    tricks: input.prefill.trick ? [{ trickId: input.prefill.trick, landed: false }] : [],
    feel: null,
    weather: null,
    notes: '',
    crewIds: [],
    clip: '',
    visibility: input.visibilityDefault,
  };
}

/** A saved session as the form's values, for edit mode. */
export function editSessionValues(input: {
  readonly session: {
    readonly startedAt: Instant;
    readonly durationMinutes: SessionDurationMinutes;
    readonly sport: SportId;
    readonly spotId: string;
    readonly eventId?: string;
    readonly aim?: string;
    readonly feel: SessionFeelId | null;
    readonly weather?: SessionWeatherId;
    readonly notes?: string;
    readonly crewIds: readonly string[];
    readonly visibility: SessionVisibilityId;
    readonly trickEntries: readonly {
      trickId: string;
      landed: boolean;
      stagePick?: StageId | null;
    }[];
  };
  /** `clipWatchUrl(session.clip)`, or `''`. */
  readonly clipText: string;
  readonly timezone: string;
}): SessionFormValues {
  const { session } = input;
  return {
    when: 'pick',
    pickedAt: localDateTimeIn(session.startedAt, input.timezone),
    durationMinutes: session.durationMinutes,
    spotId: session.spotId,
    eventId: session.eventId ?? '',
    sport: session.sport,
    aim: session.aim ?? '',
    tricks: session.trickEntries.map((e) => ({
      trickId: e.trickId,
      landed: e.landed,
      stagePick: e.stagePick ?? null,
    })),
    feel: session.feel,
    weather: session.weather ?? null,
    notes: session.notes ?? '',
    crewIds: [...session.crewIds],
    clip: input.clipText,
    visibility: session.visibility,
  };
}

/**
 * "Add tricks, clip and notes →": the full form, **holding what the quick log
 * already had** (handoff, Interactions). The quick log's three fields — the
 * time, the spot and the feel — are the same fields the full form has, so
 * escalating changes the shell and nothing else. A copy, so the two screens
 * never share one mutable object.
 */
export function escalateQuickLog(values: SessionFormValues): SessionFormValues {
  return { ...values, tricks: [...values.tricks], crewIds: [...values.crewIds] };
}

/* ----------------------------------------------- the rider's clock ------ */

const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** The wall clock in a timezone, as numbers. Node and every browser have `Intl`. */
function wallClock(ms: number, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone || DEFAULT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * An instant as `YYYY-MM-DDTHH:mm` on the rider's clock — the value a native
 * `datetime-local` input takes. **Computed on the server** and handed down as a
 * string, so the browser never formats a date in a hydrated tree (LESSONS §3a).
 */
export function localDateTimeIn(instant: Instant, timezone: string): string {
  const ms = new Date(instant).getTime();
  if (Number.isNaN(ms)) return '';
  const c = wallClock(ms, timezone);
  return `${c.year}-${pad(c.month)}-${pad(c.day)}T${pad(c.hour)}:${pad(c.minute)}`;
}

/** How far a timezone's wall clock is ahead of UTC at an instant, in ms. */
function offsetMs(ms: number, timezone: string): number {
  const c = wallClock(ms, timezone);
  const asUtc = Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute);
  return asUtc - Math.floor(ms / 60_000) * 60_000;
}

/**
 * `YYYY-MM-DDTHH:mm` on the rider's clock back to an ISO instant, or `null`.
 *
 * Done on the server with the rider's own `users.timezone`, never the device's:
 * a rider whose phone is set to another zone still means their own clock. Two
 * passes, so a time next to a clock change lands on the right side of it.
 */
export function zonedLocalToInstant(local: string, timezone: string): string | null {
  const match = LOCAL_PATTERN.exec(local);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number) as number[];
  const guess = Date.UTC(y!, mo! - 1, d!, h!, mi!);
  if (Number.isNaN(guess)) return null;
  const tz = timezone || DEFAULT_TIMEZONE;
  let ms = guess - offsetMs(guess, tz);
  ms = guess - offsetMs(ms, tz);
  return new Date(ms).toISOString();
}

const WEEKDAY_SHORT = (day: DayKey) => weekdayName(day).slice(0, 3);

/** "Sat 13 Sep · 16:20" — the quick log's timestamp. Server-rendered. */
export function sessionStampLabel(instant: Instant, timezone: string): string {
  const local = localDateTimeIn(instant, timezone);
  if (!local) return '';
  const day = local.slice(0, 10);
  return `${WEEKDAY_SHORT(day)} ${shortDayMonth(day)} · ${local.slice(11, 16)}`;
}

/** "25 Aug". */
export function shortDayMonth(day: DayKey): string {
  return `${Number(day.slice(8, 10))} ${MONTH_LABELS[Number(day.slice(5, 7)) - 1] ?? ''}`;
}

/* ------------------------------------------------------------ sending --- */

export interface RiderFormClock {
  readonly now: number;
  readonly timezone: string;
}

function startedAtOf(values: SessionFormValues, clock: RiderFormClock): string | null {
  if (values.when === 'now') return new Date(clock.now).toISOString();
  return zonedLocalToInstant(values.pickedAt, clock.timezone);
}

/** The form as core's draft, for `sessionProblems`. */
export function formDraft(values: SessionFormValues, clock: RiderFormClock): SessionDraft {
  return {
    startedAt: startedAtOf(values, clock),
    durationMinutes: values.durationMinutes,
    sport: values.sport,
    spotId: values.spotId,
    feel: values.feel,
    weather: values.weather,
    aim: values.aim,
    notes: values.notes,
    crewIds: values.crewIds,
    clip: values.clip,
    trickIds: values.tricks.map((t) => t.trickId),
  };
}

/**
 * What is wrong with the form, by field — core's `sessionProblems`, the same
 * sentences the server sends. Empty when it can be sent. `clipAllowed: false`
 * (Rookie) skips the clip, whose field is locked and never sent.
 */
export function formProblems(
  values: SessionFormValues,
  clock: RiderFormClock,
  options: { readonly clipAllowed?: boolean } = {},
): Partial<Record<SessionField, string>> {
  const draft = formDraft(values, clock);
  const problems = sessionProblems(
    options.clipAllowed === false ? { ...draft, clip: '' } : draft,
    clock.now,
  );
  return problems;
}

/**
 * The field-to-input mapping: what `logSession` is sent. `null` when the form
 * has a problem, so a caller cannot send one it did not check.
 *
 * - `clip` is the box as typed, trimmed — **never parsed here** (D4); and `''`
 *   when the plan holds no clips, so a Rookie write never carries one.
 * - An empty event and an empty weather are omitted rather than sent as `''`.
 */
export function sessionInputFrom(
  values: SessionFormValues,
  clock: RiderFormClock,
  options: { readonly clipAllowed?: boolean } = {},
): SessionInput | null {
  if (Object.keys(formProblems(values, clock, options)).length) return null;
  const startedAt = startedAtOf(values, clock);
  if (!startedAt) return null;
  const clip = options.clipAllowed === false ? '' : values.clip.trim();
  return {
    startedAt,
    durationMinutes: values.durationMinutes,
    sport: values.sport,
    spotId: values.spotId,
    ...(values.eventId ? { eventId: values.eventId } : {}),
    aim: values.aim.trim(),
    // Optional since 2026-09-13: omitted rather than sent empty.
    ...(values.feel ? { feel: values.feel } : {}),
    ...(values.weather ? { weather: values.weather } : {}),
    notes: values.notes.trim(),
    crewIds: [...values.crewIds],
    ...(clip ? { clip } : {}),
    visibility: values.visibility,
    tricks: values.tricks.map((t) => ({
      trickId: t.trickId,
      landed: t.landed,
      stagePick: t.stagePick ?? null,
    })),
  };
}

function sameTricks(a: readonly SessionTrickValue[], b: readonly SessionTrickValue[]): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(b.map((t) => [t.trickId, t]));
  return a.every((t) => {
    const other = byId.get(t.trickId);
    return (
      !!other && other.landed === t.landed && (other.stagePick ?? null) === (t.stagePick ?? null)
    );
  });
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(b);
  return a.every((id) => set.has(id));
}

/**
 * Edit mode's patch: only what changed, so an untouched clip is not re-sent
 * (and re-counted), and an untouched time is not moved by a minute of rounding.
 * `null` when the form has a problem; `{}` when nothing changed.
 */
export function sessionPatchFrom(
  values: SessionFormValues,
  initial: SessionFormValues,
  clock: RiderFormClock,
  options: { readonly clipAllowed?: boolean } = {},
): SessionPatch | null {
  const clipAllowed = options.clipAllowed !== false || values.clip === initial.clip;
  if (Object.keys(formProblems(values, clock, { clipAllowed })).length) return null;
  const patch: { -readonly [K in keyof SessionPatch]: SessionPatch[K] } = {};
  if (values.when !== initial.when || values.pickedAt !== initial.pickedAt) {
    const startedAt = startedAtOf(values, clock);
    if (!startedAt) return null;
    patch.startedAt = startedAt;
  }
  if (values.durationMinutes !== initial.durationMinutes) {
    patch.durationMinutes = values.durationMinutes;
  }
  if (values.sport !== initial.sport) patch.sport = values.sport;
  if (values.spotId !== initial.spotId) patch.spotId = values.spotId;
  if (values.eventId !== initial.eventId) patch.eventId = values.eventId || null;
  if (values.aim.trim() !== initial.aim.trim()) patch.aim = values.aim.trim();
  // `null` is a real edit now — it clears a feel the rider no longer wants on it.
  if (values.feel !== initial.feel) patch.feel = values.feel;
  if (values.weather !== initial.weather) patch.weather = values.weather;
  if (values.notes.trim() !== initial.notes.trim()) patch.notes = values.notes.trim();
  if (!sameIds(values.crewIds, initial.crewIds)) patch.crewIds = [...values.crewIds];
  if (values.clip.trim() !== initial.clip.trim()) patch.clip = values.clip.trim();
  if (values.visibility !== initial.visibility) patch.visibility = values.visibility;
  if (!sameTricks(values.tricks, initial.tricks)) {
    patch.tricks = values.tricks.map((t) => ({
      trickId: t.trickId,
      landed: t.landed,
      stagePick: t.stagePick ?? null,
    }));
  }
  return patch;
}

/** Has the rider changed anything since the form opened? */
export function formIsDirty(values: SessionFormValues, initial: SessionFormValues): boolean {
  return (
    values.when !== initial.when ||
    (values.when === 'pick' && values.pickedAt !== initial.pickedAt) ||
    values.durationMinutes !== initial.durationMinutes ||
    values.sport !== initial.sport ||
    values.spotId !== initial.spotId ||
    values.eventId !== initial.eventId ||
    values.aim !== initial.aim ||
    values.feel !== initial.feel ||
    values.weather !== initial.weather ||
    values.notes !== initial.notes ||
    !sameIds(values.crewIds, initial.crewIds) ||
    values.clip !== initial.clip ||
    values.visibility !== initial.visibility ||
    !sameTricks(values.tricks, initial.tricks)
  );
}

const RECORD_ID = /^[a-z0-9]{15}$/;
const LOCAL_OR_EMPTY = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})?$/;

function idList(value: unknown, max: number): string[] | null {
  if (!Array.isArray(value) || value.length > max) return null;
  if (!value.every((v) => typeof v === 'string' && RECORD_ID.test(v))) return null;
  return [...new Set(value as string[])];
}

/**
 * The values back out of a server action's argument, which is whatever the
 * browser sent. Shape only — every rule is the hook's — and `null` for
 * anything that is not the shape, so the action refuses rather than guesses.
 */
export function readFormValues(raw: unknown): SessionFormValues | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const v = raw as Record<string, unknown>;
  const str = (key: string, max: number) =>
    typeof v[key] === 'string' && (v[key] as string).length <= max ? (v[key] as string) : null;

  const when = v.when === 'now' || v.when === 'pick' ? v.when : null;
  const pickedAt = str('pickedAt', 16);
  const spotId = str('spotId', 15);
  const eventId = str('eventId', 15);
  const aim = str('aim', SESSION_LIMITS.aimMax * 4);
  const notes = str('notes', SESSION_LIMITS.notesMax * 4);
  const clip = str('clip', 2048);
  const crewIds = idList(v.crewIds, SESSION_LIMITS.crewMax);
  const tricksRaw = Array.isArray(v.tricks) ? v.tricks : null;
  const tricks =
    tricksRaw && tricksRaw.length <= SESSION_LIMITS.tricksMax
      ? tricksRaw.map((t) => {
          const entry = t as { trickId?: unknown; landed?: unknown; stagePick?: unknown };
          if (typeof entry?.trickId !== 'string' || !RECORD_ID.test(entry.trickId)) return null;
          // Anything that is not one of the five stages becomes no pick at all,
          // the same fail-closed reading the other fields get here.
          const pick = STAGE_IDS.includes(entry.stagePick as StageId)
            ? (entry.stagePick as StageId)
            : null;
          return { trickId: entry.trickId, landed: entry.landed === true, stagePick: pick };
        })
      : null;

  if (
    !when ||
    pickedAt === null ||
    !LOCAL_OR_EMPTY.test(pickedAt) ||
    spotId === null ||
    (spotId !== '' && !RECORD_ID.test(spotId)) ||
    eventId === null ||
    (eventId !== '' && !RECORD_ID.test(eventId)) ||
    aim === null ||
    notes === null ||
    clip === null ||
    !crewIds ||
    !tricks ||
    tricks.some((t) => t === null) ||
    !isSessionDuration(v.durationMinutes) ||
    !(SPORT_IDS as readonly unknown[]).includes(v.sport) ||
    !(v.feel === null || isSessionFeel(v.feel)) ||
    !(v.weather === null || isSessionWeather(v.weather)) ||
    normaliseSessionVisibility(v.visibility) !== v.visibility
  ) {
    return null;
  }

  return {
    when,
    pickedAt,
    durationMinutes: v.durationMinutes as SessionDurationMinutes,
    spotId,
    eventId,
    sport: v.sport as SportId,
    aim,
    tricks: tricks as SessionTrickValue[],
    feel: v.feel as SessionFeelId | null,
    weather: v.weather as SessionWeatherId | null,
    notes,
    crewIds,
    clip,
    visibility: v.visibility as SessionVisibilityId,
  };
}

/* ---------------------------------------------------------- refusals ---- */

/**
 * The one sentence for a failure that is ours, not the rider's — the same one
 * `runAction` uses for a lost write, so a rider never meets two wordings.
 */
export const SESSION_SAVE_FAILED = 'That did not save. Try again in a moment.';

const KNOWN_SENTENCES = new Set<string>(Object.values(SESSION_REFUSALS));

/**
 * A server sentence if it is one of ours, else our generic one. **Never
 * PocketBase's own wording** (issue #489): "Failed to create record." is a
 * sentence about a database, and a rider cannot act on it.
 */
export function inOurWords(message: string | null | undefined): string {
  return message && KNOWN_SENTENCES.has(message) ? message : SESSION_SAVE_FAILED;
}

const FIELD_OF_REFUSAL: Readonly<Record<keyof typeof SESSION_REFUSALS, SessionField | null>> = {
  startedAt: 'startedAt',
  future: 'startedAt',
  durationMinutes: 'durationMinutes',
  sport: 'sport',
  spotId: 'spotId',
  spotHidden: 'spotId',
  eventHidden: 'spotId',
  feel: 'feel',
  weather: 'weather',
  aim: 'aim',
  notes: 'notes',
  crewIds: 'crewIds',
  crewNotMate: 'crewIds',
  tricks: 'tricks',
  clipShortlink: 'clip',
  clipUnsupported: 'clip',
  clipNotOnPlan: 'clip',
  clipCap: 'clip',
  quotaFull: null,
  graceUsed: null,
};

/** Which field a server sentence is about, so it can sit under that field. */
export function refusalField(message: string | null | undefined): SessionField | null {
  if (!message) return null;
  const key = (Object.keys(SESSION_REFUSALS) as (keyof typeof SESSION_REFUSALS)[]).find(
    (k) => SESSION_REFUSALS[k] === message,
  );
  return key ? FIELD_OF_REFUSAL[key] : null;
}

/** What a refusal from `logSession` becomes on screen. */
export type RefusalView =
  | { readonly kind: 'wall'; readonly grace: boolean }
  | { readonly kind: 'field'; readonly field: SessionField; readonly message: string }
  | { readonly kind: 'error'; readonly message: string };

/**
 * - `quota` → the fifth-session wall, with "Save this one anyway".
 * - `grace_used` → the wall without it.
 * - `clip` → an error under the clip field, in core's words.
 * - `other` → under the field it names when it names one; otherwise the error
 *   line, in our words.
 */
export function refusalView(refusal: Pick<SessionRefusal, 'kind' | 'message'>): RefusalView {
  if (refusal.kind === 'quota') return { kind: 'wall', grace: true };
  if (refusal.kind === 'grace_used') return { kind: 'wall', grace: false };
  if (refusal.kind === 'clip') {
    const message =
      refusal.message && refusalField(refusal.message) === 'clip'
        ? refusal.message
        : SESSION_REFUSALS.clipNotOnPlan;
    return { kind: 'field', field: 'clip', message };
  }
  const field = refusalField(refusal.message);
  if (field) return { kind: 'field', field, message: refusal.message as string };
  return { kind: 'error', message: inOurWords(refusal.message) };
}

/* ----------------------------------------------------------- analytics -- */

export type SessionOpenSource = 'progress' | 'spot' | 'event' | 'trick';

/**
 * `session_log_opened`'s `source`, read from the link's prefill. An event link
 * carries its spot too, so the event is asked first; a trick link names only
 * the trick. Nothing else is read: never which spot, event or trick.
 */
export function sessionOpenSource(prefill: NewSessionPrefill): SessionOpenSource {
  if (prefill.event) return 'event';
  if (prefill.trick) return 'trick';
  if (prefill.spot) return 'spot';
  return 'progress';
}

/* -------------------------------------------------------------- copy ---- */

/** What the saved state knows about the ride, from `logSession`'s result. */
export interface SavedRide {
  readonly counted: boolean;
  readonly failed: boolean;
  readonly streak: number;
  readonly ridesThisWeek: number;
  readonly target: number;
}

/**
 * The green confirmation's line (1d): "Streak held at 12 weeks. That is both
 * rides this week — target met." Gain-framed in every branch (plan §6.4
 * standard 13). The design writes "day 12"; the product's streak is weeks
 * (plan §1, T8), so it says weeks.
 */
export function savedRideLine(ride: SavedRide): string {
  if (ride.failed) {
    return 'Your session is saved. The ride did not reach your streak this time — "I rode today" on Home adds it.';
  }
  if (!ride.counted) {
    return 'Saved to your diary. A session on another day keeps your streak where it is.';
  }
  const streak =
    ride.streak > 0 ? `Streak held at ${weeklyStreakLabel(ride.streak)}.` : 'Ride saved.';
  if (ride.ridesThisWeek >= ride.target) {
    const rides =
      ride.ridesThisWeek === ride.target && ride.target === 2
        ? 'both rides'
        : `${ride.ridesThisWeek} rides`;
    return `${streak} That is ${rides} this week — target met.`;
  }
  return `${streak} That is ${ride.ridesThisWeek} of ${ride.target} rides this week.`;
}

/** The wall's pips (1g, 2e): the month's sessions solid, then the one refused, dashed. */
export function sessionWallPips(status: SessionQuotaStatus): ('used' | 'free' | 'refused')[] {
  return [...sessionQuotaPips(status), 'refused'];
}

/** The line beside Save once a Rookie is on their last session: "One left this month". */
export function sessionQuotaWarning(status: SessionQuotaStatus | null): string | null {
  return status && status.state === 'warn' ? sessionQuotaLine(status) : null;
}

/** A trick row's second line: "Sometimes · since 25 Aug", "Not tracked yet". */
export function trickStageLine(stage: StageId | null, sinceDay: DayKey | null): string {
  if (!stage) return 'Not tracked yet';
  return sinceDay ? `${STAGE[stage].label} · since ${shortDayMonth(sinceDay)}` : STAGE[stage].label;
}

/** "The riders you ride with. Your default is Only me." */
export function visibilityLine(
  chosen: SessionVisibilityId,
  profileDefault: SessionVisibilityId,
): string {
  const pick = SESSION_VISIBILITIES.find((v) => v.id === chosen);
  const def = SESSION_VISIBILITIES.find((v) => v.id === profileDefault);
  return `${pick?.blurb ?? ''}. Your default is ${def?.label ?? 'Only me'}.`;
}

/* ------------------------------------------------------------- events --- */

export interface EventPlace {
  readonly id: string;
  readonly name: string;
  /** `YYYY-MM-DD…` as PocketBase returns a date. */
  readonly date: string;
  readonly lat: number;
  readonly lng: number;
}

/**
 * How close an event's pin has to be to a spot to count as "on here". Events
 * carry a point, not a spot (`events` has no spot relation), so "at that spot"
 * is a distance. **A tunable default the design does not state**, recorded in
 * plan §7 T38.
 */
export const EVENT_AT_SPOT_KM = 1;

/**
 * The live events on today at a spot, nearest first — the purple "is on here
 * today" band (1c). Both points are ours: a spot's and an event's, never the
 * rider's.
 */
export function eventsAtSpotToday(
  events: readonly EventPlace[],
  spot: { readonly lat: number; readonly lng: number } | null,
  today: DayKey,
  withinKm: number = EVENT_AT_SPOT_KM,
): EventPlace[] {
  if (!spot || !Number.isFinite(spot.lat) || !Number.isFinite(spot.lng)) return [];
  return events
    .filter(
      (e) => e.date.slice(0, 10) === today && Number.isFinite(e.lat) && Number.isFinite(e.lng),
    )
    .map((e) => ({ e, km: distanceKm(spot, e) }))
    .filter(({ km }) => km <= withinKm)
    .sort((a, b) => a.km - b.km)
    .map(({ e }) => e);
}
