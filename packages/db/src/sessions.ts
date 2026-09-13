import {
  DEFAULT_TIMEZONE,
  SESSION_REFUSALS,
  groupSessionsByMonth,
  isClipLink,
  isSessionDuration,
  isSessionFeel,
  isSessionWeather,
  logWeeklyRide,
  normaliseSessionVisibility,
  riderMonthKey,
  sessionCountsAsRideToday,
  sessionQuotaStatus,
  type ClipLink,
  type Instant,
  type RideSession,
  type SessionAllowance,
  type SessionDurationMinutes,
  type SessionFeelId,
  type SessionMonthGroup,
  type SessionQuotaStatus,
  type SessionTrickEntry,
  type SessionVisibilityId,
  type SessionWeatherId,
  type SportId,
  type StageId,
  type WeeklyRideResult,
} from '@landit/core';

import type { Client } from './clients';
import { isNotFound, records, refusalMessage, type FilterParams, type Page } from './collections';
import type {
  PlansRecord,
  SessionTricksRecord,
  SessionsRecord,
  UsersRecord,
} from './generated/collections';
import { saveWeeklyStreak } from './mutations';

/**
 * Sessions (T36) — the typed reads and writes T37–T40 build on.
 *
 * **Which client to hold.** Every read here goes through the PocketBase API, so
 * the collection rules and `66_sessions.pb.js`'s enrich hook apply to whatever
 * client is passed:
 *
 * - With the **rider's own client** (`createServerClient` with their cookie),
 *   the `listOwn…` / `…ForOwner` reads return the rider's own sessions in full.
 * - With **another rider's or a signed-out client**, the same functions return
 *   only what that viewer may see — the stricter of session and profile (D2),
 *   nothing from a consent-limited owner (G4) — and each session's `crewIds` is
 *   **already stripped** to the crew-mates whose profiles that viewer could
 *   open (D3). No screen needs to filter tagged riders itself, and none should
 *   try: the server is the boundary.
 * - **Never read a session with the superuser client for display.** It bypasses
 *   both the rules and the strip, and would show another rider everything.
 *
 * The one write that needs the superuser client is `logSession`'s ride half,
 * for the reason `saveWeeklyStreak` gives: the streak tuple is server-owned.
 *
 * This package holds no rules. Visibility, the quota, the clip grammar and the
 * stage promotion are `@landit/core` (defined) and `pocketbase/` (enforced).
 */

/* ------------------------------------------------------------- mapping --- */

const SORT_NEWEST = '-started_at,-created';

function trickEntryFrom(row: SessionTricksRecord): SessionTrickEntry {
  const from = String(row.stage_from || '') as StageId | '';
  const to = String(row.stage_to || '') as StageId | '';
  return {
    trickId: row.trick,
    landed: row.landed === true,
    ...(to ? { stageFrom: from || null, stageTo: to } : {}),
  };
}

function clipFrom(row: SessionsRecord): ClipLink | undefined {
  const clip = { platform: String(row.clip_platform || ''), id: String(row.clip_id || '') };
  return isClipLink(clip) ? clip : undefined;
}

/**
 * One `sessions` row, plus its `session_tricks` rows, as core's `RideSession`.
 *
 * Read fail-closed where a value could be wrong: an unrecognised visibility is
 * `private`, a clip that is not a well-formed `{ platform, id }` is dropped
 * rather than rendered, and a duration outside the four chips reads as the
 * nearest honest chip (60) rather than as a number no label exists for.
 * `monthKey` and `graceUsed` are empty to anybody but the owner — the enrich
 * hook hides them.
 */
export function sessionFromRecord(
  row: SessionsRecord,
  entries: readonly SessionTricksRecord[] = [],
): RideSession {
  const duration = Number(row.duration_minutes);
  const weather = String(row.weather || '');
  const clip = clipFrom(row);
  return {
    id: row.id,
    userId: row.user,
    startedAt: row.started_at,
    durationMinutes: (isSessionDuration(duration) ? duration : 60) as SessionDurationMinutes,
    sport: row.sport as SportId,
    spotId: row.spot || '',
    ...(row.event ? { eventId: row.event } : {}),
    ...(row.aim ? { aim: row.aim } : {}),
    feel: (isSessionFeel(row.feel) ? row.feel : 'fine') as SessionFeelId,
    ...(isSessionWeather(weather) ? { weather: weather as SessionWeatherId } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
    crewIds: Array.isArray(row.rode_with) ? [...row.rode_with] : [],
    ...(clip ? { clip } : {}),
    visibility: normaliseSessionVisibility(row.visibility),
    trickEntries: entries.filter((e) => e.session === row.id).map(trickEntryFrom),
    monthKey: typeof row.month_key === 'string' ? row.month_key : '',
    graceUsed: row.grace === true,
    created: row.created,
  };
}

/** Many rows at once. `entries` may hold entries for any of them. */
export function sessionsFromRecords(
  rows: readonly SessionsRecord[],
  entries: readonly SessionTricksRecord[] = [],
): RideSession[] {
  return rows.map((row) => sessionFromRecord(row, entries));
}

/** A parameterised `id = {:i0} || id = {:i1} …` over a list of ids. */
function anyOf(field: string, ids: readonly string[]): { filter: string; params: FilterParams } {
  const params: FilterParams = {};
  const parts = ids.map((id, i) => {
    params[`i${i}`] = id;
    return `${field} = {:i${i}}`;
  });
  return { filter: parts.length ? `(${parts.join(' || ')})` : "id = ''", params };
}

async function entriesFor(
  client: Client,
  sessionIds: readonly string[],
): Promise<SessionTricksRecord[]> {
  if (!sessionIds.length) return [];
  const { filter, params } = anyOf('session', sessionIds);
  return records(client, 'session_tricks').list({ filter, params, sort: 'created' });
}

/* -------------------------------------------------------------- reads ---- */

/** The Sessions tab's filters: All / a sport / At an event. */
export interface SessionListQuery {
  readonly userId: string;
  readonly sport?: SportId | null;
  readonly atEvent?: boolean;
  readonly page?: number;
  /** Defaults to core's `SESSIONS_PER_PAGE` (3) on the feed; pass more for the list. */
  readonly perPage?: number;
}

function listFilter(query: { userId: string; sport?: SportId | null; atEvent?: boolean }): {
  filter: string;
  params: FilterParams;
} {
  const parts = ['user = {:user}'];
  const params: FilterParams = { user: query.userId };
  if (query.sport) {
    parts.push('sport = {:sport}');
    params.sport = query.sport;
  }
  if (query.atEvent) parts.push("event != ''");
  return { filter: parts.join(' && '), params };
}

/**
 * One page of a rider's sessions, newest first, with their trick entries.
 * The feed (1a/2a) and the desktop table (1b).
 */
export async function listOwnSessions(
  client: Client,
  query: SessionListQuery,
): Promise<Page<RideSession>> {
  const { filter, params } = listFilter(query);
  const page = await records(client, 'sessions').page({
    filter,
    params,
    sort: SORT_NEWEST,
    page: query.page ?? 1,
    perPage: query.perPage ?? 3,
  });
  const entries = await entriesFor(
    client,
    page.items.map((row) => row.id),
  );
  return { ...page, items: sessionsFromRecords(page.items, entries) };
}

/**
 * Every session a rider has, newest first, with trick entries — for the month
 * accordions, the sidebar summaries and "what this one changed", which all
 * need the whole diary. Two requests however long the diary is.
 */
export async function listAllOwnSessions(
  client: Client,
  query: { userId: string; sport?: SportId | null; atEvent?: boolean },
): Promise<RideSession[]> {
  const { filter, params } = listFilter(query);
  const [rows, entries] = await Promise.all([
    records(client, 'sessions').list({ filter, params, sort: SORT_NEWEST }),
    records(client, 'session_tricks').list({
      filter: 'user = {:user}',
      params: { user: query.userId },
      sort: 'created',
    }),
  ]);
  return sessionsFromRecords(rows, entries);
}

/** The phone month accordions (2b): sessions grouped by the month ridden. */
export async function listSessionMonths(
  client: Client,
  query: { userId: string; timezone?: string; sport?: SportId | null; atEvent?: boolean },
): Promise<SessionMonthGroup<RideSession>[]> {
  const sessions = await listAllOwnSessions(client, query);
  return groupSessionsByMonth(sessions, query.timezone || DEFAULT_TIMEZONE);
}

/** One session for the detail page (1e/2c). */
export interface SessionDetail {
  readonly session: RideSession;
  /** The next newer session by the same rider that this client may see. */
  readonly newerId: string | null;
  /** The next older one. */
  readonly olderId: string | null;
}

/**
 * One session, with its newer and older neighbours for the pager — or `null`
 * when there is no such session **or this client may not see it**. The two are
 * deliberately indistinguishable (see `records().first`).
 */
export async function getSession(client: Client, id: string): Promise<SessionDetail | null> {
  let row: SessionsRecord;
  try {
    row = await records(client, 'sessions').get(id);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
  const [entries, newer, older] = await Promise.all([
    entriesFor(client, [row.id]),
    records(client, 'sessions').first(
      'user = {:user} && started_at > {:at}',
      { user: row.user, at: row.started_at },
      { sort: 'started_at', fields: 'id' },
    ),
    records(client, 'sessions').first(
      'user = {:user} && started_at < {:at}',
      { user: row.user, at: row.started_at },
      { sort: '-started_at', fields: 'id' },
    ),
  ]);
  return {
    session: sessionFromRecord(row, entries),
    newerId: newer?.id ?? null,
    olderId: older?.id ?? null,
  };
}

/**
 * The rider's own sessions at a spot, newest first — the spot page block (1f).
 * **Own only**, by the filter: the block never shows anybody else's sessions
 * at a place, which is the design's stance and §6.1's.
 */
export async function listSessionsAtSpotForOwner(
  client: Client,
  query: { userId: string; spotId: string },
): Promise<RideSession[]> {
  const rows = await records(client, 'sessions').list({
    filter: 'user = {:user} && spot = {:spot}',
    params: { user: query.userId, spot: query.spotId },
    sort: SORT_NEWEST,
  });
  return sessionsFromRecords(
    rows,
    await entriesFor(
      client,
      rows.map((r) => r.id),
    ),
  );
}

/** The rider's own sessions at an event, newest first — the event page block. */
export async function listSessionsAtEventForOwner(
  client: Client,
  query: { userId: string; eventId: string },
): Promise<RideSession[]> {
  const rows = await records(client, 'sessions').list({
    filter: 'user = {:user} && event = {:event}',
    params: { user: query.userId, event: query.eventId },
    sort: SORT_NEWEST,
  });
  return sessionsFromRecords(
    rows,
    await entriesFor(
      client,
      rows.map((r) => r.id),
    ),
  );
}

/** The rider's own sessions that worked a trick, newest first — the trick page block. */
export async function listSessionsForTrickForOwner(
  client: Client,
  query: { userId: string; trickId: string },
): Promise<RideSession[]> {
  const worked = await records(client, 'session_tricks').list({
    filter: 'user = {:user} && trick = {:trick}',
    params: { user: query.userId, trick: query.trickId },
    fields: 'session',
  });
  const ids = [...new Set(worked.map((e) => e.session))];
  if (!ids.length) return [];
  const { filter, params } = anyOf('id', ids);
  const rows = await records(client, 'sessions').list({
    filter: `user = {:user} && ${filter}`,
    params: { ...params, user: query.userId },
    sort: SORT_NEWEST,
  });
  return sessionsFromRecords(
    rows,
    await entriesFor(
      client,
      rows.map((r) => r.id),
    ),
  );
}

/** A plan record's monthly session allowance. `null` grants none. */
export function sessionAllowanceFromRecord(plan: PlansRecord | null | undefined): SessionAllowance {
  if (!plan) return { cap: 0, unlimited: false };
  const cap = Math.trunc(Number(plan.session_month_cap) || 0);
  return { cap: Math.max(0, cap), unlimited: plan.sessions_unlimited === true };
}

/** A plan record's session clip allowance. `null` grants none. */
export function sessionClipAllowanceFromRecord(
  plan: PlansRecord | null | undefined,
): SessionAllowance {
  if (!plan) return { cap: 0, unlimited: false };
  const cap = Math.trunc(Number(plan.session_clip_cap) || 0);
  return { cap: Math.max(0, cap), unlimited: plan.session_clips_unlimited === true };
}

/** Where the rider stands this month, plus the month it was counted in. */
export interface SessionQuota extends SessionQuotaStatus {
  readonly monthKey: string;
}

/**
 * The rider's quota for the sidebar pips, the warn line and the wall (D6).
 * Read with the rider's own client. **For drawing, not deciding**: the hook
 * counts again at the moment of the write.
 */
export async function getSessionQuota(
  client: Client,
  query: { userId: string; plan: PlansRecord | null; timezone?: string; now?: Instant },
): Promise<SessionQuota> {
  const monthKey = riderMonthKey({
    now: query.now,
    timezone: query.timezone || DEFAULT_TIMEZONE,
  });
  const [used, grace] = await Promise.all([
    records(client, 'sessions').list({
      filter: 'user = {:user} && month_key = {:month}',
      params: { user: query.userId, month: monthKey },
      fields: 'id',
    }),
    records(client, 'session_grace').list({
      filter: 'user = {:user}',
      params: { user: query.userId },
      fields: 'id',
    }),
  ]);
  return {
    ...sessionQuotaStatus(sessionAllowanceFromRecord(query.plan), {
      usedThisMonth: used.length,
      graceUsed: grace.length > 0,
    }),
    monthKey,
  };
}

/** How many session clips the rider holds — for "3 of 10", not for deciding. */
export async function countSessionClips(client: Client, userId: string): Promise<number> {
  const rows = await records(client, 'sessions').list({
    filter: "user = {:user} && clip_id != ''",
    params: { user: userId },
    fields: 'id',
  });
  return rows.length;
}

/* ------------------------------------------------------------- writes ---- */

/** What the form sends. Every field the hook re-checks. */
export interface SessionInput {
  readonly startedAt: Instant;
  readonly durationMinutes: SessionDurationMinutes;
  readonly sport: SportId;
  readonly spotId: string;
  readonly eventId?: string | null;
  readonly aim?: string;
  readonly feel: SessionFeelId;
  readonly weather?: SessionWeatherId | null;
  readonly notes?: string;
  /** Crew-mates. Anybody else is refused by the hook. */
  readonly crewIds?: readonly string[];
  /**
   * **The clip box, exactly as the rider pasted it** — or `''` to remove a
   * clip. Parsed server-side; the stored value is `{ platform, id }`. Do not
   * pre-parse and send an id: a bare id is refused, on purpose (D4).
   */
  readonly clip?: string;
  /** Defaults to `private` when omitted; pass the profile default from the form. */
  readonly visibility?: SessionVisibilityId;
  readonly tricks?: readonly { trickId: string; landed: boolean }[];
}

function toIso(instant: Instant): string {
  const date = instant instanceof Date ? instant : new Date(instant);
  return date.toISOString();
}

/**
 * Create a session and its trick entries, as the rider.
 *
 * `month_key` is computed here, on the rider's clock (the hook cannot — goja has
 * no `Intl`), and bounds-checked there. `useGrace` asks for the once-per-account
 * grace; it is only spent when the month is full.
 *
 * Entries are written one at a time after the session, because each one can
 * promote a stage and the hook needs the session to exist. A refused entry (a
 * paid trick on Rookie) throws after the session is saved — the session stands
 * and the caller can say which trick was refused.
 */
export async function createSession(
  client: Client,
  query: {
    userId: string;
    input: SessionInput;
    timezone?: string;
    now?: Instant;
    useGrace?: boolean;
  },
): Promise<RideSession> {
  const { input } = query;
  const row = await records(client, 'sessions').create({
    user: query.userId,
    started_at: toIso(input.startedAt),
    duration_minutes: input.durationMinutes,
    sport: input.sport,
    spot: input.spotId,
    ...(input.eventId ? { event: input.eventId } : {}),
    aim: input.aim ?? '',
    feel: input.feel,
    ...(input.weather ? { weather: input.weather } : {}),
    notes: input.notes ?? '',
    rode_with: [...(input.crewIds ?? [])],
    clip_id: input.clip ?? '',
    visibility: input.visibility ?? 'private',
    month_key: riderMonthKey({ now: query.now, timezone: query.timezone || DEFAULT_TIMEZONE }),
    grace: query.useGrace === true,
  } as Parameters<ReturnType<typeof records<'sessions'>>['create']>[0]);

  const entries: SessionTricksRecord[] = [];
  for (const trick of input.tricks ?? []) {
    entries.push(
      await records(client, 'session_tricks').create({
        session: row.id,
        user: query.userId,
        trick: trick.trickId,
        landed: trick.landed,
      } as Parameters<ReturnType<typeof records<'session_tricks'>>['create']>[0]),
    );
  }
  return sessionFromRecord(row, entries);
}

/** Why a session was not saved, in a shape a screen can branch on. */
export interface SessionRefusal {
  /**
   * - `quota` — the month is full: show the wall, offer the grace.
   * - `grace_used` — the grace was asked for and is already spent.
   * - `clip` — the plan holds no more clips (or none at all): show the lock.
   * - `other` — anything else the server refused, with its sentence.
   */
  readonly kind: 'quota' | 'grace_used' | 'clip' | 'other';
  /** The server's sentence, which is written for a rider. */
  readonly message: string | null;
  readonly status: number;
}

/** What `logSession` did, in order. */
export interface LogSessionResult {
  readonly ride: {
    /** The session is on the rider's today, so it counts as today's ride (D6). */
    readonly counted: boolean;
    /** This call recorded a new ride. `false` when the rider had already ridden today. */
    readonly changed: boolean;
    /** The streak after the ride, for the saved-state copy. `null` when not counted. */
    readonly result: WeeklyRideResult | null;
    /** The ride could not be written — no superuser client, or the write failed. */
    readonly failed: boolean;
  };
  /** The saved session, or `null` when it was refused. */
  readonly session: RideSession | null;
  readonly refusal: SessionRefusal | null;
}

function statusOf(error: unknown): number {
  return typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status: unknown }).status)
    : 0;
}

/**
 * **Log a session, and save the ride first** (D6: the ride and the streak
 * always save, even when the session is refused).
 *
 * 1. If the session is on the rider's today, run `logWeeklyRide` and write the
 *    result with the superuser client — the same rule and write as "I rode
 *    today", so a tap and a session on the same day are one ride
 *    (`logWeeklyRide` is idempotent on the day). A session backfilled to
 *    another day moves no streak (`sessionCountsAsRideToday`).
 * 2. Then create the session with the rider's client, which is where the quota,
 *    the clip allowance and everything else are refused.
 *
 * A refusal comes back as `refusal`, never thrown, so the saved-state screen can
 * say "your ride is saved" and show the wall in the same breath. Anything that
 * is not a server refusal (a network failure) is thrown.
 *
 * `superuser` may be `null` where the credential is not configured; the ride is
 * then reported `failed` and the session is still attempted.
 */
export async function logSession(args: {
  client: Client;
  superuser: Client | null;
  rider: UsersRecord;
  input: SessionInput;
  useGrace?: boolean;
  now?: Instant;
}): Promise<LogSessionResult> {
  const { rider, input } = args;
  const timezone = rider.timezone || DEFAULT_TIMEZONE;
  const now = args.now ?? Date.now();

  const counted = sessionCountsAsRideToday(input.startedAt, { now, timezone });
  let result: WeeklyRideResult | null = null;
  let failed = false;
  if (counted) {
    result = logWeeklyRide(
      {
        streak: rider.streak ?? 0,
        lastQualifyingWeek: rider.last_qualifying_week || null,
        weekStart: rider.week_start || null,
        ridesThisWeek: rider.rides_this_week ?? 0,
        lastRide: rider.last_ride || null,
      },
      { now, timezone },
    );
    if (result.changed) {
      if (!args.superuser) {
        failed = true;
      } else {
        try {
          await saveWeeklyStreak(args.superuser, rider.id, {
            streak: result.streak,
            week_start: result.weekStart,
            rides_this_week: result.ridesThisWeek,
            last_qualifying_week: result.lastQualifyingWeek ?? '',
            // Midday, as the home action writes it: a day key at 00:00 UTC is
            // the previous day west of Greenwich.
            last_ride: `${result.lastRide} 12:00:00.000Z`,
          });
        } catch {
          failed = true;
        }
      }
    }
  }
  const ride = { counted, changed: Boolean(result?.changed) && !failed, result, failed };

  try {
    const session = await createSession(args.client, {
      userId: rider.id,
      input,
      timezone,
      now,
      useGrace: args.useGrace,
    });
    return { ride, session, refusal: null };
  } catch (error) {
    const status = statusOf(error);
    if (status !== 400 && status !== 403) throw error;
    const message = refusalMessage(error);
    const kind: SessionRefusal['kind'] =
      message === SESSION_REFUSALS.quotaFull
        ? 'quota'
        : message === SESSION_REFUSALS.graceUsed
          ? 'grace_used'
          : message === SESSION_REFUSALS.clipNotOnPlan || message === SESSION_REFUSALS.clipCap
            ? 'clip'
            : 'other';
    return { ride, session: null, refusal: { kind, message, status } };
  }
}

/** A partial edit. Omitted fields are left as they are. */
export type SessionPatch = Partial<SessionInput>;

/**
 * Edit a session (2g edit mode), including its trick entries when `tricks` is
 * given: new entries are added, changed `landed` flags are saved, and entries
 * no longer listed are removed.
 *
 * **Nothing here can demote a stage.** Unticking "Landed it" or removing an
 * entry leaves the trick where the landing put it — the hook never writes a
 * lower stage back, and this function never writes `trick_progress` at all.
 */
export async function updateSession(
  client: Client,
  sessionId: string,
  patch: SessionPatch,
): Promise<RideSession> {
  const body: Record<string, unknown> = {};
  if (patch.startedAt !== undefined) body.started_at = toIso(patch.startedAt);
  if (patch.durationMinutes !== undefined) body.duration_minutes = patch.durationMinutes;
  if (patch.sport !== undefined) body.sport = patch.sport;
  if (patch.spotId !== undefined) body.spot = patch.spotId;
  if (patch.eventId !== undefined) body.event = patch.eventId ?? '';
  if (patch.aim !== undefined) body.aim = patch.aim;
  if (patch.feel !== undefined) body.feel = patch.feel;
  if (patch.weather !== undefined) body.weather = patch.weather ?? '';
  if (patch.notes !== undefined) body.notes = patch.notes;
  if (patch.crewIds !== undefined) body.rode_with = [...patch.crewIds];
  if (patch.clip !== undefined) body.clip_id = patch.clip;
  if (patch.visibility !== undefined) body.visibility = patch.visibility;

  const row = Object.keys(body).length
    ? await records(client, 'sessions').update(sessionId, body)
    : await records(client, 'sessions').get(sessionId);

  if (patch.tricks !== undefined) {
    const existing = await entriesFor(client, [sessionId]);
    const wanted = new Map(patch.tricks.map((t) => [t.trickId, t.landed]));
    for (const entry of existing) {
      if (!wanted.has(entry.trick)) {
        await records(client, 'session_tricks').remove(entry.id);
      } else if (wanted.get(entry.trick) !== entry.landed) {
        await records(client, 'session_tricks').update(entry.id, {
          landed: wanted.get(entry.trick),
        });
      }
    }
    const have = new Set(existing.map((e) => e.trick));
    for (const [trickId, landed] of wanted) {
      if (have.has(trickId)) continue;
      await records(client, 'session_tricks').create({
        session: sessionId,
        user: row.user,
        trick: trickId,
        landed,
      } as Parameters<ReturnType<typeof records<'session_tricks'>>['create']>[0]);
    }
  }

  return sessionFromRecord(row, await entriesFor(client, [sessionId]));
}

/** Change who can see one session. */
export async function setSessionVisibility(
  client: Client,
  sessionId: string,
  visibility: SessionVisibilityId,
): Promise<RideSession> {
  const row = await records(client, 'sessions').update(sessionId, { visibility });
  return sessionFromRecord(row, await entriesFor(client, [sessionId]));
}

/**
 * Delete a session. Its trick entries go with it (cascade); **the stages they
 * moved stay** — "tricks you moved up stay where they are" (delete confirm).
 * It does not refund the month either: the quota counts sessions logged, and
 * the grace row, if this session spent it, is kept.
 */
export async function deleteSession(client: Client, sessionId: string): Promise<void> {
  await records(client, 'sessions').remove(sessionId);
}

/** Settings · sessions: who sees new sessions (D2). */
export async function setSessionVisibilityDefault(
  client: Client,
  userId: string,
  visibility: SessionVisibilityId,
): Promise<UsersRecord> {
  return records(client, 'users').update(userId, { session_visibility_default: visibility });
}
