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
 * The base style the markers sit on.
 *
 * `positron` because the markers are loud by design: a quiet, low-contrast grey
 * basemap lets a rider read which pin is theirs and what road it is near, and
 * OpenFreeMap's louder styles (`liberty`, `bright`) fight them. This is the
 * same reasoning that picked Mapbox's `light-v11` before it, and swapping to
 * another style is still one line.
 */
export const MAP_BASE_STYLE = 'https://tiles.openfreemap.org/styles/positron';

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
