import {
  CHALLENGES,
  EVENTS,
  PLANS,
  SPORT_IDS,
  SPOTS,
  STICKERS,
  TRICKS,
  TRICK_PREREQS,
  type Plan,
  type Sticker,
  type Trick,
} from '@landit/core';

import type { Client } from './clients';
import { records } from './collections';
import type { CollectionName } from './generated/collections';

/**
 * Seeding: the canonical data in `@landit/core`, loaded into PocketBase.
 *
 * `@landit/core/data` is the single source for both this and the rules' test
 * fixtures (plan §7, T1), so there is no second transcription of the trick
 * library here — only the mapping from the canonical shape onto the column
 * names the collections use.
 *
 * **Nothing here enumerates sports.** The seed iterates the data and writes
 * whatever sport it finds, so the BMX library seeds itself the moment T21 adds
 * it to `TRICKS` (plan §7 ground rules, "three sports, not two"). What T21 will
 * still have to do is widen the `select` field values in the migrations —
 * `assertSportsAccepted` below turns that into a clear failure rather than a
 * confusing 400.
 *
 * **Idempotent.** Every record is matched on its natural key and updated in
 * place, so running the seed twice is the same as running it once, and running
 * it against a database riders already use does not orphan their progress:
 * `trick_progress` relates to the trick *record*, and the record keeps its id.
 */

/* ------------------------------------------------------------- the plan -- */

/** One collection's worth of seed records, with the key that identifies each. */
export interface SeedTable {
  readonly collection: CollectionName;
  /** Fields forming the natural key, matched to decide insert vs update. */
  readonly key: readonly string[];
  readonly rows: readonly Record<string, unknown>[];
}

export interface SeedPlan {
  readonly tables: readonly SeedTable[];
}

/** Money is stored in pence and displayed as text, so the seed formats it once. */
function money(pence: number): string {
  if (pence <= 0) return 'Free';
  return `£${(pence / 100).toFixed(2)}`;
}

/**
 * The canonical data as records, ready to write. Pure — no client, no I/O — so
 * the mapping can be unit-tested without a database.
 */
export function buildSeed(): SeedPlan {
  return {
    tables: [
      {
        collection: 'plans',
        key: ['slug'],
        rows: (PLANS as readonly Plan[]).map((plan) => ({
          slug: plan.id,
          name: plan.name,
          price_monthly: money(plan.priceMonthlyPence),
          price_yearly: money(plan.priceYearlyPence),
          // The prototype's "per rider, per month" strapline has no canonical
          // source and T15 owns the plans-page wording. Left empty rather than
          // invented here, where it would quietly become the copy.
          per: '',
          hue: plan.hue,
          pitch: plan.pitch,
          perks: [...plan.perks],
          missing: [...plan.missing],
          popular: plan.popular === true,
          unlocks_paid_tricks: plan.unlocksPaidTricks,
          clip_cap_bytes: plan.clipCapBytes,
          is_live: true,
        })),
      },
      {
        collection: 'tricks',
        key: ['slug'],
        rows: (TRICKS as readonly Trick[]).map((trick) => ({
          slug: trick.id,
          name: trick.name,
          sport: trick.sport,
          cat: trick.cat,
          diff: trick.diff,
          about: trick.about,
          tips: trick.tips,
          fact: trick.fact,
          // The handoff's nullable `free`: absent means "inherit from diff",
          // which the empty select value is how the column spells it.
          free_override: trick.free === undefined ? '' : trick.free ? 'free' : 'paid',
          is_live: trick.isLive,
        })),
      },
      {
        collection: 'stickers',
        key: ['slug'],
        rows: (STICKERS as readonly Sticker[]).map((sticker) => ({
          slug: sticker.id,
          name: sticker.name,
          // `null` means "judge against combined stats"; the column spells that
          // as the empty select value.
          sport: sticker.sport ?? '',
          hue: sticker.hue,
          ico: sticker.ico,
          cond: sticker.cond,
          n: sticker.n ?? 0,
          is_live: sticker.isLive,
        })),
      },
      {
        collection: 'challenges',
        key: ['slug'],
        rows: CHALLENGES.map((challenge) => ({
          slug: challenge.id,
          sport: challenge.sport,
          week: challenge.week,
          title: challenge.title,
          blurb: challenge.blurb,
          starts: challenge.starts,
          ends: challenge.ends,
          goal: challenge.goal,
          reward: challenge.reward,
          hue: challenge.hue,
          // Display copy ("1,102 riders in"), not a count — hence the column
          // name. A real count would be a query, and this is a seed.
          riders_copy: challenge.riders,
          verb: challenge.verb,
        })),
      },
      {
        collection: 'spots',
        // Spots have no slug. Name plus town is what makes one distinct in the
        // seed data, and re-running must not create a second Rampworx.
        key: ['name', 'town'],
        rows: SPOTS.map((spot) => ({
          name: spot.name,
          town: spot.town,
          type: spot.type,
          // `dist` is deliberately not seeded: distance belongs to the viewer,
          // not the spot (see `SPOTS` in @landit/core).
          lat: spot.lat,
          lng: spot.lng,
          sports: [...spot.sports],
          tags: [...spot.tags],
          status: spot.status,
        })),
      },
      {
        collection: 'events',
        key: ['slug'],
        rows: EVENTS.map((event) => ({
          slug: event.id,
          name: event.name,
          kind: event.kind,
          town: event.town,
          venue: event.venue,
          date: event.date,
          sports: [...event.sports],
          level: event.level,
          price: event.price,
          spots_copy: event.spots,
          blurb: event.blurb,
          is_live: event.isLive,
        })),
      },
    ],
  };
}

/* ---------------------------------------------------------- writing it -- */

export interface SeedResult {
  readonly collection: string;
  readonly created: number;
  readonly updated: number;
}

export interface SeedOptions {
  /** Called with each line of progress. Defaults to silence. */
  readonly log?: (message: string) => void;
}

/**
 * Every sport the canonical data mentions must be a value the collections
 * actually accept, or PocketBase rejects the write with a bare 400.
 *
 * This is the BMX trap, made loud: `SPORT_IDS` gains `bmx` in T21, and until
 * the `select` values in `pocketbase/migrations/` are widened to match, the
 * first BMX trick fails with nothing to say why.
 */
async function assertSportsAccepted(client: Client): Promise<void> {
  const wanted = new Set<string>(SPORT_IDS);
  const collections = (await client.collections.getFullList()) as {
    name: string;
    fields?: { name: string; type: string; values?: string[] }[];
  }[];

  const problems: string[] = [];
  for (const collection of collections) {
    for (const field of collection.fields ?? []) {
      if (field.type !== 'select' || !field.values) continue;
      if (field.name !== 'sport' && field.name !== 'sports') continue;

      const accepted = new Set(field.values);
      const missing = [...wanted].filter((sport) => !accepted.has(sport));
      if (missing.length) {
        problems.push(
          `${collection.name}.${field.name} accepts [${field.values.join(', ')}] ` +
            `but the canonical data has [${missing.join(', ')}]`,
        );
      }
    }
  }

  if (problems.length) {
    throw new Error(
      'The schema does not accept every sport in the canonical data. Widen the ' +
        '`select` values in pocketbase/migrations/ with a new migration:\n  ' +
        problems.join('\n  '),
    );
  }
}

/**
 * Write the seed.
 *
 * Needs a **superuser** client: `tricks`, `plans`, `stickers`, `challenges` and
 * `events` all have `createRule: null`, which is the point — the trick library
 * is not something a rider can add to.
 */
export async function seed(
  client: Client,
  plan: SeedPlan = buildSeed(),
  options: SeedOptions = {},
): Promise<SeedResult[]> {
  const log = options.log ?? (() => {});

  await assertSportsAccepted(client);

  const results: SeedResult[] = [];

  for (const table of plan.tables) {
    const api = records(client, table.collection);
    let created = 0;
    let updated = 0;

    for (const row of table.rows) {
      const filter = table.key.map((field) => `${field} = {:${field}}`).join(' && ');
      const params = Object.fromEntries(table.key.map((field) => [field, row[field] as string]));

      const existing = await api.first(filter, params);
      if (existing) {
        await api.update(existing.id, row as never);
        updated += 1;
      } else {
        await api.create(row as never);
        created += 1;
      }
    }

    log(`${table.collection}: ${created} created, ${updated} updated`);
    results.push({ collection: table.collection, created, updated });
  }

  results.push(await seedPrereqs(client, log));
  return results;
}

/**
 * Prerequisite edges, which are the one table keyed by two *relations* rather
 * than by a value — the canonical data names tricks by slug, so each edge has
 * to be resolved to a pair of record ids first.
 *
 * Edges the canonical data no longer has are deleted. A stale edge would lock
 * a trick behind a prerequisite the library has dropped, and nothing else would
 * ever clean it up.
 */
async function seedPrereqs(client: Client, log: (message: string) => void): Promise<SeedResult> {
  const tricks = await records(client, 'tricks').list({ fields: 'id,slug' });
  const idOf = new Map(tricks.map((t) => [t.slug, t.id]));

  const wanted = new Map<string, { trick: string; prereq: string }>();
  for (const edge of TRICK_PREREQS) {
    const trick = idOf.get(edge.trick);
    const prereq = idOf.get(edge.prereq);
    if (!trick || !prereq) {
      throw new Error(
        `Prerequisite edge ${edge.trick} <- ${edge.prereq} names a trick that was not seeded.`,
      );
    }
    wanted.set(`${trick}:${prereq}`, { trick, prereq });
  }

  const existing = await records(client, 'trick_prereqs').list({ fields: 'id,trick,prereq' });
  const seen = new Set<string>();
  let removed = 0;

  for (const edge of existing) {
    const pair = `${edge.trick}:${edge.prereq}`;
    if (wanted.has(pair)) {
      seen.add(pair);
    } else {
      await records(client, 'trick_prereqs').remove(edge.id);
      removed += 1;
    }
  }

  let created = 0;
  for (const [pair, edge] of wanted) {
    if (seen.has(pair)) continue;
    await records(client, 'trick_prereqs').create(edge);
    created += 1;
  }

  log(`trick_prereqs: ${created} created, ${seen.size} unchanged, ${removed} removed`);
  return { collection: 'trick_prereqs', created, updated: seen.size };
}
