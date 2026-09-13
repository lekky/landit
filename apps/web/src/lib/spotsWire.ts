import { SPORT_IDS, type SportId } from '@landit/core';
import type { SpotPoint } from '@landit/db';

/**
 * How every live spot travels between the server and the spots screen.
 *
 * Both ends read this file, so there is one definition of the wire and not two
 * that have to be kept in step: `lib/spotPoints.ts` builds the bodies,
 * `SpotsScreen` reads them. Nothing here touches Node or the DOM, and the
 * `@landit/db` import is a type that compiles away.
 *
 * ## Two halves
 *
 * The list is split in two, and `lib/spotPoints.ts` carries the measurements
 * and the reasoning. The short version: the half the list waits on is
 * `[id, lat, lng, sports, tags]` — everything needed to sort by distance and to
 * narrow by sport or feature — and the words follow separately, because names
 * and towns are half the bytes and nothing is waiting on them.
 *
 * `names[i]` describes `points[i]`, so the two are only ever paired when their
 * `version` strings agree. `mergePoints` below is the only place that pairing
 * happens, and it refuses a mismatch rather than labelling a spot with its
 * neighbour's name.
 */

/** A point on the wire: `[id, lat, lng, sports, tags]`. */
export type SpotPointTuple = readonly [
  id: string,
  lat: number,
  lng: number,
  sports: number,
  tags: readonly string[],
];

/** The words for the spot at the same index: `[name, town]`. */
export type SpotNameTuple = readonly [name: string, town: string];

export interface SpotPointsBody {
  readonly version: string;
  readonly points: readonly SpotPointTuple[];
}

export interface SpotNamesBody {
  readonly version: string;
  readonly names: readonly SpotNameTuple[];
}

const round5 = (value: number): number => Math.round(value * 1e5) / 1e5;

/**
 * Coordinates at five decimal places — about a metre on the ground, far finer
 * than any distance this product prints — and sports as a bitmask over
 * `SPORT_IDS` rather than an array of words. Both are there to make thirty
 * thousand rows smaller, and neither costs the screen anything it uses.
 */
export function toPointTuple(point: SpotPoint): SpotPointTuple {
  const sports = SPORT_IDS.reduce(
    (mask, sport, bit) => (point.sports.includes(sport) ? mask | (1 << bit) : mask),
    0,
  );
  return [point.id, round5(point.lat), round5(point.lng), sports, point.tags];
}

export function toNameTuple(point: SpotPoint): SpotNameTuple {
  return [point.name, point.town];
}

/** The sports a bitmask stands for, in `SPORT_IDS` order. */
export function sportsFromMask(mask: number): SportId[] {
  return SPORT_IDS.filter((_, bit) => (mask & (1 << bit)) !== 0);
}

/**
 * The two halves as one list the spot rules can read.
 *
 * **`names` is optional, and that is the whole point of the split.** Without
 * it every spot gets an empty name and town, which is exactly right for what
 * the screen does before the words arrive: sort by distance, narrow by sport,
 * narrow by feature. It is exactly wrong for matching a typed search or
 * labelling a pin, so `SpotsScreen` waits for the words before it does either
 * — this function cannot know which, and does not guess.
 *
 * **A version mismatch is treated as no names at all.** The snapshot refreshes
 * every few minutes, so a rider can hold points from one and names from the
 * next; pairing those by index would put a spot's neighbour's name on it. An
 * unlabelled list is a list that is briefly missing its search, which the
 * screen reports; a mislabelled one is a lie nobody would ever notice.
 */
export function mergePoints(
  points: SpotPointsBody,
  names: SpotNamesBody | null,
): { readonly spots: SpotPoint[]; readonly named: boolean } {
  const named = !!names && names.version === points.version;
  const words = named ? names.names : null;

  const spots = points.points.map((tuple, index) => {
    const [id, lat, lng, mask, tags] = tuple;
    const pair = words?.[index];
    return {
      id,
      name: pair?.[0] ?? '',
      town: pair?.[1] ?? '',
      lat,
      lng,
      sports: sportsFromMask(mask),
      tags,
    };
  });

  /*
   * `named` is only true when every spot actually got its words. A names half
   * that is somehow shorter than its points half is a bug rather than a state
   * to render, and saying "named" about it would hide it behind a list of
   * spots with blank names and a search that quietly matches nothing.
   */
  return { spots, named: named && (words?.length ?? 0) === points.points.length };
}

/** Is this what `/api/spots/points` is supposed to answer with? */
export function isPointsBody(value: unknown): value is SpotPointsBody {
  const body = value as Partial<SpotPointsBody> | null;
  return !!body && typeof body.version === 'string' && Array.isArray(body.points);
}

/** Is this what `/api/spots/names` is supposed to answer with? */
export function isNamesBody(value: unknown): value is SpotNamesBody {
  const body = value as Partial<SpotNamesBody> | null;
  return !!body && typeof body.version === 'string' && Array.isArray(body.names);
}
