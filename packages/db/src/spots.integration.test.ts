import {
  SPORT_IDS,
  SPOT_FEATURE_LIST,
  filterSpots,
  nearestFirst,
  sortSpotsHomeFirst,
} from '@landit/core';
import PocketBase from 'pocketbase';
import { beforeAll, describe, expect, it } from 'vitest';

// @ts-expect-error — a plain .mjs harness, deliberately not part of the build.
import { SUPERUSER_EMAIL, SUPERUSER_PASSWORD, withInstance } from '../scripts/pb-instance.mjs';

import { records } from './collections';
import { sampleWorld } from './imports/world-sample';
import { seed, selectTables } from './seed';
import {
  countSpotsBySport,
  getSpotsByIds,
  listSpotPoints,
  listSpotsInPlace,
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
 * would — and, since the world import, that the two narrow queries an event
 * page gathers its "spots near" from return what reading the whole table
 * returned.
 *
 * The filter syntax that gets here was found by probing: on this PocketBase a
 * bare `?=` on a multi-select and `:each =` on a JSON column both answer
 * nothing, silently, and only a test like this one notices. `town:lower =`,
 * which `spotPlaceFilters` is built on, is proven here for that reason rather
 * than assumed from the `~` beside it.
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
  places: { place: Place; got: string[]; expected: string[] }[];
}

/** A town and country to gather spots around, as an event page holds one. */
interface Place {
  readonly town?: string;
  readonly country?: string;
}

let probe: Probe;

beforeAll(async () => {
  probe = (await withInstance(
    async (url: string) => {
      const client = new PocketBase(url);
      client.autoCancellation(false);
      await client.collection('_superusers').authWithPassword(SUPERUSER_EMAIL, SUPERUSER_PASSWORD);
      await seed(client, sampleWorld(selectTables(['spots']).plan), { prereqs: false });

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

      /*
       * The event page's "spots near" block, narrowed query against whole
       * table. `nearestFirst` is the rule either way; what is being proved is
       * that feeding it two bounded queries instead of thirty thousand rows
       * does not change the four rows it hands back.
       *
       * The towns are taken from the data rather than written down, so this
       * keeps testing real places as the imports change: the three with the
       * most spots, one whose name is the start of another's (the `~`'s slop,
       * where one exists), a town nothing matches inside a country that does,
       * and a place nothing matches at all.
       */
      const byTown = new Map<string, number>();
      for (const row of all) byTown.set(row.town, (byTown.get(row.town) ?? 0) + 1);
      const towns = [...byTown.keys()].sort((a, b) => (byTown.get(b) ?? 0) - (byTown.get(a) ?? 0));
      const countryOf = (town: string): string =>
        all.find((row) => row.town === town)?.country ?? '';
      const prefix = towns.find((town) =>
        towns.some((other) => other !== town && other.toLowerCase().startsWith(town.toLowerCase())),
      );

      const wanted: Place[] = [
        ...towns.slice(0, 3).map((town) => ({ town, country: countryOf(town) })),
        ...(prefix ? [{ town: prefix, country: countryOf(prefix) }] : []),
        // Case folded and padded, the way `nearnessBetween` forgives it.
        { town: `  ${(towns[0] ?? '').toUpperCase()} `, country: countryOf(towns[0] ?? '') },
        { town: 'Nowhere In Particular', country: countryOf(towns[0] ?? '') },
        { town: 'Nowhere In Particular', country: 'Nowhereland' },
        {},
      ];

      const places = [];
      for (const place of wanted) {
        const narrowed = await listSpotsInPlace(visitor, place);
        places.push({
          place,
          got: nearestFirst(place, narrowed)
            .slice(0, 4)
            .map((row) => row.id),
          expected: nearestFirst(place, all)
            .slice(0, 4)
            .map((row) => row.id),
        });
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
        places,
      };
    },
    { hooks: true },
  )) as Probe;
  /*
   * Seeding is most of this: every spots table with hooks on — France whole,
   * the world import's two as 400-row samples (2026-09-11) — about 4,300
   * creates before a single query runs. Three minutes held on a quiet machine
   * and not on a busy one, so the budget matches the seed-command test's.
   */
}, 600_000);

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

  /*
   * The event page used to read the whole `spots` collection to fill four rows
   * and stopped being servable when the world import made that thirty thousand.
   * These are the queries that replaced it, checked against the answer the
   * whole-table read gave.
   */
  it('gives an event page the same spots near it as reading every spot did', () => {
    expect(probe.places.length).toBeGreaterThan(4);
    for (const { place, got, expected } of probe.places) {
      expect(got, JSON.stringify(place)).toEqual(expected);
    }
  });

  it('finds spots for a town it holds, and none for one it does not', () => {
    const withTown = probe.places.filter((p) => p.place.town && !p.place.town.includes('Nowhere'));
    expect(withTown.every((p) => p.got.length > 0)).toBe(true);

    const nothing = probe.places.find((p) => p.place.country === 'Nowhereland');
    expect(nothing?.got).toEqual([]);
    expect(probe.places.find((p) => !p.place.town && !p.place.country)?.got).toEqual([]);
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
