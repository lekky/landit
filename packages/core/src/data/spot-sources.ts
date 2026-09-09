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
}

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
} as const satisfies Record<string, SpotSource>;

export type SpotSourceId = keyof typeof SPOT_SOURCES;

/** The sources the credit line under the map has to name, in catalogue order. */
export function creditedSpotSources(): readonly SpotSource[] {
  return Object.values(SPOT_SOURCES).filter((source) => source.credited);
}
