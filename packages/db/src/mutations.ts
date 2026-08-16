import type { StageId } from '@landit/core';

import type { Client } from './clients';
import { records } from './collections';
import type {
  ChallengeLogRecord,
  EventAttendanceRecord,
  SpotsRecord,
  TrickLogRecord,
  TrickNotesRecord,
  TrickProgressRecord,
  UsersRecord,
} from './generated/collections';

/**
 * The writes a rider makes, with their side effects kept together.
 *
 * Two things are deliberately *not* here, and both for the same reason: they
 * are not a rider's to write.
 *
 * - **Stickers.** `rider_stickers` has `createRule: null` — the award hook
 *   creates them and nothing else can. There is no `awardSticker` in this file
 *   because there is no client path to one, which is what makes "achievements
 *   are never for sale" true rather than merely stated (plan §1, §3).
 * - **The weekly streak.** `users.streak` and the rest of the tuple are
 *   server-owned (issue #8), so "I rode today" is a server route that runs
 *   `logWeeklyRide` and writes the result — not a PATCH from a screen. T8 owns
 *   that route.
 *
 * The paywall is likewise absent: `setTrickStage` does not check whether a
 * trick is paid. The hook does, on every write path including a superuser one,
 * and a check here would be a weaker second copy of it (plan §3 guarantee 3).
 * A refused write surfaces as a 403 — see `isForbidden`.
 */

/* -------------------------------------------------------------- progress -- */

export interface StageChange {
  readonly progress: TrickProgressRecord;
  /** The log row this wrote, or `null` when the stage did not actually move. */
  readonly logged: TrickLogRecord | null;
}

/**
 * Set a rider's stage on a trick, and log it.
 *
 * `trick_progress` is the current stage; `trick_log` is the history the dates
 * and the stats are derived from (plan §3, "log semantics, reconciled"). Both
 * have to move together, and re-setting the stage a rider is already on writes
 * nothing — otherwise a rider tapping the same stage twice would log two
 * landings and inflate their own history.
 *
 * PocketBase has no transactions across two HTTP calls. The order is chosen so
 * the failure mode is harmless: progress first, then the log. A log row without
 * progress would be history for a stage the rider is not on; progress without a
 * log row is simply a landing whose date we do not know, which the UI already
 * handles because backfilled dates are a normal case.
 */
export async function setTrickStage(
  client: Client,
  input: { userId: string; trickId: string; stage: StageId; at?: Date },
): Promise<StageChange> {
  const { userId, trickId, stage } = input;
  const at = input.at ?? new Date();

  const existing = await records(client, 'trick_progress').first(
    'user = {:user} && trick = {:trick}',
    { user: userId, trick: trickId },
  );

  if (existing?.stage === stage) {
    return { progress: existing, logged: null };
  }

  const progress = existing
    ? await records(client, 'trick_progress').update(existing.id, { stage })
    : await records(client, 'trick_progress').create({ user: userId, trick: trickId, stage });

  const logged = await records(client, 'trick_log').create({
    user: userId,
    trick: trickId,
    stage,
    at: at.toISOString(),
  });

  return { progress, logged };
}

/**
 * Stop tracking a trick entirely.
 *
 * The log rows stay. A rider who untracks a trick has not un-landed it, and
 * deleting the history would silently rewrite every stat derived from it — if
 * they want the history gone they delete the log rows, which they may.
 */
export async function clearTrickStage(
  client: Client,
  userId: string,
  trickId: string,
): Promise<void> {
  const existing = await records(client, 'trick_progress').first(
    'user = {:user} && trick = {:trick}',
    { user: userId, trick: trickId },
  );
  if (existing) await records(client, 'trick_progress').remove(existing.id);
}

/** Delete one log row. Every derived date recomputes from what remains. */
export async function deleteLogEntry(client: Client, logId: string): Promise<void> {
  await records(client, 'trick_log').remove(logId);
}

/* ----------------------------------------------------------------- notes -- */

/** A rider's private notebook on one trick. One row per rider per trick. */
export async function saveTrickNote(
  client: Client,
  input: { userId: string; trickId: string; body: string },
): Promise<TrickNotesRecord> {
  const existing = await records(client, 'trick_notes').first(
    'user = {:user} && trick = {:trick}',
    { user: input.userId, trick: input.trickId },
  );

  return existing
    ? records(client, 'trick_notes').update(existing.id, { body: input.body })
    : records(client, 'trick_notes').create({
        user: input.userId,
        trick: input.trickId,
        body: input.body,
      });
}

/* --------------------------------------------------------------- profile -- */

/**
 * The profile fields a rider owns.
 *
 * The type is narrowed on purpose. `plan`, `role`, `consent_state`,
 * `suspended`, the age fields and the whole streak tuple are all refused by the
 * guard hook, so offering them here would only produce a 403 at runtime — this
 * way it does not compile.
 */
export type ProfileEdit = Partial<
  Pick<
    UsersRecord,
    | 'name'
    | 'handle'
    | 'town'
    | 'stance'
    | 'level'
    | 'goal'
    | 'goal_custom'
    | 'avatar_key'
    | 'privacy'
    | 'sports'
    | 'timezone'
    | 'onboarded'
  >
>;

export async function updateProfile(
  client: Client,
  userId: string,
  edit: ProfileEdit,
): Promise<UsersRecord> {
  return records(client, 'users').update(userId, edit);
}

/**
 * Turn the progress insights panel on or off for this rider (plan §2.4, §6.4).
 *
 * Deliberately not part of `ProfileEdit`: this is a consent to profiling, not a
 * profile detail, and the two should never be carried by the same form or the
 * same call. Off is always accepted; on is refused with a 403 unless the
 * rider's plan record carries the entitlement — the hook decides that, reading
 * our own `plans` record, and nothing here re-checks it (plan §3).
 */
export async function setInsightsOptIn(
  client: Client,
  userId: string,
  optedIn: boolean,
): Promise<UsersRecord> {
  return records(client, 'users').update(userId, { insights_opt_in: optedIn });
}

/* ------------------------------------------------------------ challenges -- */

/** Log one entry against a challenge. Progress is the count of these rows. */
export async function logChallengeEntry(
  client: Client,
  input: { userId: string; challengeId: string; at?: Date },
): Promise<ChallengeLogRecord> {
  return records(client, 'challenge_log').create({
    user: input.userId,
    challenge: input.challengeId,
    at: (input.at ?? new Date()).toISOString(),
  });
}

/* ----------------------------------------------------------------- spots -- */

/**
 * Submit a spot. It arrives `pending` and reaches nobody until a human
 * approves it (plan §6.1) — the status is pinned here so a caller cannot ask
 * for `live`, and the API rules refuse it anyway.
 */
export async function submitSpot(
  client: Client,
  input: {
    userId: string;
    name: string;
    town?: string;
    type?: string;
    lat?: number;
    lng?: number;
    sports?: readonly SpotsRecord['sports'][number][];
    tags?: readonly string[];
  },
): Promise<SpotsRecord> {
  return records(client, 'spots').create({
    name: input.name,
    town: input.town ?? '',
    type: input.type ?? '',
    ...(input.lat === undefined ? {} : { lat: input.lat }),
    ...(input.lng === undefined ? {} : { lng: input.lng }),
    ...(input.sports ? { sports: [...input.sports] } : {}),
    ...(input.tags ? { tags: [...input.tags] } : {}),
    status: 'pending',
    submitted_by: input.userId,
  });
}

/* ---------------------------------------------------------------- events -- */

export async function attendEvent(
  client: Client,
  userId: string,
  eventId: string,
): Promise<EventAttendanceRecord> {
  return records(client, 'event_attendance').create({ user: userId, event: eventId });
}

export async function unattendEvent(
  client: Client,
  userId: string,
  eventId: string,
): Promise<void> {
  const existing = await records(client, 'event_attendance').first(
    'user = {:user} && event = {:event}',
    { user: userId, event: eventId },
  );
  if (existing) await records(client, 'event_attendance').remove(existing.id);
}
