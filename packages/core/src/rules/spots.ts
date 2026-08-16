import { SPOT_TYPES } from '../data/spots';
import type { LatLng, SportId } from '../types';

/**
 * Spot geometry and the coordinate parsing behind spot submission.
 *
 * Coordinates are stored as plain `lat`/`lng` so the map provider stays
 * swappable (plan §1). Nothing here knows what a map is — no Mapbox type, no
 * `navigator`, no `window`. T13's map component calls into this file; this file
 * has never heard of it, which is what keeps the provider a one-screen change.
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

/* ------------------------------------------------- reading what was pasted -- */

/** Hosts whose links carry no coordinates at all — only a lookup key. */
const SHORT_LINK_HOSTS = ['maps.app.goo.gl', 'goo.gl/maps', 'g.co/kgs', 'maps.apple.com/p/'];

/**
 * Why a paste could not be read, so the screen can say something better than
 * "invalid".
 *
 * `short-link` is the one worth separating. A Google Maps share sheet hands out
 * `https://maps.app.goo.gl/xxxx`, which contains no coordinates — following it
 * would mean the server fetching a URL a rider chose, which is a request-forgery
 * surface we are not opening for a convenience. So the rider is told to open it
 * and copy the full one, which is a sentence a fourteen year old can act on.
 */
export type SpotLocationRefusal = 'empty' | 'short-link' | 'unreadable';

export type SpotLocationResult =
  | { readonly ok: true; readonly value: LatLng }
  | { readonly ok: false; readonly reason: SpotLocationRefusal };

/** `parseCoords`, plus the reason it said no. */
export function parseSpotLocation(text: string | null | undefined): SpotLocationResult {
  const raw = String(text ?? '').trim();
  if (!raw) return { ok: false, reason: 'empty' };

  const found = parseCoords(raw);
  if (found) return { ok: true, value: found };

  const lowered = raw.toLowerCase();
  if (SHORT_LINK_HOSTS.some((host) => lowered.includes(host))) {
    return { ok: false, reason: 'short-link' };
  }
  return { ok: false, reason: 'unreadable' };
}

/** What to tell the rider about a paste that did not work out. */
export function spotLocationMessage(reason: SpotLocationRefusal): string {
  if (reason === 'empty') return 'Paste a Google Maps link, or a pair of coordinates.';
  if (reason === 'short-link') {
    return 'That is a short link, and it does not carry the location. Open it in Maps and copy the full link from the address bar.';
  }
  return 'We cannot read a location out of that. A Maps link, or “53.4084, -2.9916”.';
}

/* ------------------------------------------------------ spots on a screen -- */

/**
 * The narrowest shape the spot rules need. Both `Spot` from `../data` and a
 * `spots` record straight out of PocketBase satisfy it.
 */
export interface SpotLike {
  readonly name: string;
  readonly town?: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly sports?: readonly string[];
  readonly tags?: readonly string[];
}

/**
 * Does this spot have somewhere to be plotted?
 *
 * **Zero is not a location here.** PocketBase returns an unset number field as
 * `0`, so a spot submitted without coordinates comes back as `{lat: 0, lng: 0}`
 * — a real point in the Gulf of Guinea, six hundred miles from the nearest
 * skatepark. Treating it as absent is what stops "no location" rendering as a
 * pin in the Atlantic, and it costs the one rider who ever submits Null Island
 * nothing they will notice.
 */
export function hasCoords(spot: Pick<SpotLike, 'lat' | 'lng'>): boolean {
  if (spot.lat === 0 && spot.lng === 0) return false;
  return isValidLatLng({ lat: spot.lat, lng: spot.lng });
}

/** The spot's point, or null if it has none. */
export function spotLatLng(spot: Pick<SpotLike, 'lat' | 'lng'>): LatLng | null {
  return hasCoords(spot) ? { lat: spot.lat as number, lng: spot.lng as number } : null;
}

/**
 * A link that opens the spot in whatever maps app the rider has.
 *
 * Google's `?api=1` search URL, exactly as the prototype used it: it is the one
 * form that hands off to the native app on both phones instead of opening a web
 * page inside a browser. It carries the *spot's* coordinates and nothing about
 * the rider — no origin, no "directions from here" (§6.4 standard 10).
 */
export function mapsLink(spot: Pick<SpotLike, 'lat' | 'lng'>): string {
  const point = spotLatLng(spot);
  if (!point) return '';
  return `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`;
}

/** Search matches the name, the town or a feature tag — what the placeholder promises. */
export function spotMatchesSearch(spot: SpotLike, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [spot.name, spot.town ?? '', ...(spot.tags ?? [])].join(' ').toLowerCase();
  return haystack.includes(needle);
}

/**
 * Is this spot good for that sport?
 *
 * A spot with no sports listed matches every sport, which is the prototype's
 * behaviour and the right default: an untagged concrete park is not a
 * scooter-only park, it is a park nobody has tagged yet.
 */
export function spotMatchesSport(spot: SpotLike, sport: SportId | null): boolean {
  if (!sport) return true;
  const sports = spot.sports ?? [];
  return sports.length === 0 || sports.includes(sport);
}

export interface SpotQuery {
  readonly search?: string;
  /** `null` is the prototype's "Every spot" pill. */
  readonly sport?: SportId | null;
}

/** The list under the search box, in the order it was given. */
export function filterSpots<T extends SpotLike>(spots: readonly T[], query: SpotQuery): T[] {
  return spots.filter(
    (spot) =>
      spotMatchesSearch(spot, query.search ?? '') && spotMatchesSport(spot, query.sport ?? null),
  );
}

/**
 * Nearest first, from wherever the rider says they are.
 *
 * Takes the point as an argument and keeps no copy of it, because the rider's
 * position is not ours to hold (§6.4 standard 10): it lives in one component's
 * state for as long as the rider leaves it on, and this function only ever sees
 * it. Spots with no coordinates keep their order and go last — they cannot be
 * near anything.
 */
export function sortSpotsByDistance<T extends SpotLike>(spots: readonly T[], from: LatLng): T[] {
  return spots
    .map((spot, index) => ({ spot, index, point: spotLatLng(spot) }))
    .sort((a, b) => {
      if (!a.point && !b.point) return a.index - b.index;
      if (!a.point) return 1;
      if (!b.point) return -1;
      const gap = distanceMiles(from, a.point) - distanceMiles(from, b.point);
      return gap === 0 ? a.index - b.index : gap;
    })
    .map((entry) => entry.spot);
}

/** "2.4 mi", the way the prototype's hard-coded string read — computed, from the viewer. */
export function distanceLabel(from: LatLng, spot: Pick<SpotLike, 'lat' | 'lng'>): string | null {
  const point = spotLatLng(spot);
  if (!point) return null;
  const miles = distanceMiles(from, point);
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}

/* -------------------------------------------------------------- submission -- */

/**
 * How often one rider may submit a spot, and how many may be waiting for staff
 * at once.
 *
 * **Tunable defaults, not deliberated decisions** — the same status the plan
 * gives `WEEKLY_RIDE_TARGET`. What is deliberate is that a limit exists and that
 * it is enforced on the *server*: these three numbers are mirrored in
 * `pocketbase/hooks/62_spots.pb.js`, which is where a submission is actually
 * refused. The copies here exist so the form can say "you have used two of
 * three" before the rider types anything, never so the client can decide.
 *
 * The pending cap is the one that matters. Without it a rider blocked by the
 * hourly window simply comes back tomorrow, and the review queue — a queue
 * humans read — grows faster than it is emptied.
 */
export const SPOT_SUBMISSION_WINDOW_MINUTES = 60;
export const SPOT_SUBMISSION_MAX_PER_WINDOW = 3;
export const SPOT_SUBMISSION_MAX_PENDING = 10;

export const SPOT_NAME_MAX_LENGTH = 80;
export const SPOT_TOWN_MAX_LENGTH = 60;
export const SPOT_MAX_TAGS = 8;
export const SPOT_TAG_MAX_LENGTH = 24;

/** What the rider typed into the form, before anything has been read out of it. */
export interface SpotSubmissionDraft {
  readonly name: string;
  readonly town: string;
  readonly type: string;
  /** A Maps link or a coordinate pair, as pasted. */
  readonly coords: string;
  readonly sports: readonly SportId[];
  /** Comma separated, as the prototype's field takes them. */
  readonly tags: string;
}

/** The draft, read into the shape `spots` stores. */
export interface SpotSubmission {
  readonly name: string;
  readonly town: string;
  readonly type: string;
  readonly lat: number;
  readonly lng: number;
  readonly sports: readonly SportId[];
  readonly tags: readonly string[];
}

/** One message per field that is not right yet, keyed by field name. Empty means good. */
export type SpotSubmissionProblems = Partial<Record<keyof SpotSubmissionDraft, string>>;

export function splitSpotTags(raw: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of String(raw ?? '').split(',')) {
    const tag = part.trim().slice(0, SPOT_TAG_MAX_LENGTH);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags.slice(0, SPOT_MAX_TAGS);
}

/**
 * Everything wrong with a submission, in the rider's words.
 *
 * **Coordinates are required**, which the prototype's form did not ask for. Two
 * reasons, both recorded against T13 in the plan: a spot with no point cannot be
 * plotted on a map whose whole job is plotting them, and a reviewer handed a
 * name and a town has nothing to check — the queue exists so that a human
 * confirms a real place, and "Rampworx, Liverpool" typed by a stranger is not a
 * place, it is a claim.
 *
 * This is a *definition*, not a gate. The refusals that matter — the `pending`
 * status and the rate limit — are in the PocketBase hook, on the server, where a
 * client cannot reach them (plan §3).
 */
export function spotSubmissionProblems(draft: SpotSubmissionDraft): SpotSubmissionProblems {
  const problems: Record<string, string> = {};

  const name = draft.name.trim();
  if (!name) problems.name = 'Give the spot a name.';
  else if (name.length > SPOT_NAME_MAX_LENGTH) {
    problems.name = `${SPOT_NAME_MAX_LENGTH} characters at most.`;
  }

  const town = draft.town.trim();
  if (!town) problems.town = 'Which town is it in?';
  else if (town.length > SPOT_TOWN_MAX_LENGTH) {
    problems.town = `${SPOT_TOWN_MAX_LENGTH} characters at most.`;
  }

  if (!SPOT_TYPES.includes(draft.type as (typeof SPOT_TYPES)[number])) {
    problems.type = 'Pick what kind of spot it is.';
  }

  const location = parseSpotLocation(draft.coords);
  if (!location.ok) problems.coords = spotLocationMessage(location.reason);

  if (!draft.sports.length) problems.sports = 'Say who it is good for.';

  return problems as SpotSubmissionProblems;
}

/**
 * The draft as a record, or the problems with it. Callers get one or the other,
 * so there is no path that submits a draft nobody checked.
 */
export function readSpotSubmission(
  draft: SpotSubmissionDraft,
):
  | { readonly ok: true; readonly value: SpotSubmission }
  | { readonly ok: false; readonly problems: SpotSubmissionProblems } {
  const problems = spotSubmissionProblems(draft);
  if (Object.keys(problems).length) return { ok: false, problems };

  const location = parseSpotLocation(draft.coords);
  /* c8 ignore next -- `spotSubmissionProblems` has already refused every non-ok location. */
  if (!location.ok)
    return { ok: false, problems: { coords: spotLocationMessage(location.reason) } };

  return {
    ok: true,
    value: {
      name: draft.name.trim(),
      town: draft.town.trim(),
      type: draft.type,
      lat: location.value.lat,
      lng: location.value.lng,
      sports: [...draft.sports],
      tags: splitSpotTags(draft.tags),
    },
  };
}
