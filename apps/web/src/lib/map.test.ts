import { describe, expect, it } from 'vitest';

import { MAP_DEFAULT_STYLE, MAP_STYLES, describeMapError, isTileScopedMapError } from './map';

/**
 * Sorting a MapLibre `error` event into "one tile" and "the map" (issue #219).
 *
 * The events below are shaped the way `maplibre-gl` 6.4.0 builds them:
 * `new ErrorEvent(error, data)` is `extend({ error }, data)`, and the tile
 * loader passes `{ tile }`. `AJAXError` carries `status`, `statusText`, `url`
 * and `body`, and its message is assembled from the first three.
 */

/** What `TileManager._loadTile` fires when a tile request fails. */
function tileError(status: number, url: string) {
  const error = Object.assign(new Error(`AJAXError: Internal Server Error (${status}): ${url}`), {
    status,
    url,
  });
  return { error, tile: { state: 'errored' } };
}

describe('isTileScopedMapError', () => {
  it('treats a failed tile as one tile, not a broken map', () => {
    const event = tileError(500, 'https://tiles.openfreemap.org/planet/5/15/10.pbf');
    expect(isTileScopedMapError(event)).toBe(true);
  });

  it.each([502, 429, 503])('treats a %i on a tile the same way', (status) => {
    expect(isTileScopedMapError(tileError(status, 'https://example.test/1/2/3.pbf'))).toBe(true);
  });

  it('treats a dropped connection on a tile as recoverable too', () => {
    // A failed fetch reaches the same line: the guard there is `!isAbortError`,
    // and a network failure is not an abort.
    const event = { error: new TypeError('Failed to fetch'), tile: { state: 'errored' } };
    expect(isTileScopedMapError(event)).toBe(true);
  });

  it('does not excuse a style that will not load', () => {
    // No `tile`, because nothing tile-scoped threw. There is no map to keep.
    const error = Object.assign(new Error('AJAXError: Not Found (404): /styles/positron'), {
      status: 404,
    });
    expect(isTileScopedMapError({ error })).toBe(false);
  });

  it('does not excuse an error with no attachments at all', () => {
    expect(isTileScopedMapError({ error: new Error('WebGL context could not be created') })).toBe(
      false,
    );
  });

  it('survives an event that is missing or empty', () => {
    expect(isTileScopedMapError(undefined)).toBe(false);
    expect(isTileScopedMapError({})).toBe(false);
  });
});

describe('describeMapError', () => {
  it('keeps the status and the URL, which is the whole diagnosis', () => {
    const url = 'https://tiles.openfreemap.org/planet/5/15/10.pbf';
    expect(describeMapError(tileError(500, url))).toBe(
      `one tile failed: AJAXError: Internal Server Error (500): ${url}`,
    );
  });

  it('says when the map itself went, not a tile', () => {
    expect(describeMapError({ error: new Error('no WebGL') })).toBe('the map failed: no WebGL');
  });

  it('says so plainly when there is nothing attached', () => {
    expect(describeMapError({})).toBe('the map failed: no error was attached');
    expect(describeMapError(undefined)).toBe('the map failed: no error was attached');
  });

  it('takes a bare string error as its message', () => {
    expect(describeMapError({ error: 'something went wrong' })).toBe(
      'the map failed: something went wrong',
    );
  });
});

describe('the two grounds', () => {
  /*
   * **A deliberate owner decision, pinned so a tidy-up cannot quietly reverse
   * it** (2026-08-31, in chat). The map shipped opening on `plain` that morning
   * — a quiet ground so the loud markers read — and the default was reversed the
   * same day because it optimised for reading the map furniture over answering
   * the question a rider arrived with: what does this place actually look like.
   *
   * The reasoning for both sides is in `MAP_STYLES`, and either is one line to
   * choose. This test is not an argument for one of them; it is the thing that
   * makes changing it deliberate, the way `analytics.test.ts` does for the
   * event catalogue.
   *
   * It is also the only automated check on this at all: the toggle lives inside
   * the map, CI has no GPU, and no browser test in this repo ever sees a drawn
   * map (issue #227).
   */
  it('opens on the detailed ground', () => {
    expect(MAP_DEFAULT_STYLE).toBe('detail');
  });

  it('offers a quiet ground to switch to, on the same host and key-free', () => {
    // The point of `plain` is that it is *there*: if the detail turns out to
    // fight the markers, this is what a rider taps. And both must stay on
    // OpenFreeMap — a licensed or key-bearing tile host is a §1 decision, not
    // something a style URL edit gets to make (see `MAP_STYLES`).
    expect(MAP_DEFAULT_STYLE in MAP_STYLES).toBe(true);
    for (const style of Object.values(MAP_STYLES)) {
      expect(style.url.startsWith('https://tiles.openfreemap.org/styles/')).toBe(true);
    }
  });
});
