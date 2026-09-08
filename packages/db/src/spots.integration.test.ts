import { SPORT_IDS, SPOT_FEATURE_LIST, filterSpots, sortSpotsHomeFirst } from '@landit/core';
import PocketBase from 'pocketbase';
import { beforeAll, describe, expect, it } from 'vitest';

// @ts-expect-error — a plain .mjs harness, deliberately not part of the build.
import { SUPERUSER_EMAIL, SUPERUSER_PASSWORD, withInstance } from '../scripts/pb-instance.mjs';

import { records } from './collections';
import { seed, selectTables } from './seed';
import {
  countSpotsBySport,
  getSpotsByIds,
  listSpotPoints,
  pageSpots,
  spotListFilter,
} from './spots';

/**
 * The paged spots list against a real PocketBase, seeded with the real spots.
 *
 * What this proves is that a PocketBase filter and a `@landit/core` rule
 * answer the same question the same way — for every sport, for a set of
 * searches, and for every feature the catalogue names — and that paging
 * through the home-first list produces exactly the order `sortSpotsHomeFirst`
 * would. The filter syntax that gets here was found by probing: on this
 * PocketBase a bare `?=` on a multi-select and `:each =` on a JSON column
 * both answer nothing, silently, and only a test like this one notices.
 */

interface Row {
  id: string;
  name: string;
  town: string;
  lat: number;
  lng: number;
  sports: readonly string[];
  tags: readonly string[];
  country: string;
}

interface Probe {
  all: Row[];
  counts: Record<string, number>;
  points: number;
  byIds: string[];
  totals: { query: string; server: number; core: number }[];
  pages: { home: string | null; got: string[]; expected: string[]; total: number }[];
}

let probe: Probe;

beforeAll(async () => {
  probe = (await withInstance(
    async (url: string) => {
      const client = new PocketBase(url);
      client.autoCancellation(false);
      await client.collection('_superusers').authWithPassword(SUPERUSER_EMAIL, SUPERUSER_PASSWORD);
      await seed(client, selectTables(['spots']).plan, { prereqs: false });

      // As a visitor, which is who the list rule matters for.
      const visitor = new PocketBase(url);
      visitor.autoCancellation(false);
      // As the core rules see a spot: `tags` is a JSON column, typed `unknown`.
      const all: Row[] = (
        await records(visitor, 'spots').list({ filter: "status = 'live'", sort: 'name' })
      ).map((row) => ({
        id: row.id,
        name: row.name,
        town: row.town,
        lat: row.lat,
        lng: row.lng,
        sports: row.sports,
        tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
        country: row.country,
      }));

      const queries = [
        {},
        ...SPORT_IDS.map((sport) => ({ sport })),
        { search: 'park' },
        { search: 'Liverpool' },
        { search: 'bowl' },
        { search: 'skate', sport: 'scooter' as const },
        ...SPOT_FEATURE_LIST.map((feature) => ({ feature: feature.id })),
      ];
      const totals = [];
      for (const query of queries) {
        const page = await records(visitor, 'spots').page({ ...spotListFilter(query), perPage: 1 });
        totals.push({
          query: JSON.stringify(query),
          server: page.totalItems,
          core: filterSpots(all, query).length,
        });
      }

      const pages = [];
      for (const home of ['UK', 'Australia', null]) {
        const query = { sport: 'skate' as const };
        const expected = sortSpotsHomeFirst(filterSpots(all, query), home).map((s) => s.id);
        const got: string[] = [];
        let total = 0;
        // 40 a page, not 24: enough pages to cross the home/others seam more
        // than once and few enough that three and a half thousand rows finish.
        for (let page = 1; got.length < expected.length && page < 1000; page += 1) {
          const result = await pageSpots(visitor, query, { home, page, perPage: 40 });
          total = result.total;
          if (!result.items.length) break;
          got.push(...result.items.map((s) => s.id));
        }
        pages.push({ home, got, expected, total });
      }

      const ids = all
        .slice(0, 10)
        .map((s) => s.id)
        .reverse();
      return {
        all,
        counts: await countSpotsBySport(visitor, SPORT_IDS),
        points: (await listSpotPoints(visitor)).length,
        byIds: (await getSpotsByIds(visitor, [...ids, 'not-an-id', 'abcdefghijklmno'])).map(
          (s) => s.id,
        ),
        totals,
        pages,
      };
    },
    { hooks: true },
  )) as Probe;
}, 180_000);

describe('the paged spots list on a real PocketBase', () => {
  it('has the researched spots to work with', () => {
    expect(probe.all.length).toBeGreaterThan(50);
  });

  it('counts the same spots the core rules would, for every query', () => {
    for (const { query, server, core } of probe.totals) {
      expect(server, query).toBe(core);
    }
  });

  it('pages through the home-first list in exactly the order core sorts it', () => {
    for (const { home, got, expected, total } of probe.pages) {
      expect(got, `home ${home}`).toEqual(expected);
      expect(total, `home ${home} total`).toBe(expected.length);
    }
  });

  it('counts every sport over the whole collection', () => {
    for (const sport of SPORT_IDS) {
      expect(probe.counts[sport]).toBe(filterSpots(probe.all, { sport }).length);
    }
  });

  it('serves every live spot as a point', () => {
    expect(probe.points).toBe(probe.all.length);
  });

  it('returns cards in the order asked, and drops an id it cannot use', () => {
    expect(probe.byIds).toEqual(
      probe.all
        .slice(0, 10)
        .map((s) => s.id)
        .reverse(),
    );
  });
});
