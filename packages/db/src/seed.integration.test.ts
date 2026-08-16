import { TRICKS, TRICK_PREREQS } from '@landit/core';
import PocketBase from 'pocketbase';
import { beforeAll, describe, expect, it } from 'vitest';

// @ts-expect-error — a plain .mjs harness, deliberately not part of the build.
import { SUPERUSER_EMAIL, SUPERUSER_PASSWORD, withInstance } from '../scripts/pb-instance.mjs';

import { records } from './collections';
import { seed } from './seed';

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
  counts: Record<string, number>;
  tricks: { id: string; slug: string; free_override: string; sport: string }[];
  prereqs: number;
}

let result: Seeded;

beforeAll(async () => {
  result = (await withInstance(
    async (url: string) => {
      const client = new PocketBase(url);
      client.autoCancellation(false);
      await client.collection('_superusers').authWithPassword(SUPERUSER_EMAIL, SUPERUSER_PASSWORD);

      const first = await seed(client);
      // Twice, on purpose: seeding an instance riders already use is the normal
      // way to update the library, so a second run must not duplicate anything.
      const second = await seed(client);

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
