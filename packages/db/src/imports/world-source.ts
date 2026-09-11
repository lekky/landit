/**
 * The shape of the world skatepark snapshot, shared by the script that writes
 * it (`scripts/import-world.mts`) and the mapping that reads it (`./world.ts`).
 *
 * **Its own module, with no imports**, because the script runs under Node's
 * type stripping before the snapshot exists: it needs these values at run time,
 * and `./world.ts` imports the snapshot it is about to write.
 */

/**
 * One park, reduced to what the mapping needs, in this order.
 *
 * - `tnfId` — the park's number on Trucks and Fins, whose map is the list of
 *   places this import covers.
 * - `osmRef` — the OpenStreetMap object within 150 metres of it (`n123`,
 *   `w456`, `r789`), matched one to one, or `''` where OpenStreetMap has none.
 * - `lat`, `lng` — OpenStreetMap's point where there is a match, otherwise
 *   Trucks and Fins'.
 * - `osmName`, `tnfName` — each source's name for it, as written.
 * - `flags` — which of Trucks and Fins' map filters list it ({@link TNF_FLAG}).
 * - `osmBits` — what the OpenStreetMap object's tags say ({@link OSM_BIT}).
 * - `address`, `phone` — from OpenStreetMap's `addr:*` and `phone` tags only.
 * - `town` — the nearest GeoNames populated place, preferring the one the
 *   park's own name points at.
 * - `country` — ISO 3166-1 alpha-2, the town's, checked against the Natural
 *   Earth border the point falls inside.
 */
export type WorldSourceRow = readonly [
  tnfId: number,
  osmRef: string,
  lat: number,
  lng: number,
  osmName: string,
  tnfName: string,
  flags: number,
  osmBits: number,
  address: string,
  phone: string,
  town: string,
  country: string,
];

/**
 * An OpenStreetMap skateboarding object that no park on Trucks and Fins' map
 * was matched to (#390), with the area its outline encloses. Ways and relations
 * only: a node has no outline, so nothing can say how big it is.
 *
 * - `osmRef` — `w123` or `r456`.
 * - `lat`, `lng` — the outline's centre, as Overpass gives it.
 * - `osmName` — as in {@link WorldSourceRow}.
 * - `osmBits` — {@link OSM_BIT}, including `private`.
 * - `area` — square metres, rounded; `0` never reaches the file.
 * - `address`, `phone`, `town`, `country` — as in {@link WorldSourceRow}.
 */
export type WorldOsmRow = readonly [
  osmRef: string,
  lat: number,
  lng: number,
  osmName: string,
  osmBits: number,
  area: number,
  address: string,
  phone: string,
  town: string,
  country: string,
];

/** Trucks and Fins' map filters, as bits of `flags`. */
export const TNF_FLAG = {
  halfpipe: 1 << 0,
  pumpTrack: 1 << 1,
  concrete: 1 << 2,
  bowl: 1 << 3,
  miniRamp: 1 << 4,
  snakeRun: 1 << 5,
  diy: 1 << 6,
  indoor: 1 << 7,
  fullPipe: 1 << 8,
  closed: 1 << 9,
  streetSpot: 1 << 10,
  seventies: 1 << 11,
  vert: 1 << 12,
} as const;

export type TnfFlag = keyof typeof TNF_FLAG;

/**
 * The site's `f_feature` values and what each one is called on its filter,
 * read off `/en/spots?f_skate=1` on 2026-09-11. "RIP" is the site's word for a
 * park that has gone.
 */
export const TNF_FILTERS: Readonly<
  Record<number, { readonly flag: TnfFlag; readonly label: string }>
> = {
  7: { flag: 'halfpipe', label: 'Halfpipe' },
  14: { flag: 'pumpTrack', label: 'Pumptrack' },
  18: { flag: 'concrete', label: 'Concrete Park' },
  22: { flag: 'bowl', label: 'Bowl' },
  29: { flag: 'miniRamp', label: 'MiniRamp' },
  36: { flag: 'snakeRun', label: 'Snakerun' },
  38: { flag: 'diy', label: 'DIY' },
  40: { flag: 'indoor', label: 'Indoor/sheltered' },
  46: { flag: 'fullPipe', label: 'Fullpipe' },
  51: { flag: 'closed', label: 'RIP' },
  52: { flag: 'streetSpot', label: 'Street spot' },
  59: { flag: 'seventies', label: 'Built in the 70s' },
  98: { flag: 'vert', label: 'Vert' },
};

/** What an OpenStreetMap object's tags say, as bits of `osmBits`. */
export const OSM_BIT = {
  /** `covered=yes`, `indoor=yes`, `location=indoor`, or a `building` tag. */
  covered: 1 << 0,
  /** `sport` names BMX. */
  bmx: 1 << 1,
  /** `disused=yes` or `abandoned=yes`. */
  closed: 1 << 2,
  /** `access=private` or `access=no`: never listed. */
  private: 1 << 3,
} as const;

/** `spots.town` is `max: 60` (`1786838400_init_collections.js`). */
export const TOWN_MAX = 60;
/** `spots.address` is `max: 200` (`1787529600_spot_address_and_phone.js`). */
export const ADDRESS_MAX = 200;
/** `spots.phone` is `max: 40`, same migration. */
export const PHONE_MAX = 40;
