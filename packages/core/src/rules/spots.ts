import type { LatLng } from '../types';

/**
 * Spot geometry and the coordinate parsing behind spot submission.
 *
 * Coordinates are stored as plain `lat`/`lng` so the map provider stays
 * swappable (plan §1). Nothing here knows what a map is.
 */

const EARTH_RADIUS_MILES = 3958.7613;
const toRadians = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Great-circle distance in miles.
 *
 * The prototype stored a hard-coded `dist` on every spot ("2.4 mi"), measured
 * from a rider who does not exist. Distance belongs to the viewer, not to the
 * spot, so it is computed here from wherever the rider actually is.
 */
export function distanceMiles(from: LatLng, to: LatLng): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Are these usable coordinates on Earth? */
export function isValidLatLng(value: Partial<LatLng>): value is LatLng {
  return (
    typeof value.lat === 'number' &&
    typeof value.lng === 'number' &&
    Number.isFinite(value.lat) &&
    Number.isFinite(value.lng) &&
    Math.abs(value.lat) <= 90 &&
    Math.abs(value.lng) <= 180
  );
}

const COORD_PATTERN = /(-?\d{1,3}\.\d{3,})[, /@]+(-?\d{1,3}\.\d{3,})/;

/**
 * Pull a coordinate pair out of whatever a rider pasted: "53.4084, -2.9916" or
 * a Google Maps URL. Returns null when there is nothing usable in it, including
 * when the numbers parse but land off the planet.
 *
 * At least three decimal places are required, which is what keeps a house
 * number or a price out of the match.
 */
export function parseCoords(text: string | null | undefined): LatLng | null {
  if (!text) return null;
  const match = COORD_PATTERN.exec(String(text));
  if (!match) return null;
  const [, rawLat, rawLng] = match;
  if (rawLat === undefined || rawLng === undefined) return null;
  const candidate = { lat: Number.parseFloat(rawLat), lng: Number.parseFloat(rawLng) };
  return isValidLatLng(candidate) ? candidate : null;
}
