import { SPORT_IDS, unindexedSpotSourceIds, spotFeatureId, type SportId } from '@landit/core';

import type { Client } from './clients';
import { records } from './collections';
import type { SpotsRecord } from './generated/collections';

/**
 * The spots list, a page at a time (issue #367).
 *
 * `listSpots` hands back every live spot in one call, and `/spots` used to put
 * all of them in the page. That was fine at a hundred-odd rows and stopped
 * being fine at three and a half thousand: 1.34 MB of HTML per request, most
 * of it addresses nobody would scroll to. These are the queries that let the
 * screen ask for what it will show.
 *
 * **The rules here are the rules in `@landit/core`, spelled as PocketBase
 * filters.** `filterSpots` there decides what "matches" means — search over
 * name, town and tags; a sport matches a park tagged for it or tagged for
 * nothing; a feature matches by normalised tag — and `spots.integration.test.ts`
 * runs both over the same seeded rows and requires the same answers. If a
 * filter below and a rule there ever disagree, that test is what says so; the
 * rule wins and the filter changes.
 *
 * **Home first is a partition, not a sort key.** `sortSpotsHomeFirst` puts the
 * reader's own country ahead of the rest and keeps name order inside each
 * half. PocketBase cannot sort by "equals X first", so a page of the combined
 * list is cut from two name-sorted lists — the home country's and everyone
 * else's — by `pageWindows`, which is pure and tested on its own.
 */

export interface SpotListQuery {
  /** Free text over name, town and tags. */
  readonly search?: string;
  /** `null` is "Every spot". */
  readonly sport?: SportId | null;
  /**
   * The sports chosen in the filter row, any of which is a match — the
   * multi-select `/spots` gained on 2026-09-12. Empty or absent is every spot,
   * and so is a list holding every sport there is. Takes precedence over
   * `sport`, which predates it and is kept for callers that only have one.
   */
  readonly sports?: readonly SportId[];
  /** A feature id from `SPOT_FEATURES`, already validated by the caller. */
  readonly feature?: string | null;
}

export interface SpotFilter {
  readonly filter: string;
  readonly params: Record<string, string>;
}

/** Only approved spots are listed; a rider's own submissions are read separately. */
const LIVE = "status = 'live'";

/**
 * The filter for a list query, mirroring `filterSpots` clause for clause.
 *
 * - Search: `~` is a case-insensitive contains on ASCII; `:lower` folds the
 *   column so a capital typed or stored does not matter, which is what
 *   `spotMatchesSearch` does with `toLowerCase`. Tags are a JSON column and
 *   `~` reads it as text, so a tag matches on its substring like a name does.
 * - Sport: a park with no sports listed matches every sport — the prototype's
 *   rule, kept by `spotMatchesSport`. `:length = 0` is that empty list. The
 *   `:each` on the any-equals is not decoration: on PocketBase 0.39 a bare
 *   `sports ?= 'x'` on a multi-select answers nothing at all, silently, and
 *   that is the form `listSpots` has carried since T13 without a caller.
 * - Feature: `spotMatchesFeature` compares normalised tags for equality.
 *   `:each = ` answers nothing on a JSON column here either, so the match is
 *   the element as it sits in the serialised array — quotes and all — inside
 *   the lowercased text, which is equality on an element and nothing looser.
 *   The stored tag is written trimmed and single-spaced by the seed and the
 *   admin form, so lowercasing is the only normalisation left to do.
 */
export function spotListFilter(query: SpotListQuery): SpotFilter {
  const clauses = [LIVE];
  const params: Record<string, string> = {};

  const needle = (query.search ?? '').trim().toLowerCase();
  if (needle) {
    clauses.push('(name:lower ~ {:q} || town:lower ~ {:q} || tags:lower ~ {:q})');
    params.q = needle;
  }
  /*
   * One sport or several, mirroring `spotMatchesSports` clause for clause.
   *
   * Chosen sports are OR-ed, because "scooter and BMX" asks for both lists at
   * once rather than for the spots that suit both — and the untagged-spot
   * escape (`sports:length = 0`) is OR-ed alongside them exactly once, so a
   * park nobody has tagged comes back whichever sports were picked.
   *
   * Picking every sport there is adds no clause at all: it matches everything
   * the unfiltered query matches, and saying so in SQL would be three
   * `:each` scans of a JSON column to arrive back where we started.
   */
  const chosen = query.sports?.length ? query.sports : query.sport ? [query.sport] : [];
  if (chosen.length && chosen.length < SPORT_IDS.length) {
    const matches = chosen.map((sport, index) => {
      params[`sport${index}`] = sport;
      return `sports:each ?= {:sport${index}}`;
    });
    clauses.push(`(${[...matches, 'sports:length = 0'].join(' || ')})`);
  }
  const feature = query.feature ? spotFeatureId(query.feature) : '';
  if (feature) {
    // The tag as it sits in the serialised JSON array, quotes included, so
    // "bowl" matches the element `"Bowl"` and never the inside of `"Bowl end"`.
    clauses.push('tags:lower ~ {:feature}');
    params.feature = JSON.stringify(feature);
  }

  return { filter: clauses.join(' && '), params };
}

/* --------------------------------------------------------------- paging -- */

export interface Window {
  /** Inclusive start, exclusive end, into the name-sorted list. */
  readonly start: number;
  readonly end: number;
}

/**
 * Which slice of the home list and which of the others make up rows
 * `[start, start + count)` of the combined, home-first list.
 *
 * Pure, so the arithmetic that decides what a "Show more" press fetches is
 * tested without a database. Either window can be empty.
 */
export function pageWindows(
  homeTotal: number,
  start: number,
  count: number,
): { readonly home: Window | null; readonly others: Window | null } {
  const end = start + count;
  const home = start < homeTotal ? { start, end: Math.min(end, homeTotal) } : null;
  const othersStart = Math.max(0, start - homeTotal);
  const othersEnd = end - homeTotal;
  const others = othersEnd > othersStart ? { start: othersStart, end: othersEnd } : null;
  return { home, others };
}

/**
 * Rows `[start, end)` of a name-sorted, filtered list.
 *
 * PocketBase pages by number, not offset, so an unaligned window — the tail
 * of a page that started in the home list — spans at most two pages of
 * `end - start` rows, which are fetched and cut. `total` is the list's whole
 * length, from the first page's `totalItems`.
 */
async function fetchWindow(
  client: Client,
  filter: SpotFilter,
  window: Window,
): Promise<{ items: SpotsRecord[]; total: number }> {
  const api = records(client, 'spots');
  const size = window.end - window.start;
  const first = Math.floor(window.start / size) + 1;
  const last = Math.floor((window.end - 1) / size) + 1;

  const pages = [];
  let total = 0;
  for (let page = first; page <= last; page += 1) {
    const result = await api.page({ ...filter, sort: 'name', page, perPage: size });
    total = result.totalItems;
    pages.push(...result.items);
  }
  const offset = window.start - (first - 1) * size;
  return { items: pages.slice(offset, offset + size), total };
}

async function countMatching(client: Client, filter: SpotFilter): Promise<number> {
  return (await records(client, 'spots').page({ ...filter, perPage: 1 })).totalItems;
}

function narrowed(base: SpotFilter, clause: string, params: Record<string, string>): SpotFilter {
  return { filter: `${base.filter} && ${clause}`, params: { ...base.params, ...params } };
}

export interface SpotPage {
  readonly items: SpotsRecord[];
  /** How many spots match the query in all — the number the count line shows. */
  readonly total: number;
}

/**
 * One page of the list a rider sees: the query, the reader's country first,
 * name order inside each half.
 *
 * With no home country this is one query. With one it is the home list and
 * the others list cut by `pageWindows`, and a count of whichever half the
 * page did not reach, so `total` is always the whole. At most four small
 * requests, all of `perPage` rows or fewer.
 */
export async function pageSpots(
  client: Client,
  query: SpotListQuery,
  options: { readonly home?: string | null; readonly page: number; readonly perPage: number },
): Promise<SpotPage> {
  const base = spotListFilter(query);
  const start = (options.page - 1) * options.perPage;
  const count = options.perPage;

  if (!options.home) {
    return fetchWindow(client, base, { start, end: start + count });
  }

  const homeFilter = narrowed(base, 'country = {:home}', { home: options.home });
  const othersFilter = narrowed(base, 'country != {:home}', { home: options.home });

  // The home list's length decides where the others begin, so it is read
  // first — from the page itself when the window reaches it, else by a count.
  const homeProbe = pageWindows(Number.MAX_SAFE_INTEGER, start, count).home!;
  const homeFetched = await fetchWindow(client, homeFilter, homeProbe);
  const homeTotal = homeFetched.total;

  const windows = pageWindows(homeTotal, start, count);
  const items: SpotsRecord[] = windows.home
    ? homeFetched.items.slice(0, windows.home.end - windows.home.start)
    : [];

  let othersTotal: number;
  if (windows.others) {
    const others = await fetchWindow(client, othersFilter, windows.others);
    items.push(...others.items);
    othersTotal = others.total;
  } else {
    othersTotal = await countMatching(client, othersFilter);
  }

  return { items, total: homeTotal + othersTotal };
}

/* --------------------------------------------------------------- counts -- */

/**
 * How many live spots each sport has, for the tab row's note — counted over
 * the whole collection, never the filtered list, so the note answers "is it
 * worth switching?" rather than a question nobody asked.
 */
export async function countSpotsBySport(
  client: Client,
  sports: readonly SportId[],
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const sport of sports) {
    counts[sport] = await countMatching(client, spotListFilter({ sport }));
  }
  return counts;
}

/* --------------------------------------------------------------- points -- */

/** What "Near me" needs to order the whole list in the browser, and no more. */
export interface SpotPoint {
  readonly id: string;
  readonly name: string;
  readonly town: string;
  readonly lat: number;
  readonly lng: number;
  readonly sports: readonly SportId[];
  readonly tags: readonly string[];
}

/**
 * Every live spot as a point. Name, town and tags travel too because the
 * search box and the pills still apply while the list is nearest-first, and
 * `filterSpots` needs them. Address, phone and slug do not — a card is
 * fetched by id once it is on screen.
 */
export async function listSpotPoints(client: Client): Promise<SpotPoint[]> {
  const rows = await records(client, 'spots').list({
    filter: LIVE,
    fields: 'id,name,town,lat,lng,sports,tags',
    sort: 'name',
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    town: row.town,
    lat: row.lat,
    lng: row.lng,
    sports: (row.sports ?? []) as SportId[],
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
  }));
}

/** A PocketBase record id: fifteen lowercase alphanumerics. */
const RECORD_ID = /^[a-z0-9]{15}$/;

/**
 * The spots with these ids, in this order, skipping any the caller may not
 * read. The API rule does the refusing — an id that is not live and not the
 * caller's own simply does not come back — so this never has to decide what
 * a rider may see.
 */
export async function getSpotsByIds(
  client: Client,
  ids: readonly string[],
): Promise<SpotsRecord[]> {
  const wanted = ids.filter((id) => RECORD_ID.test(id));
  if (!wanted.length) return [];
  const params = Object.fromEntries(wanted.map((id, i) => [`id${i}`, id]));
  const filter = wanted.map((_, i) => `id = {:id${i}}`).join(' || ');
  const rows = await records(client, 'spots').list({ filter, params });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return wanted.map((id) => byId.get(id)).filter((row): row is SpotsRecord => !!row);
}

/**
 * The caller's own submissions that are not on the map — pending, or turned
 * down. The `listRule` is what returns them: a spot that is not live comes
 * back only to the rider who put it forward, so for a visitor this is empty.
 */
export async function listOwnSpots(client: Client): Promise<SpotsRecord[]> {
  return records(client, 'spots').list({ filter: "status != 'live'", sort: '-created' });
}

/* ---------------------------------------------------------- nearby spots -- */

/**
 * Live spots around a point, for a spot page's "nearest other spots", without
 * reading every spot there is.
 *
 * The page used to list every live spot and sort them all by distance, which
 * was fine at a few hundred and is not at thirty thousand (the world import).
 * This asks for a box around the point instead — a quarter of a degree either
 * side, widened until it holds more than `want` spots or reaches sixteen
 * degrees — and the page still does the sorting, so its onward list is
 * unchanged wherever the box holds the nearest few. Longitude is widened by
 * latitude so the box is roughly square on the ground.
 */
export async function listSpotsNear(
  client: Client,
  point: { readonly lat: number; readonly lng: number },
  want = 12,
): Promise<SpotsRecord[]> {
  const cos = Math.max(0.1, Math.cos((point.lat * Math.PI) / 180));
  let rows: SpotsRecord[] = [];
  for (const half of [0.25, 1, 4, 16]) {
    const wide = Math.min(180, half / cos);
    rows = await records(client, 'spots').list({
      filter: `${LIVE} && lat >= {:s} && lat <= {:n} && lng >= {:w} && lng <= {:e}`,
      params: {
        s: point.lat - half,
        n: point.lat + half,
        w: point.lng - wide,
        e: point.lng + wide,
      },
    });
    if (rows.length > want) break;
  }
  return rows;
}

/**
 * Live spots whose pages search engines may index, for the sitemap: every
 * live spot except those from a source the catalogue keeps out of search
 * (`indexed: false` in `SPOT_SOURCES` — the world import's pages, 2026-09-11).
 * A page that carries `noindex` has no business in a sitemap, and listing it
 * there would ask a crawler to fetch thirty thousand pages it is then told
 * to ignore.
 */
export async function listIndexedSpots(client: Client): Promise<SpotsRecord[]> {
  const hidden = unindexedSpotSourceIds();
  return records(client, 'spots').list({
    filter: [LIVE, ...hidden.map((_, i) => `source != {:hidden${i}}`)].join(' && '),
    params: Object.fromEntries(hidden.map((id, i) => [`hidden${i}`, id])),
    sort: 'name',
  });
}

/* ------------------------------------------------------ the spots near -- */

/** A place to gather spots around, in the only two terms both records hold. */
export interface SpotPlace {
  readonly town?: string;
  readonly country?: string;
}

/**
 * How many rows each band asks for.
 *
 * The caller shows four, and both bands are name sorted, so four would do:
 * at most three town rows can shadow a country row, and a town with four of
 * its own never needs the country band at all. Fifty is headroom, so a block
 * that wants a row more is not a change to this file, and it is still three
 * orders of magnitude less than the whole table.
 */
const PLACE_BAND = 50;

/** A place name as both sides of `nearnessBetween` compare it. */
const fold = (value: string | undefined): string => (value ?? '').trim().toLowerCase();

/**
 * The two bands of "near a place", as filters: the town, then its country.
 *
 * **`=` on a `:lower` column, not `~`.** `nearnessBetween` in `@landit/core`
 * decides what "near" means and it compares *whole* strings, case folded —
 * "India" must never select "Indonesia" — so the query says the same thing
 * rather than something looser. A `~` would have been a contains: asking for
 * York would hand back New York and Yorkton, and with a band this shallow the
 * town's own spots could be pushed out of it by the towns merely spelled like
 * it. `:lower =` is not syntax this codebase had used before, so
 * `spots.integration.test.ts` proves it against a real PocketBase — on this
 * database a filter that does not work answers nothing, silently, and only a
 * test like that one notices.
 *
 * The rule still decides: this narrows the table to the rows that could be
 * near, and `nearestFirst` bands them. A band with nothing to match on is
 * left out rather than sent as an empty string.
 */
export function spotPlaceFilters(place: SpotPlace): SpotFilter[] {
  const bands: SpotFilter[] = [];
  const town = fold(place.town);
  const country = fold(place.country);
  if (town) bands.push({ filter: `${LIVE} && town:lower = {:town}`, params: { town } });
  if (country) {
    bands.push({ filter: `${LIVE} && country:lower = {:country}`, params: { country } });
  }
  return bands;
}

/**
 * Live spots in a town and then in the rest of its country, without reading
 * every spot there is.
 *
 * An event page listed "Spots near {town}" by fetching the whole `spots`
 * collection and partitioning it in the browser's stead on the server. That
 * was a few hundred rows when the block was built and is thirty thousand since
 * the world import — a whole-table read, followed over thirty-odd pages of a
 * thousand rows, on every view of every event page, to put four rows at the
 * foot of it. The spots list (issue #367) and the spot page both stopped doing
 * this; this is the same stop for the last caller that still did.
 *
 * **The rows are the ones the page showed before, in the order it showed
 * them.** Both bands come back name sorted, as the whole table used to; the
 * town's band leads; and `nearestFirst` partitions stably, so a name-sorted
 * town band followed by a name-sorted country band lands in exactly the order
 * a single name-sorted table did. The two queries overlap — a spot in the town
 * is also in its country — so the country band drops what the town band
 * already carried, and nothing else is done to either.
 *
 * Sorting in particular is left to the database, deliberately: re-sorting the
 * pair in JavaScript would have to guess at the collation PocketBase ordered
 * them by, and a world of accented park names is where that guess goes wrong.
 *
 * `spots.integration.test.ts` checks all of this against a real database
 * rather than trusting the argument — the same four rows, for real towns, as
 * reading every spot gave.
 */
export async function listSpotsInPlace(client: Client, place: SpotPlace): Promise<SpotsRecord[]> {
  const bands = spotPlaceFilters(place);
  if (!bands.length) return [];

  const pages = await Promise.all(
    bands.map((band) =>
      records(client, 'spots').page({ ...band, sort: 'name', perPage: PLACE_BAND }),
    ),
  );

  const seen = new Set<string>();
  const rows: SpotsRecord[] = [];
  for (const page of pages) {
    for (const row of page.items) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
  }
  return rows;
}
