/**
 * Where spot rows come from, and on what terms.
 *
 * Every row in `spots` carries a `source` id and a `licence` id
 * (`pocketbase/migrations/1788998400_spot_source_and_licence.js`), and this is
 * the vocabulary they are drawn from. It is data in `core` rather than a
 * `select` in the schema for two reasons: a country's open dataset can be added
 * without a migration, and the credit line under the spots map is rendered from
 * this table, so what a row is stamped with and what a rider is told can never
 * drift apart.
 *
 * **Kept internal per row, credited in aggregate** (Rachid, 2026-09-07, in
 * chat, option B). A spot's public page never says which of these it came
 * from; the paragraph under the map names every source whose licence asks for
 * attribution. That is what the attribution-only licences require and no more.
 *
 * **Why the licence matters enough to store.** The hand-researched rows were
 * cross-checked against OpenStreetMap and so carry its Open Database Licence,
 * which is share-alike; a government census under Licence Ouverte or CC BY is
 * attribution-only. The day somebody asks which rows may be handed on under
 * which terms, this column is the answer, and a column that has to be
 * reconstructed from memory is one that gets reconstructed wrong.
 */

export interface SpotSource {
  /** The value written to `spots.source`. */
  readonly id: string;
  /** How the credit line names it. */
  readonly name: string;
  /** SPDX-style identifier written to `spots.licence`; `''` where none applies. */
  readonly licence: string;
  /** The licence's own name, for the credit line. */
  readonly licenceName: string;
  /** The publisher's page for the dataset, or `''`. */
  readonly url: string;
  /**
   * The day the committed snapshot was fetched, `YYYY-MM-DD`, for sources that
   * are imported from a file rather than researched by hand. Licence Ouverte
   * asks that the date of the last update be given alongside the source's name,
   * so the credit line prints it. `packages/db` asserts this matches the date
   * stamped on the generated data file, so a re-fetch that forgets this line
   * fails a test rather than crediting a stale date.
   */
  readonly snapshot?: string;
  /** Whether the credit line under the map must name this source. */
  readonly credited: boolean;
  /**
   * Whether a spot page from this source may be indexed by search engines.
   * Absent means yes. `false` puts `noindex` on the page and keeps it out of
   * the sitemap: an imported page that says little more than a name and a town
   * is the thin, near-duplicate page search engines demote a whole site for
   * (the owner, 2026-09-11, in chat, for the world import).
   */
  readonly indexed?: boolean;
  /**
   * Datasets a row from this source also draws on, credited beside it — the
   * world import's towns come from GeoNames, whichever source the park came
   * from.
   */
  readonly alsoCredits?: readonly SpotCredit[];
}

/** A dataset the credit line names that is not itself a row source. */
export interface SpotCredit {
  readonly name: string;
  readonly licenceName: string;
  readonly url: string;
}

/** GeoNames' populated places, CC BY 4.0 — the town on every world-import row. */
const GEONAMES: SpotCredit = {
  name: 'GeoNames',
  licenceName: 'CC BY 4.0',
  url: 'https://www.geonames.org',
};

export const SPOT_SOURCES = {
  /** A session researched it by hand from the venue, a council and OpenStreetMap. */
  researched: {
    id: 'researched',
    name: 'councils, venues and OpenStreetMap',
    licence: 'ODbL-1.0',
    licenceName: 'Open Database Licence',
    url: 'https://www.openstreetmap.org/copyright',
    credited: true,
  },
  /** A rider put it forward through the form; staff approved it. */
  rider: {
    id: 'rider',
    name: 'riders',
    licence: '',
    licenceName: '',
    url: '',
    credited: false,
  },
  /** France's Ministry of Sport equipment census, issue #362. */
  'fr-sports-gouv': {
    id: 'fr-sports-gouv',
    name: 'the French Ministry of Sport’s equipment census, via data.gouv.fr',
    licence: 'etalab-2.0',
    licenceName: 'Licence Ouverte 2.0',
    url: 'https://equipements.sports.gouv.fr',
    snapshot: '2026-09-08',
    credited: true,
  },
  /**
   * The world import (the owner, 2026-09-11, in chat): a park on Trucks and
   * Fins' map that OpenStreetMap also has, within 150 metres. Its point, name
   * and address are OpenStreetMap's, under the Open Database Licence, which is
   * what the credit line names. Its tags, roof and "gone" come from Trucks and
   * Fins' map filters, which no licence covers — so the licence column says
   * both halves: `ODbL-1.0 AND LicenseRef-none`, where `LicenseRef-none` means
   * no licence was granted and the owner chose to take the facts regardless.
   * The column exists for the day somebody asks which rows may be handed on,
   * and the honest answer for these is "not on ODbL terms alone".
   */
  'osm-tnf': {
    id: 'osm-tnf',
    name: 'OpenStreetMap contributors',
    licence: 'ODbL-1.0 AND LicenseRef-none',
    licenceName: 'Open Database Licence',
    url: 'https://www.openstreetmap.org/copyright',
    snapshot: '2026-09-11',
    credited: true,
    indexed: false,
    alsoCredits: [GEONAMES],
  },
  /**
   * The world import's other third: a park on Trucks and Fins' map that
   * OpenStreetMap does not have. Point, name and filters are all Trucks and
   * Fins'; no licence was granted, so nothing asks for a credit and none is
   * given. Facts only — the site's descriptions, addresses and photographs
   * were never taken.
   */
  tnf: {
    id: 'tnf',
    name: 'Trucks and Fins',
    licence: 'LicenseRef-none',
    licenceName: '',
    url: 'https://trucksandfins.com',
    snapshot: '2026-09-11',
    credited: false,
    indexed: false,
    alsoCredits: [GEONAMES],
  },
} as const satisfies Record<string, SpotSource>;

export type SpotSourceId = keyof typeof SPOT_SOURCES;

/** The sources the credit line under the map has to name, in catalogue order. */
export function creditedSpotSources(): readonly SpotSource[] {
  return Object.values(SPOT_SOURCES).filter((source) => source.credited);
}

/** The source a `spots.source` value names, or `null` for one the catalogue does not know. */
function sourceFor(id: string | null | undefined): SpotSource | null {
  return id && Object.hasOwn(SPOT_SOURCES, id) ? SPOT_SOURCES[id as SpotSourceId] : null;
}

/**
 * May a spot page with this `source` be indexed? Yes unless the catalogue says
 * otherwise, so a row from before the column existed — or a value nobody
 * recognises — keeps the behaviour every page had.
 */
export function isIndexedSpotSource(id: string | null | undefined): boolean {
  return (sourceFor(id) as SpotSource | null)?.indexed !== false;
}

/** The `spots.source` values whose pages stay out of search, in catalogue order. */
export function unindexedSpotSourceIds(): readonly string[] {
  return Object.values(SPOT_SOURCES)
    .filter((source) => (source as SpotSource).indexed === false)
    .map((source) => source.id);
}

/**
 * Everything the credit line under the map names, in order: each credited
 * source, then every dataset any source draws on, each once.
 */
export function spotCredits(): readonly (SpotCredit & { readonly snapshot?: string })[] {
  const credits: (SpotCredit & { readonly snapshot?: string })[] = creditedSpotSources().map(
    (source) => ({
      name: source.name,
      licenceName: source.licenceName,
      url: source.url,
      ...(source.snapshot ? { snapshot: source.snapshot } : {}),
    }),
  );
  for (const source of Object.values(SPOT_SOURCES) as readonly SpotSource[]) {
    for (const credit of source.alsoCredits ?? []) {
      if (!credits.some((existing) => existing.name === credit.name)) credits.push(credit);
    }
  }
  return credits;
}
