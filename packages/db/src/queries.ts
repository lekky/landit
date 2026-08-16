import type { RiderSnapshot, SportId, StageId, Trick, TrickLogEntry } from '@landit/core';

import type { Client } from './clients';
import { records } from './collections';
import type {
  ChallengesRecord,
  EventsRecord,
  PlansRecord,
  RiderStickersRecord,
  SpotsRecord,
  StickersRecord,
  TrickLogRecord,
  TrickNotesRecord,
  TrickPrereqsRecord,
  TrickProgressRecord,
  TricksRecord,
  UsersRecord,
} from './generated/collections';

/**
 * The reads every screen makes, with the filters written once.
 *
 * Nothing here re-implements a rule. The rules live in `@landit/core` and take
 * plain shapes, so these functions' job is to *assemble* those shapes out of
 * collections — `riderSnapshot` is the clearest case, and the reason this file
 * exists rather than each screen doing its own four queries.
 *
 * None of these functions checks whether the caller may see what it asks for.
 * That is not an omission: the API rules in `pocketbase/migrations/` decide it,
 * and a private profile simply comes back empty. A permission check written
 * here would be a second, weaker copy of a rule that already exists (plan §3).
 */

/* --------------------------------------------------------------- library -- */

export interface TrickFilter {
  /** Omit for every sport. Pass `SPORT_IDS` to be explicit about all of them. */
  readonly sport?: SportId;
  /** Include tricks staff have hidden. Off by default. */
  readonly includeHidden?: boolean;
}

/** The trick library, ordered the way it reads: easiest first, then by name. */
export async function listTricks(
  client: Client,
  filter: TrickFilter = {},
): Promise<TricksRecord[]> {
  const clauses: string[] = [];
  const params: Record<string, string> = {};

  if (!filter.includeHidden) clauses.push('is_live = true');
  if (filter.sport) {
    clauses.push('sport = {:sport}');
    params.sport = filter.sport;
  }

  return records(client, 'tricks').list({
    filter: clauses.join(' && ') || undefined,
    params: Object.keys(params).length ? params : undefined,
    sort: 'diff,name',
  });
}

/** One trick by its slug, or `null`. Slugs are what appear in URLs, not ids. */
export async function getTrickBySlug(client: Client, slug: string): Promise<TricksRecord | null> {
  return records(client, 'tricks').first('slug = {:slug}', { slug });
}

/**
 * Every prerequisite edge. There are fewer than a hundred and the skill tree
 * needs all of them at once, so this is one read rather than one per trick.
 */
export async function listTrickPrereqs(client: Client): Promise<TrickPrereqsRecord[]> {
  return records(client, 'trick_prereqs').list();
}

/**
 * `tricks` rows as the `Trick` shape every rule in `@landit/core` takes.
 *
 * The mapping, not a rule: two columns spell things differently from the
 * canonical shape and this is the one place that knows it.
 *
 * - **`id` is the slug.** The rules, the seeds and the fixtures all key tricks
 *   by slug, exactly as `trickProgressById` does, so a snapshot survives a
 *   reseed and a URL is readable.
 * - **`free_override` is the handoff's nullable `free`.** The empty select
 *   value means "inherit from `diff`", which is `undefined` in the rule shape —
 *   not `false`, which would push every trick in the library onto the paid tier.
 *
 * Passing the result into a rule is what makes a staff edit take effect without
 * a deploy: every function in `@landit/core` takes an optional trick list, and
 * the live rows are what should be handed to it (plan §7, T17).
 */
export function tricksFromRecords(
  tricks: readonly TricksRecord[],
  prereqs: readonly TrickPrereqsRecord[] = [],
): Trick[] {
  const slugOf = new Map(tricks.map((t) => [t.id, t.slug]));

  const pre = new Map<string, string[]>();
  for (const edge of prereqs) {
    const trick = slugOf.get(edge.trick);
    const prereq = slugOf.get(edge.prereq);
    if (!trick || !prereq) continue;
    const list = pre.get(trick);
    if (list) list.push(prereq);
    else pre.set(trick, [prereq]);
  }

  return tricks.map((row) => ({
    id: row.slug,
    name: row.name,
    sport: row.sport,
    cat: row.cat,
    diff: row.diff as Trick['diff'],
    pre: pre.get(row.slug) ?? [],
    about: row.about,
    tips: row.tips,
    fact: row.fact,
    ...(row.free_override ? { free: row.free_override === 'free' } : {}),
    isLive: row.is_live,
  }));
}

/* ---------------------------------------------------------------- riders -- */

/**
 * A rider by handle, or `null` when there is no such rider **or** their privacy
 * hides them. The two are deliberately indistinguishable — see `first`.
 */
export async function getRiderByHandle(
  client: Client,
  handle: string,
): Promise<UsersRecord | null> {
  return records(client, 'users').first('handle = {:handle}', {
    handle: handle.trim().toLowerCase(),
  });
}

export async function getRider(client: Client, id: string): Promise<UsersRecord> {
  return records(client, 'users').get(id);
}

/* -------------------------------------------------------------- progress -- */

/** Every stage this rider has set, as records. `trickProgressById` is usually what you want. */
export async function listTrickProgress(
  client: Client,
  userId: string,
): Promise<TrickProgressRecord[]> {
  return records(client, 'trick_progress').list({
    filter: 'user = {:user}',
    params: { user: userId },
  });
}

/** `trick_progress` flattened into the `byId` map every rule in `@landit/core` takes. */
export function trickProgressById(
  progress: readonly TrickProgressRecord[],
  tricks: readonly TricksRecord[],
): Record<string, StageId> {
  // The rules are keyed by trick *slug* (the canonical data's `id`), not by the
  // database id, so a snapshot survives a reseed.
  const slugOf = new Map(tricks.map((t) => [t.id, t.slug]));
  const byId: Record<string, StageId> = {};
  for (const row of progress) {
    const slug = slugOf.get(row.trick);
    if (slug) byId[slug] = row.stage;
  }
  return byId;
}

/** A rider's log, newest first. */
export async function listTrickLog(client: Client, userId: string): Promise<TrickLogRecord[]> {
  return records(client, 'trick_log').list({
    filter: 'user = {:user}',
    params: { user: userId },
    sort: '-at',
  });
}

/** `trick_log` rows as the shape `@landit/core`'s date rules take. */
export function trickLogEntries(
  log: readonly TrickLogRecord[],
  tricks: readonly TricksRecord[],
): TrickLogEntry[] {
  const slugOf = new Map(tricks.map((t) => [t.id, t.slug]));
  const entries: TrickLogEntry[] = [];
  for (const row of log) {
    const slug = slugOf.get(row.trick);
    if (!slug) continue;
    entries.push({
      trick: slug,
      stage: row.stage,
      at: Date.parse(row.at),
      ...(row.estimated ? { estimated: true } : {}),
    });
  }
  return entries;
}

/** A rider's own notes on a trick, or `null`. Never visible to anyone else (plan §6.1). */
export async function getTrickNote(
  client: Client,
  userId: string,
  trickId: string,
): Promise<TrickNotesRecord | null> {
  return records(client, 'trick_notes').first('user = {:user} && trick = {:trick}', {
    user: userId,
    trick: trickId,
  });
}

/* ------------------------------------------------------------- snapshots -- */

/**
 * Everything `@landit/core`'s rules need about one rider, assembled from the
 * collections in as few round trips as it can be.
 *
 * `streak` is passed through as stored. That is safe **because** the streak is
 * server-owned (issue #8) — but it may still be *stale*, so callers hand it to
 * `currentWeeklyStreak` before believing it, exactly as `RiderSnapshot`'s own
 * documentation says.
 */
export async function riderSnapshot(
  client: Client,
  userId: string,
  tricks?: readonly TricksRecord[],
): Promise<RiderSnapshot> {
  const library = tricks ?? (await listTricks(client));

  const [rider, progress, clips, crews, challengeLog] = await Promise.all([
    getRider(client, userId),
    listTrickProgress(client, userId),
    records(client, 'clips').list({ filter: 'user = {:user}', params: { user: userId } }),
    records(client, 'crew_members').list({ filter: 'user = {:user}', params: { user: userId } }),
    records(client, 'challenge_log').list({
      filter: 'user = {:user}',
      params: { user: userId },
    }),
  ]);

  const challengeLogged: Record<string, number> = {};
  for (const row of challengeLog) {
    challengeLogged[row.challenge] = (challengeLogged[row.challenge] ?? 0) + 1;
  }

  return {
    byId: trickProgressById(progress, library),
    sports: rider.sports,
    streak: rider.streak,
    clips: clips.length,
    crew: crews.length > 0,
    challengeLogged,
  };
}

/* ------------------------------------------------------------- catalogue -- */

/** The live plans, cheapest first. The paywall reads its numbers off these records. */
export async function listPlans(client: Client): Promise<PlansRecord[]> {
  return records(client, 'plans').list({ filter: 'is_live = true', sort: 'clip_cap_bytes' });
}

export async function listStickers(client: Client): Promise<StickersRecord[]> {
  return records(client, 'stickers').list({ filter: 'is_live = true' });
}

/** A rider's earned stickers. Subject to their privacy setting, like everything else. */
export async function listRiderStickers(
  client: Client,
  userId: string,
): Promise<RiderStickersRecord[]> {
  return records(client, 'rider_stickers').list({
    filter: 'user = {:user}',
    params: { user: userId },
    sort: '-earned_at',
  });
}

/**
 * Challenges for a sport, newest first.
 *
 * State (`upcoming`/`live`/`past`) is never stored — derive it with
 * `challengeState` from `@landit/core`, which is the only place that decides.
 */
export async function listChallenges(client: Client, sport?: SportId): Promise<ChallengesRecord[]> {
  return records(client, 'challenges').list({
    filter: sport ? 'sport = {:sport}' : undefined,
    params: sport ? { sport } : undefined,
    sort: '-starts',
  });
}

/** Approved spots only, unless the caller submitted them — that is the API rule, not a choice here. */
export async function listSpots(client: Client, sport?: SportId): Promise<SpotsRecord[]> {
  return records(client, 'spots').list({
    filter: sport ? 'sports ?= {:sport}' : undefined,
    params: sport ? { sport } : undefined,
    sort: 'name',
  });
}

export async function listEvents(client: Client, sport?: SportId): Promise<EventsRecord[]> {
  const clauses = ['is_live = true'];
  if (sport) clauses.push('sports ?= {:sport}');
  return records(client, 'events').list({
    filter: clauses.join(' && '),
    params: sport ? { sport } : undefined,
    sort: 'date',
  });
}
