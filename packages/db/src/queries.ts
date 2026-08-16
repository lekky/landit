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
  ClipsRecord,
  CrewInvitesRecord,
  CrewMembersRecord,
  EventAttendanceRecord,
  CrewsRecord,
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
  /**
   * Legend flair (plan §2.4) — resolved from the plan record on the server, so
   * what crosses is the cosmetic yes/no and never the plan a rider is on.
   * Cosmetic only: it moves nobody's place on this board.
   */
  readonly flair: boolean;
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

/** The crews a rider belongs to. */
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
/* ------------------------------------------------------------------ crews -- */

/**
 * The crews this rider is in — **all of them, and no others**.
 *
 * There is no filter here and that is the whole point. `crews` has
 * `listRule: member of this crew`, so the collection answers with exactly the
 * caller's crews and a rider who is in none gets an empty list. Plan §6.1 says
 * crews are invite-only with no discovery; the absence of a search parameter on
 * this function is what that sentence looks like in code, and adding one would
 * be adding the discovery surface, not adding a convenience.
 */
export async function listCrews(client: Client): Promise<CrewsRecord[]> {
  return records(client, 'crews').list({ sort: 'created' });
}

/** One crew, or `null` when the caller is not in it (which reads the same). */
export async function getCrew(client: Client, crewId: string): Promise<CrewsRecord | null> {
  return records(client, 'crews').first('id = {:id}', { id: crewId });
}

/** The live invites for a crew. Readable only by that crew's members. */
export async function listCrewInvites(
  client: Client,
  crewId: string,
): Promise<CrewInvitesRecord[]> {
  return records(client, 'crew_invites').list({
    filter: 'crew = {:crew}',
    params: { crew: crewId },
    sort: '-created',
  });
}

/** One item of a crew's activity feed, as the hook route shapes it. */
export interface CrewFeedItem {
  readonly id: string;
  readonly kind: 'stage' | 'sticker';
  /** ISO instant. Formatted by the client, in the rider's own zone. */
  readonly at: string;
  readonly rider: {
    readonly id: string;
    readonly name: string;
    readonly handle: string;
    readonly avatar_key: string;
    readonly flair: boolean;
  };
  readonly stage?: StageId;
  readonly trick?: string;
  readonly sport?: SportId;
  readonly sticker?: string;
  readonly hue?: string;
}

/**
 * A crew's activity, newest first, from `GET /api/landit/crew-feed/{crew}`.
 *
 * A route rather than a collection read for the same reason as the board: the
 * rows behind it are privacy-gated per rider and no client may assemble them.
 * But it is **not** the board's exception to privacy — a `private` rider is on
 * the board and not in the feed. See the route's own comment for why the
 * guarantee stops where it does.
 *
 * Every string in an item is one the product wrote. There is no free text from
 * a rider anywhere in this payload, because there is no rider-to-rider
 * messaging in Land It and a feed that could carry a sentence would be one
 * (plan §6.1).
 */
export async function getCrewFeed(
  client: Client,
  crewId: string,
): Promise<{ crew: string; items: CrewFeedItem[] }> {
  return client.send(`/api/landit/crew-feed/${encodeURIComponent(crewId)}`, { method: 'GET' });
}

/* ------------------------------------------------------------------ clips -- */

/**
 * A rider's clips (T14).
 *
 * Every read below carries the rider's own token and the `clips` rules are
 * owner-only on all four verbs, so "their clips" is enforced by the collection
 * and merely *expressed* by this filter. A caller that passed somebody else's
 * id would get an empty list, not their videos (plan §3, guarantee 2).
 *
 * Newest first: the tile a rider wants is almost always the one they just
 * filmed.
 */
export async function listClips(
  client: Client,
  userId: string,
  options: { readonly trickId?: string } = {},
): Promise<ClipsRecord[]> {
  const filter = options.trickId ? 'user = {:user} && trick = {:trick}' : 'user = {:user}';
  return records(client, 'clips').list({
    filter,
    params: options.trickId ? { user: userId, trick: options.trickId } : { user: userId },
    sort: '-at,-created',
  });
}

/**
 * One clip, or `null`.
 *
 * `null` covers both "no such clip" and "not yours", and the two are
 * deliberately indistinguishable — the collection's owner-only view rule is
 * what makes them so, and a caller that could tell them apart would be a way to
 * probe for other riders' clips (plan §3, guarantee 2).
 */
export async function getClip(client: Client, clipId: string): Promise<ClipsRecord | null> {
  return records(client, 'clips').first('id = {:id}', { id: clipId });
}

export interface ClipVaultUsage {
  /** Bytes stored across every trick, not just the one on screen. */
  readonly bytes: number;
  readonly count: number;
}

/**
 * How full a rider's vault is, summed the same way the upload hook sums it.
 *
 * The hook is the authority — it adds the rider's stored rows at write time and
 * refuses past the cap on its own count (plan §6.6). This exists so the panel
 * can say "1.9GB of 2GB" without asking the server to refuse something first,
 * and it is deliberately the *same* sum so the two never tell a rider different
 * stories.
 */
export async function clipVaultUsage(client: Client, userId: string): Promise<ClipVaultUsage> {
  const clips = await listClips(client, userId);
  return {
    bytes: clips.reduce((total, clip) => total + (clip.size || 0), 0),
    count: clips.length,
  };
}

/**
 * The cap on a rider's plan, in bytes, from the `plans` record.
 *
 * Fails **closed**, exactly as `clipCapBytes` does in the hook: an unknown plan
 * slug, or a `plans` collection nobody has seeded, resolves to no vault rather
 * than to an unlimited one. Never `PLAN[id].clipCapBytes` — that constant seeds
 * the record and staff edit the record afterwards (plan §6.6).
 */
export async function clipCapBytes(client: Client, planSlug: string): Promise<number> {
  const plan = await records(client, 'plans').first('slug = {:slug} && is_live = true', {
    slug: planSlug || 'rookie',
  });
  return plan?.clip_cap_bytes ?? 0;
}

/**
 * The cheapest live plan with a bigger vault than the one given, or `null`.
 *
 * This is what decides whether the at-cap panel offers an upgrade or offers
 * delete-to-make-room (plan §6.6): at the Shredder cap there is a Legend to
 * point at, at the Legend cap there is not, and neither of those sentences
 * names a plan id. Staff adding a tier, or moving a cap, moves the offer with
 * it.
 *
 * Takes the plans it was already given rather than fetching them, so a screen
 * that has read `listPlans` for the rider's own record does not read it twice.
 */
export function nextClipPlan(plans: readonly PlansRecord[], capBytes: number): PlansRecord | null {
  return plans.filter((plan) => (plan.clip_cap_bytes ?? 0) > capBytes)[0] ?? null;
}
