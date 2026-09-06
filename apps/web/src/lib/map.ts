/**
 * The basemap the spots screen draws on: MapLibre GL, on OpenFreeMap's tiles.
 *
 * **No key, no account, no card** (plan §1, decided 2026-08-17). OpenFreeMap
 * publishes OpenStreetMap-derived vector tiles with no registration, no API
 * keys and no cookies, and permits commercial use. That removes the last thing
 * standing between a fresh checkout and a working map: there is nothing to
 * configure, in this repo or in Coolify, and CI draws the same map a rider does.
 *
 * **It also removes a third party from the request path.** Every tile a rider
 * fetched from Mapbox told Mapbox which spots a child was looking at. This is a
 * service that publishes tiles and keeps no user database — a better answer for
 * a product built to the Children's code (plan §6.4), and the reason this is
 * not merely a cost decision.
 *
 * **What we accept in exchange:** OpenFreeMap is a small, donation-funded
 * service with no SLA, and the owner chose it on that understanding. Nothing
 * here depends on it being up — `SpotMap` falls back to the list when the map
 * cannot be drawn, which is the same path a failed Mapbox load took.
 */

/**
 * The quiet ground — `MAP_STYLES.plain`, and no longer the one the map opens on
 * (see `MAP_DEFAULT_STYLE`).
 *
 * `positron` because the markers are loud by design: a low-contrast grey
 * basemap lets a rider read which pin is theirs and what road it is near,
 * without OpenFreeMap's busier styles fighting them. That is still exactly what
 * this style is *for*, and it is still one line to make it the default again —
 * what changed on 2026-08-31 is which of the two a rider is given first, not
 * the reasoning about what each one does.
 */
export const MAP_BASE_STYLE = 'https://tiles.openfreemap.org/styles/positron';

/* --------------------------------------------------- the two ground views -- */

/**
 * The two basemaps a rider can switch between, and why it is these two.
 *
 * **The ask was "can the map have a satellite view?" (owner, 2026-08-31).** It
 * cannot, not on the terms §1 set. Every satellite layer with usable coverage
 * is somebody's licensed product: Esri's key-free `World_Imagery` endpoint is
 * the one that works without an account, and its terms of use exclude
 * commercial use without an ArcGIS licence — landthetrick.com takes money, so
 * that is a licence we would be breaking, not a corner we would be cutting.
 * MapTiler and Mapbox sell imagery and would sell it to us, but the price is
 * the thing dropping Mapbox bought: an API key back in the build and in
 * Coolify, a card, and **a third party learning which spots a child looks at**
 * (§1, §6.4). Self-hosting planet imagery is terabytes on a box that also runs
 * somebody else's products.
 *
 * **So this answers the question underneath it instead** (owner chose this
 * over paid imagery, 2026-08-31, in chat). A rider asking for satellite is
 * asking "what does this place actually look like — where is the bowl, where do
 * I park, is it inside a leisure centre?". `liberty` is OpenFreeMap's
 * full-detail style and it draws exactly that from OpenStreetMap: building
 * footprints, car parks, footpaths, and the `leisure=pitch` / `sport=skateboard`
 * polygons that are the skatepark itself. It is the same host, the same
 * attribution, no key, no card, no new third party and no new cost — one extra
 * style fetch, on a map that is already loaded.
 *
 * **Detail leads** (owner, 2026-08-31, in chat — reversing the `plain` default
 * this shipped with hours earlier). The original argument was that the markers
 * are loud by design and a quiet ground is what lets a rider read which pin is
 * theirs; that is a real cost and it is why `plain` still exists one tap away.
 * But it optimised for reading the *map furniture* over answering the question
 * a rider came with. Somebody looking up a skatepark wants to know what the
 * place is — where the bowl is, where you park, whether it is inside a leisure
 * centre — and a ground with no buildings on it cannot tell them. A default
 * that has to be switched away from to be useful is the wrong way round.
 *
 * **What this makes riskier, stated plainly:** `liberty` under these markers
 * has never been looked at on real tiles (issue #261 — CI has no GPU and the
 * build sandbox cannot reach the tile host). That was a toggle nobody might
 * press; it is now the first thing every rider sees. If the pins turn out to be
 * hard to pick out, `MAP_DEFAULT_STYLE` is the one line that puts it back.
 */
export const MAP_STYLES = {
  plain: {
    id: 'plain',
    /** What the rider reads on the toggle. */
    label: 'Plain',
    url: MAP_BASE_STYLE,
  },
  detail: {
    id: 'detail',
    label: 'Detail',
    url: 'https://tiles.openfreemap.org/styles/liberty',
  },
} as const;

export type MapStyleId = keyof typeof MAP_STYLES;

/**
 * The ground the map opens on.
 *
 * One line, deliberately: this is the knob to turn if the detailed ground turns
 * out to fight the markers (see `MAP_STYLES`, and issue #261).
 */
export const MAP_DEFAULT_STYLE: MapStyleId = 'detail';

/**
 * Credit that is a condition of use, not a styling choice.
 *
 * **Stated here rather than left to the library.** MapLibre is supposed to read
 * this out of the tile source's own TileJSON and show it automatically, and in
 * a healthy browser it does. It is not, however, something to *rely* on: the
 * merge happens only once the source finishes loading, so a map that is slow,
 * throttled or never painted shows the credit late or not at all. Observed on
 * 2026-08-17 while checking this screen locally: the panel displayed our custom
 * line alone, with OpenStreetMap and OpenMapTiles absent, for as long as it was
 * watched — the style and its TileJSON had both fetched 200. Attribution that
 * appears only when the network cooperates is not attribution.
 *
 * **This is byte-identical to the string OpenFreeMap serves** at
 * `https://tiles.openfreemap.org/planet`, which is what makes stating it safe:
 * MapLibre de-duplicates identical attributions, so when the source does load
 * the credit appears once, not twice. If OpenFreeMap ever changes its wording
 * the two will diverge and both will show — visibly wrong, which is the right
 * way for this to fail.
 */
export const MAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> ' +
  '<a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> ' +
  'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';

/**
 * Where MapLibre's web worker is served from.
 *
 * **Not where the library looks for it by default.** maplibre-gl resolves the
 * worker at runtime from `import.meta.url`, expecting it beside the library —
 * which under a bundler is a hashed chunk in `/_next/static/chunks/`. It then
 * requests a file that was never emitted, Next returns its HTML 404 page, and
 * the browser rejects the module for its MIME type. No `error` event reaches
 * the map, so nothing falls back: markers, zoom controls and attribution are
 * all main-thread DOM and render perfectly over a **blank basemap**, because
 * every tile is fetched and parsed in that worker.
 *
 * `apps/web/scripts/sync-maplibre-worker.mjs` copies the worker and the shared
 * module it imports into `public/maplibre/` on every `dev` and `build`. This
 * constant is the other half; `SpotMap` hands it to `setWorkerUrl`.
 */
export const MAP_WORKER_URL = '/maplibre/maplibre-gl-worker.mjs';

/** Where the map opens when it has no spots to fit. */
export const MAP_DEFAULT_CENTRE = { lat: 53.4, lng: -2.5 } as const;
export const MAP_DEFAULT_ZOOM = 5.4;

/* ------------------------------------------------------ failure, sorted -- */

/**
 * A MapLibre `error` event, as far as the decision below needs it.
 *
 * Structural rather than imported: `maplibre-gl` is only ever loaded inside an
 * effect (see `SpotMap`), and importing its types here would undo that.
 *
 * `ErrorEvent` is built as `extend({ error }, data)`, so whatever the thrower
 * attached sits alongside the error itself — which is what makes `tile` below
 * a reliable signal rather than a guess.
 */
export interface MapErrorEvent {
  readonly error?: unknown;
  readonly tile?: unknown;
}

/**
 * Did this error concern **one tile**, rather than the map?
 *
 * **Why this question is worth asking.** MapLibre's `error` event is not a
 * "the map is broken" signal, and treating it as one cost us the whole map.
 * `TileManager._loadTile` fires an `ErrorEvent` for *any* tile request that
 * fails with something other than a 404:
 *
 *     catch (err) {
 *       tile.state = "errored";
 *       if (err.status !== 404) this._source.fire(new ErrorEvent(ensureError(err), { tile }));
 *     }
 *
 * and it reaches the map, because the source's tile manager has the Style as
 * its evented parent and the Style has the Map as its own. MapLibre excludes
 * 404 there deliberately — a missing tile is ordinary — so what arrives is
 * exactly the transient class: a 500, a 502, a 429, a dropped connection. The
 * guard on that line is `!isAbortError(err)`, so a failed fetch counts too.
 *
 * None of that is fatal. MapLibre marks the tile errored, carries on, and
 * still reports `loaded()`, `isStyleLoaded()` and `areTilesLoaded()` as true
 * afterwards — verified against 6.4.0 by serving the real `positron` style
 * with a single tile returning 500 (issue #219). The map is fine; one square
 * of it is missing.
 *
 * **Why it matters more here than it would elsewhere.** The basemap is
 * OpenFreeMap, which is documented above as donation-funded and without an
 * SLA, and riders read this screen outdoors on a phone while looking for a
 * park. A moment of bad signal mid-pan is the normal condition, not the edge
 * case, and it used to take the map away until the page was reloaded.
 *
 * **Everything else keeps the fallback.** A style that will not load or a GPU
 * that will not initialise leaves nothing to look at, and for those the honest
 * placeholder is still the right answer. This narrows the fatal class to what
 * is genuinely fatal; it does not remove it. Sprite and glyph fetches are not
 * separated out here — they are rarer, they are not what was proven, and
 * guessing at their URLs would be a heuristic rather than a signal.
 */
export function isTileScopedMapError(event: MapErrorEvent | undefined): boolean {
  return event?.tile != null;
}

/**
 * One line describing a map failure, for the console.
 *
 * **Because the old handler threw the evidence away.** `on('error', () =>
 * setFailed(true))` ignored the event it was handed and both `catch` blocks
 * were bare, so a rider reporting "the map did not load" — or the owner
 * screenshotting it — left nothing to diagnose from. `AJAXError` carries the
 * status and the URL that failed, which is the whole answer in most cases, and
 * it was being discarded.
 *
 * The console rather than Sentry: Sentry is off unless a DSN is set and there
 * is no project provisioned yet (`lib/sentry.ts`, issue #145), so reporting
 * there would be reporting nowhere.
 */
export function describeMapError(event: MapErrorEvent | undefined): string {
  const scope = isTileScopedMapError(event) ? 'one tile failed' : 'the map failed';
  const error = event?.error;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string' && error.length > 0
        ? error
        : 'no error was attached';
  return `${scope}: ${message}`;
}

/* ------------------------------------------------------- an area, drawn -- */

/**
 * A circle on the map, in metres, for a point we only know roughly.
 *
 * **This is the event page's shape, not the spots screen's.** A spot's
 * coordinates were read off a source and checked against the venue's own page,
 * so a spot is a pin. An event holds its *town* (issue #210), and the design
 * for that page draws an area with the venue somewhere inside it rather than a
 * pin that would claim to be the gate.
 */
export interface MapArea {
  readonly lat: number;
  readonly lng: number;
  /** How wide the claim is, in metres. */
  readonly radiusM: number;
}

/**
 * How roughly an event's point is known, in metres.
 *
 * 1.5km, because that is about the half-width of the towns this list is full of
 * and the circle has to be believable at that size: too small and it reads as a
 * venue, too large and it stops saying anything. It is one number rather than a
 * per-event field on purpose — we do not know the accuracy of any individual
 * row, and inventing a tighter one for a town we happen to recognise would be
 * exactly the fabrication the page's caption promises we do not do.
 */
export const EVENT_AREA_RADIUS_M = 1500;

/** Metres per degree of latitude — WGS84's mean, which is all this needs. */
const METRES_PER_DEGREE = 111_320;

/**
 * The ring of `[lng, lat]` pairs approximating `area`, closed at the start.
 *
 * **A polygon rather than a `circle` layer** because MapLibre's circles are
 * sized in screen pixels: one would grow and shrink against the ground as a
 * rider zoomed, and a claim about a real distance that changes with the zoom
 * level is not a claim at all. These vertices are in degrees, so the shape is
 * fixed to the map and 1.5km stays 1.5km.
 *
 * The longitude radius is divided by `cos(lat)` because degrees of longitude
 * narrow towards the poles; without it a circle over the UK draws as an ellipse
 * about a third too wide. Latitude is clamped short of the poles so the cosine
 * can never reach zero and hand back an infinite radius.
 */
export function circlePolygon(area: MapArea, steps = 96): [number, number][] {
  const latitude = Math.min(Math.max(area.lat, -89.9), 89.9);
  const dLat = area.radiusM / METRES_PER_DEGREE;
  const dLng = dLat / Math.cos((latitude * Math.PI) / 180);

  const ring: [number, number][] = [];
  for (let step = 0; step < steps; step += 1) {
    const angle = (step / steps) * 2 * Math.PI;
    ring.push([area.lng + dLng * Math.cos(angle), latitude + dLat * Math.sin(angle)]);
  }
  // GeoJSON wants the ring closed: the last position repeats the first.
  ring.push(ring[0]!);
  return ring;
}

/** `[[west, south], [east, north]]` — what the camera has to hold to show it all. */
export function circleBounds(area: MapArea): [[number, number], [number, number]] {
  const ring = circlePolygon(area, 96);
  const lngs = ring.map(([lng]) => lng);
  const lats = ring.map(([, lat]) => lat);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

/**
 * The value of a design token, resolved to something a WebGL layer can use.
 *
 * MapLibre paints on a canvas, so `var(--yellow)` means nothing to it — a layer
 * needs a concrete colour. Reading the custom property off the document keeps
 * `tokens.css` the single source of truth anyway, rather than pasting a hex
 * literal into a component and letting the two drift.
 *
 * The fallback is for the one case the read cannot answer: a server render, or
 * a browser that has not applied the stylesheet yet.
 */
export function tokenColour(name: string, fallback: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}
