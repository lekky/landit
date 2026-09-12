'use client';

import {
  isNamesBody,
  isPointsBody,
  type SpotNamesBody,
  type SpotPointsBody,
} from '@/lib/spotsWire';

/**
 * Fetching the two halves of the spot list from their routes.
 *
 * Split out of `SpotsScreen` so the screen's effects read as *when* each half
 * is wanted rather than as the mechanics of getting it, and so the one thing
 * that can go quietly wrong — a 200 carrying something that is not the body we
 * asked for — is checked in one place with a test beside it.
 *
 * **These throw.** Both call sites wrap them in `runActionOr`, which is what
 * turns a throw into the sentence the screen puts on the list; a helper that
 * swallowed its own failures would hand back an empty list that looks exactly
 * like "there are no spots" (LESSONS §7a).
 */

/**
 * `cache: 'default'` rather than Next's patched default.
 *
 * Next replaces `fetch` in client bundles too, and its own caching layer is
 * built for server-side data with `revalidate` tags. What these two routes want
 * is the plain HTTP cache: they set `Cache-Control` and an `ETag` themselves,
 * and the browser's own store is the thing that turns a second visit into a
 * conditional request or no request at all. Asking for `default` is asking for
 * exactly the behaviour the headers describe.
 */
const REQUEST: RequestInit = { cache: 'default', credentials: 'omit' };

async function read(url: string): Promise<unknown> {
  const response = await fetch(url, REQUEST);
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json();
}

/** Every live spot's id, point, sports and tags — the half the list waits on. */
export async function fetchSpotPoints(): Promise<SpotPointsBody> {
  const body = await read('/api/spots/points');
  if (!isPointsBody(body)) throw new Error('/api/spots/points answered something else');
  return body;
}

/** The names and towns for the same spots, in the same order. */
export async function fetchSpotNames(): Promise<SpotNamesBody> {
  const body = await read('/api/spots/names');
  if (!isNamesBody(body)) throw new Error('/api/spots/names answered something else');
  return body;
}
