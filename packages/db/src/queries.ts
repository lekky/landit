import type {
  Challenge,
  LandItEvent,
  RiderSnapshot,
  SportId,
  StageId,
  Trick,
  TrickLogEntry,
} from '@landit/core';

import type { Client } from './clients';
import { records } from './collections';
import type {
  AnnouncementDismissalsRecord,
  AnnouncementsRecord,
  ChallengeLogRecord,
  ChallengesRecord,
  CrewMembersRecord,
  EventAttendanceRecord,
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

  const [rider, progress, clips, crews, challengeLog, challenges] = await Promise.all([
    getRider(client, userId),
    listTrickProgress(client, userId),
    records(client, 'clips').list({ filter: 'user = {:user}', params: { user: userId } }),
    records(client, 'crew_members').list({ filter: 'user = {:user}', params: { user: userId } }),
    records(client, 'challenge_log').list({
      filter: 'user = {:user}',
      params: { user: userId },
    }),
    records(client, 'challenges').list({ fields: 'id,slug' }),
  ]);

  // Keyed by **slug**, because `Challenge.id` is the slug everywhere in
  // `@landit/core` — `computeSportStats` looks up `logged[c.id]` against the
  // canonical records, and the challenge screen looks it up against
  // `challengesFromRecords`. Keyed by database id (as it was until T12) every
  // one of those lookups misses, so a rider's challenge progress read zero no
  // matter how much they had logged and the `challenger` sticker's stats were
  // always empty. The extra read is one narrow request over a table with a
  // dozen rows in it.
  const slugOf = new Map(challenges.map((c) => [c.id, c.slug]));
  const challengeLogged: Record<string, number> = {};
  for (const row of challengeLog) {
    const slug = slugOf.get(row.challenge);
    if (!slug) continue;
    challengeLogged[slug] = (challengeLogged[slug] ?? 0) + 1;
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

/* --------------------------------------------------------- announcements -- */

/**
 * The staff announcements a rider is in the audience for, newest first.
 *
 * Audience is `all`, `plan` or `sport` (plan §3), and the match is made here
 * rather than in a filter string because `audience_sport` compares against the
 * sport a rider is *looking at* — the tab, not the record — and the Home screen
 * changes tabs without a round trip. There are never many live announcements,
 * so this reads the live ones and narrows them in memory.
 *
 * `is_live` is enforced by the collection's list rule too, so a hidden notice is
 * not merely filtered out here — it is not readable at all.
 */
export async function listAnnouncements(client: Client): Promise<AnnouncementsRecord[]> {
  return records(client, 'announcements').list({ filter: 'is_live = true', sort: '-created' });
}

/** The announcements this rider has already tapped "Got it" on. */
export async function listAnnouncementDismissals(
  client: Client,
  userId: string,
): Promise<AnnouncementDismissalsRecord[]> {
  return records(client, 'announcement_dismissals').list({
    filter: 'user = {:user}',
    params: { user: userId },
  });
}

/* ------------------------------------------------------------ crew board -- */

/** One row of the crew board, as the hook route shapes it (plan §3 guarantee 1). */
export interface CrewBoardRider {
  readonly id: string;
  readonly name: string;
  readonly handle: string;
  readonly avatar_key: string;
  readonly streak: number;
  readonly sports: SportId[];
  readonly landed: number;
  readonly role: string;
}

/**
 * The crew board, from `GET /api/landit/crew-board/{crew}`.
 *
 * Not a collection read, and deliberately: guarantee 1 says a private rider
 * still appears on the board by name and score, which no view rule can express.
 * The route builds a fixed field list server-side — this function only carries
 * it, and must never be "improved" into an expanded `crew_members` query, which
 * is exactly the leak the route exists to prevent.
 */
export async function getCrewBoard(
  client: Client,
  crewId: string,
): Promise<{ crew: string; riders: CrewBoardRider[] }> {
  return client.send(`/api/landit/crew-board/${encodeURIComponent(crewId)}`, { method: 'GET' });
}

/** The crews a rider belongs to. Empty until T11 lets anyone join one. */
export async function listCrewMemberships(
  client: Client,
  userId: string,
): Promise<CrewMembersRecord[]> {
  return records(client, 'crew_members').list({
    filter: 'user = {:user}',
    params: { user: userId },
    sort: 'joined',
  });
}

/* ------------------------------------------------ challenges and events -- */

/**
 * `challenges` rows as the `Challenge` shape every rule in `@landit/core`
 * takes. The mapping, not a rule — the same job `tricksFromRecords` does.
 *
 * Two column names differ from the canonical shape and this is the one place
 * that knows it:
 *
 * - **`id` is the slug**, exactly as it is for tricks, so `challengeLogged`,
 *   the seed and the fixtures all key a challenge the same way and a record id
 *   never leaks into a rule.
 * - **`riders_copy` is the handoff's `riders`.** Display copy, not a count.
 *
 * There is no `is_live` column and there should not be: whether a challenge is
 * *running* is derived from its dates and never stored (plan §2.2, §3). Every
 * stored challenge is a real one, so `isLive` is `true` — the flag exists in
 * the shape for the staff "pulled" case the admin portal will need (T17).
 */
export function challengesFromRecords(challenges: readonly ChallengesRecord[]): Challenge[] {
  return challenges.map((row) => ({
    id: row.slug,
    sport: row.sport as SportId,
    week: row.week,
    title: row.title,
    blurb: row.blurb,
    // PocketBase hands a `date` field back as a full datetime; the rules compare
    // calendar days, and a day is what was stored.
    starts: row.starts.slice(0, 10),
    ends: row.ends.slice(0, 10),
    goal: row.goal,
    reward: row.reward,
    hue: row.hue,
    riders: row.riders_copy,
    verb: row.verb,
    isLive: true,
  }));
}

/** `events` rows as the `LandItEvent` shape the rules take. `spots_copy` is `spots`. */
export function eventsFromRecords(events: readonly EventsRecord[]): LandItEvent[] {
  return events.map((row) => ({
    id: row.slug,
    name: row.name,
    kind: row.kind as LandItEvent['kind'],
    town: row.town,
    venue: row.venue,
    date: row.date.slice(0, 10),
    sports: [...row.sports] as SportId[],
    level: row.level,
    price: row.price,
    spots: row.spots_copy,
    blurb: row.blurb,
    isLive: row.is_live,
  }));
}

/**
 * A rider's own challenge log. `challenge_log` is `listRule: OWN`, so this
 * returns nothing for anyone else's id — the rule decides, not this function.
 */
export async function listChallengeLog(
  client: Client,
  userId: string,
): Promise<ChallengeLogRecord[]> {
  return records(client, 'challenge_log').list({
    filter: 'user = {:user}',
    params: { user: userId },
    sort: '-at',
  });
}

/** The events this rider said they are going to. Also `OWN`. */
export async function listEventAttendance(
  client: Client,
  userId: string,
): Promise<EventAttendanceRecord[]> {
  return records(client, 'event_attendance').list({
    filter: 'user = {:user}',
    params: { user: userId },
  });
}

/* --------------------------------------------------------- sticker toast -- */

/**
 * The stickers this rider has earned but never been told about.
 *
 * `rider_stickers.seen_at` is what stops a sticker being announced twice
 * (plan §3): the award hook creates the row with `earned_at` set and `seen_at`
 * empty, the app announces the empty ones, and `markStickerSeen` closes them
 * off. An empty date is `""` in PocketBase, not `null`.
 *
 * Oldest first, so a rider who earns three at once is told about them in the
 * order they were earned rather than backwards.
 */
export async function listUnseenRiderStickers(
  client: Client,
  userId: string,
): Promise<RiderStickersRecord[]> {
  return records(client, 'rider_stickers').list({
    filter: 'user = {:user} && seen_at = ""',
    params: { user: userId },
    sort: 'earned_at',
  });
}
