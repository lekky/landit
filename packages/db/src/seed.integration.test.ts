import { TRICKS, TRICK_PREREQS } from '@landit/core';
import PocketBase from 'pocketbase';
import { beforeAll, describe, expect, it } from 'vitest';

// @ts-expect-error — a plain .mjs harness, deliberately not part of the build.
import { SUPERUSER_EMAIL, SUPERUSER_PASSWORD, withInstance } from '../scripts/pb-instance.mjs';

import { records } from './collections';
import { franceSpots } from './imports/france';
import { sampleWorld } from './imports/world-sample';
import { buildSeed, seed, selectTables } from './seed';

/**
 * The seed, run against a real PocketBase started on this repo's real
 * migrations.
 *
 * The unit test in `seed.test.ts` proves the *mapping* is right. This proves
 * the writes actually land: that every column exists under the name the seed
 * uses, that the same run twice leaves one copy of everything, and that the
 * prerequisite edges resolve. A seed is exactly the kind of code that looks
 * correct and fails on contact with the schema.
 *
 * Hooks are loaded, so anything the hooks would reject — the challenge-overlap
 * rule in particular — is rejected here too rather than surfacing the first
 * time somebody seeds a real box.
 */

interface Seeded {
  first: Awaited<ReturnType<typeof seed>>;
  second: Awaited<ReturnType<typeof seed>>;
  /** A third run over `spots` only, after a staff edit to an imported row. */
  third: Awaited<ReturnType<typeof seed>>;
  /** What that row's `operating` reads after the third run. */
  editedOperating: string;
  /** Spots with no `source` after seeding — should be none. */
  unstamped: number;
  counts: Record<string, number>;
  tricks: { id: string; slug: string; free_override: string; sport: string }[];
  prereqs: number;
}

let result: Seeded;

const PLAN = sampleWorld(buildSeed());
const WORLD_ROWS = PLAN.tables.find((table) => table.label === 'spots (world)')!.rows.length;
const OSM_ONLY_ROWS = PLAN.tables.find(
  (table) => table.label === 'spots (world, OpenStreetMap only)',
)!.rows.length;

/** The spots tables' results, in seed order: researched, France, world, OpenStreetMap only. */
const spotsRuns = (run: Seeded['first']) => run.filter((r) => r.collection === 'spots');

beforeAll(async () => {
  result = (await withInstance(
    async (url: string) => {
      const client = new PocketBase(url);
      client.autoCancellation(false);
      await client.collection('_superusers').authWithPassword(SUPERUSER_EMAIL, SUPERUSER_PASSWORD);

      const first = await seed(client, PLAN);
      // Twice, on purpose: seeding an instance riders already use is the normal
      // way to update the library, so a second run must not duplicate anything.
      const second = await seed(client, PLAN);

      /*
       * Then the case the France import exists for (issue #362): staff mark an
       * imported park closed, and a later seed of `spots` must leave that
       * alone. The edit goes through the API as a superuser, exactly as the
       * admin's server action does.
       */
      const spots = records(client, 'spots');
      const imported = await spots.first('source = {:source}', { source: 'fr-sports-gouv' });
      if (!imported) throw new Error('the France import wrote nothing');
      await spots.update(imported.id, { operating: 'closed' });
      const third = await seed(client, sampleWorld(selectTables(['spots']).plan), {
        prereqs: false,
      });
      const edited = await spots.first('id = {:id}', { id: imported.id });
      const unstamped = (await spots.page({ perPage: 1, filter: "source = ''" })).totalItems;

      const counts: Record<string, number> = {};
      for (const name of [
        'plans',
        'tricks',
        'stickers',
        'challenges',
        'spots',
        'events',
        'trick_prereqs',
      ] as const) {
        counts[name] = (await records(client, name).page({ perPage: 1 })).totalItems;
      }

      return {
        first,
        second,
        third,
        editedOperating: String(edited?.operating ?? ''),
        unstamped,
        counts,
        tricks: (await records(client, 'tricks').list({
          fields: 'id,slug,free_override,sport',
        })) as Seeded['tricks'],
        prereqs: counts.trick_prereqs!,
      };
    },
    { hooks: true },
  )) as Seeded;
}, 180_000);

describe('seeding a real PocketBase', () => {
  it('writes every canonical trick', () => {
    expect(result.counts.tricks).toBe(TRICKS.length);
  });

  it('writes every prerequisite edge', () => {
    expect(result.prereqs).toBe(TRICK_PREREQS.length);
  });

  it('writes the plans, stickers, challenges, spots and events', () => {
    expect(result.counts.plans).toBeGreaterThan(0);
    expect(result.counts.stickers).toBeGreaterThan(0);
    expect(result.counts.challenges).toBeGreaterThan(0);
    expect(result.counts.spots).toBeGreaterThan(0);
    expect(result.counts.events).toBeGreaterThan(0);
  });

  it('creates on the first run', () => {
    const tricks = result.first.find((r) => r.collection === 'tricks');
    expect(tricks?.created).toBe(TRICKS.length);
    expect(tricks?.updated).toBe(0);
  });

  it('updates rather than duplicates on the second', () => {
    for (const table of result.second) {
      expect(table.created, `${table.collection} created rows on a re-run`).toBe(0);
    }
    // And the totals are unchanged — the real proof, since a duplicate would
    // show up here even if the counters lied.
    expect(result.counts.tricks).toBe(TRICKS.length);
    expect(result.counts.trick_prereqs).toBe(TRICK_PREREQS.length);
  });

  it('imports every French skatepark once, and keeps them on the second run', () => {
    const france = (run: Seeded['first']) => spotsRuns(run)[1]!;
    expect(france(result.first).created).toBe(franceSpots().length);
    expect(france(result.first).kept).toBe(0);
    expect(france(result.second).created).toBe(0);
    expect(france(result.second).kept).toBe(franceSpots().length);
  });

  it('imports the world sample once, and keeps it on the second and third runs', () => {
    expect(WORLD_ROWS).toBeGreaterThan(100);
    expect(spotsRuns(result.first)[2]!.created).toBe(WORLD_ROWS);
    expect(spotsRuns(result.second)[2]!.created).toBe(0);
    expect(spotsRuns(result.second)[2]!.kept).toBe(WORLD_ROWS);
    expect(spotsRuns(result.third)[2]!.updated).toBe(0);
    expect(spotsRuns(result.third)[2]!.kept).toBe(WORLD_ROWS);
  });

  it('imports the OpenStreetMap-only sample once, and keeps it after', () => {
    expect(OSM_ONLY_ROWS).toBeGreaterThan(100);
    expect(spotsRuns(result.first)[3]!.created).toBe(OSM_ONLY_ROWS);
    expect(spotsRuns(result.second)[3]!.created).toBe(0);
    expect(spotsRuns(result.second)[3]!.kept).toBe(OSM_ONLY_ROWS);
    expect(spotsRuns(result.third)[3]!.kept).toBe(OSM_ONLY_ROWS);
  });

  it('leaves a staff edit to an imported spot alone on a re-seed (issue #362)', () => {
    expect(result.editedOperating).toBe('closed');
    // And the run said so: nothing created, nothing updated, everything kept.
    const france = spotsRuns(result.third)[1]!;
    expect(france.updated).toBe(0);
    expect(france.kept).toBe(franceSpots().length);
  });

  it('stamps every spot with where it came from', () => {
    expect(result.unstamped).toBe(0);
  });

  it('stores the free/paid override in a form the paywall hook can read', () => {
    // The hook treats `''` as "inherit from difficulty". If the seed wrote
    // `false` or `null` here the whole free library would fall behind the
    // paywall, and no unit test on the mapping would notice.
    for (const trick of result.tricks) {
      expect(['', 'free', 'paid']).toContain(trick.free_override);
    }
  });

  it('seeds whatever sports the canonical data has', () => {
    const seeded = new Set(result.tricks.map((t) => t.sport));
    expect(seeded).toEqual(new Set(TRICKS.map((t) => t.sport)));
  });
});
