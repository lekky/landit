import { describe, expect, it } from 'vitest';

import {
  MAP_DEFAULT_STYLE,
  MAP_STYLES,
  circleBounds,
  circlePolygon,
  clusterStep,
  describeMapError,
  isTileScopedMapError,
  planMarkers,
  spotsFeatureCollection,
  tokenColour,
  type SourceFeature,
} from './map';

describe('what a clustered map is fed (#388)', () => {
  it('is one point per spot with a place, carrying only its id and name', () => {
    const collection = spotsFeatureCollection([
      { id: 'a', name: 'Rampworx', lat: 53.4633, lng: -2.9632 },
      // PocketBase's unset number field: not a place, so not a point.
      { id: 'b', name: 'Nowhere yet', lat: 0, lng: 0 },
    ]);
    expect(collection).toEqual({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: 'a', name: 'Rampworx' },
          geometry: { type: 'Point', coordinates: [-2.9632, 53.4633] },
        },
      ],
    });
  });
});

describe('the size of a numbered block', () => {
  it('steps at ten and at a hundred, and no further', () => {
    expect([2, 9, 10, 99, 100, 3400].map(clusterStep)).toEqual([
      'small',
      'small',
      'medium',
      'medium',
      'large',
      'large',
    ]);
  });
});

describe('planning the markers from what the source has loaded', () => {
  const cluster = (id: number, count: number, short?: string | number): SourceFeature => ({
    geometry: { type: 'Point', coordinates: [2.35, 48.85] },
    properties: {
      cluster: true,
      cluster_id: id,
      point_count: count,
      point_count_abbreviated: short ?? count,
    },
  });
  const spot = (id: string): SourceFeature => ({
    geometry: { type: 'Point', coordinates: [-2.96, 53.46] },
    properties: { id, name: `Park ${id}` },
  });

  it('turns a cluster into a numbered block and a point into a pin', () => {
    expect(planMarkers([cluster(7, 12), spot('a')], null)).toEqual([
      { kind: 'cluster', key: 'c:7', clusterId: 7, count: 12, label: '12', lng: 2.35, lat: 48.85 },
      { kind: 'spot', key: 's:a', id: 'a', name: 'Park a', lng: -2.96, lat: 53.46 },
    ]);
  });

  it('prints a big count the short way supercluster hands it over', () => {
    expect(planMarkers([cluster(9, 3412, '3.4k')], null)[0]).toMatchObject({
      count: 3412,
      label: '3.4k',
    });
  });

  it('draws a feature once, however many loaded tiles hold it', () => {
    const plans = planMarkers([cluster(7, 12), spot('a'), cluster(7, 12), spot('a')], null);
    expect(plans.map((plan) => plan.key)).toEqual(['c:7', 's:a']);
  });

  it('leaves the chosen spot out, because the map draws that one on its own', () => {
    expect(planMarkers([spot('a'), spot('b')], 'a').map((plan) => plan.key)).toEqual(['s:b']);
  });

  it('ignores anything it cannot place, rather than trusting the worker', () => {
    const junk: SourceFeature[] = [
      { geometry: { type: 'Polygon', coordinates: [] }, properties: { id: 'poly' } },
      { geometry: { type: 'Point', coordinates: ['x', 1] }, properties: { id: 'nan' } },
      { geometry: null, properties: { id: 'none' } },
      { geometry: { type: 'Point', coordinates: [1, 1] }, properties: { cluster: true } },
      { geometry: { type: 'Point', coordinates: [1, 1] }, properties: { name: 'no id' } },
      { geometry: { type: 'Point', coordinates: [1, 1] }, properties: null },
    ];
    expect(planMarkers(junk, null)).toEqual([]);
  });
});

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

describe('circlePolygon', () => {
  const salford = { lat: 53.4836, lng: -2.27589, radiusM: 1500 };

  it('closes the ring, so the polygon is valid GeoJSON', () => {
    const ring = circlePolygon(salford, 32);
    expect(ring).toHaveLength(33);
    expect(ring.at(-1)).toEqual(ring[0]);
  });

  it('draws a circle on the ground rather than an ellipse', () => {
    // Every vertex should be the same distance from the centre in metres, not
    // in degrees — which is the whole reason for the cosine.
    const ring = circlePolygon(salford, 64);
    const metres = ring.map(([lng, lat]) => {
      const dy = (lat - salford.lat) * 111_320;
      const dx = (lng - salford.lng) * 111_320 * Math.cos((salford.lat * Math.PI) / 180);
      return Math.hypot(dx, dy);
    });
    for (const distance of metres) expect(distance).toBeCloseTo(1500, 0);
  });

  it('survives a point at the pole rather than dividing by zero', () => {
    const ring = circlePolygon({ lat: 90, lng: 0, radiusM: 1500 }, 8);
    for (const [lng, lat] of ring) {
      expect(Number.isFinite(lng)).toBe(true);
      expect(Number.isFinite(lat)).toBe(true);
    }
  });
});

describe('circleBounds', () => {
  it('holds the whole circle', () => {
    const area = { lat: 53.4836, lng: -2.27589, radiusM: 1500 };
    const [[west, south], [east, north]] = circleBounds(area);
    expect(west).toBeLessThan(area.lng);
    expect(east).toBeGreaterThan(area.lng);
    expect(south).toBeLessThan(area.lat);
    expect(north).toBeGreaterThan(area.lat);
    for (const [lng, lat] of circlePolygon(area)) {
      expect(lng).toBeGreaterThanOrEqual(west);
      expect(lng).toBeLessThanOrEqual(east);
      expect(lat).toBeGreaterThanOrEqual(south);
      expect(lat).toBeLessThanOrEqual(north);
    }
  });
});

describe('tokenColour', () => {
  it('falls back when the property is not set', () => {
    // jsdom resolves an unknown custom property to the empty string, which is
    // the same answer a server render gives.
    expect(tokenColour('--not-a-token', '#12100b')).toBe('#12100b');
  });
});
