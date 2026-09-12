/**
 * How both halves of the spot snapshot are served (`./points`, `./names`).
 *
 * Shared so the two cannot drift into caching differently, which would be a
 * quiet way to break the alignment their `version` exists to guarantee.
 */

/**
 * Five minutes, matching the snapshot's own life in memory. Inside that window
 * a return to `/spots` costs no request at all; after it, the browser revalidates
 * and is answered with a 304 unless the spots themselves have changed. `stale-
 * while-revalidate` lets it draw the old list immediately and check in the
 * background, which is exactly what the server does with the same data.
 */
const CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=86400';

/**
 * The body, with the caching a public list deserves.
 *
 * **The 304 is the point.** `version` is a hash of the spots, so the tag only
 * changes when a spot does — a rider coming back tomorrow sends one conditional
 * request and gets an empty answer rather than another 437 KB.
 *
 * `If-None-Match` is compared loosely on purpose: a proxy in front of this app
 * may append a suffix of its own (`"abc-gzip"`) or mark the tag weak
 * (`W/"abc"`), and an exact string comparison would silently stop matching and
 * send the whole body every time. The worst a loose match can do here is serve
 * a 304 for a body the caller already has, which is the correct answer anyway.
 */
export function snapshotResponse(request: Request, body: string, etag: string): Response {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': CACHE_CONTROL,
    etag,
    // The bytes are identical for everyone, but say so rather than leave a
    // shared cache to work it out from the absence of a Vary.
    vary: 'Accept-Encoding',
  };

  if (matches(request.headers.get('if-none-match'), etag)) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(body, { status: 200, headers });
}

/** Does one of the caller's tags name this body, allowing for weak and suffixed forms? */
function matches(header: string | null, etag: string): boolean {
  if (!header) return false;
  if (header.trim() === '*') return true;

  const wanted = core(etag);
  return header.split(',').some((candidate) => core(candidate) === wanted);
}

/**
 * The tag inside a tag: without `W/`, without quotes, and without the suffix a
 * compressing proxy bolts on.
 *
 * **Everything after the first dash goes**, which is why neither route may put
 * a dash in a tag of its own — the two halves are told apart by a *prefix*
 * (`p…`/`n…`, see `spotTag`) rather than a suffix for exactly this reason. A
 * suffix would be eaten here, the two tags would compare equal, and a browser
 * holding the points would be handed a 304 for the names.
 */
function core(tag: string): string {
  const unquoted = tag.trim().replace(/^W\//i, '').replace(/"/g, '');
  const dash = unquoted.indexOf('-');
  return dash === -1 ? unquoted : unquoted.slice(0, dash);
}

/**
 * The entity tag for one half of a snapshot.
 *
 * The half's letter leads, so the points and the names of the same snapshot are
 * never the same tag, and so neither can be mistaken for the other's cached
 * copy. See `core` above for why it cannot be a suffix.
 */
export function spotTag(half: 'points' | 'names', version: string): string {
  return `"${half === 'points' ? 'p' : 'n'}${version}"`;
}
