/**
 * A URL for a file PocketBase stores, from the path the mapping hands over.
 *
 * `TrickVideo.thumbPath` is `tricks/<recordId>/<filename>` — deliberately
 * without a host, because `@landit/core` is shared with the PocketBase hooks
 * and (later) an Expo app, and none of them agree on which deployment they are
 * pointed at. This is the web app's half of that split: it knows its own
 * PocketBase and is the only place that turns a path into something a browser
 * can fetch.
 *
 * **It resolves to our own backend, which is the entire point.** The poster it
 * feeds exists so a rider sees a real frame of the tutorial *without* the page
 * asking Google for a thumbnail — see `VideoEmbed` and plan §6.8. If this ever
 * started returning a `ytimg.com` URL, `e2e/video-links.spec.ts` would fail,
 * and it should.
 */
const BASE = process.env.NEXT_PUBLIC_POCKETBASE_URL ?? '';

export function pbFileUrl(path: string | undefined): string | undefined {
  const clean = path?.trim();
  if (!clean || !BASE) return undefined;

  // A path is built by `videoOf` from a record id and a stored filename, so it
  // is not user input — but it lands in an `<img src>`, and a value with a
  // scheme in it would leave our own host entirely. Anything that is not the
  // three plain segments we expect is dropped, and the drawn poster is shown.
  if (!/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/.test(clean)) return undefined;

  return `${BASE.replace(/\/+$/, '')}/api/files/${clean}`;
}
