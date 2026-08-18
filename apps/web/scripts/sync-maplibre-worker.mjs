/**
 * Copy MapLibre's web worker into `public/maplibre/`, so the map can actually
 * draw a basemap.
 *
 * **Why this script has to exist.** maplibre-gl works out where its worker
 * lives at *runtime*, from `import.meta.url`:
 *
 *     let t = 'maplibre-gl-worker.mjs';
 *     return new URL(`./${t}`, import.meta.url).href;
 *
 * That assumes the worker sits next to the library. Under a bundler it does
 * not: `import.meta.url` resolves to a hashed chunk in `/_next/static/chunks/`,
 * so MapLibre asks for `/_next/static/chunks/maplibre-gl-worker.mjs`, Next
 * answers with its HTML 404 page, and the browser refuses it —
 * *"Failed to load module script: the server responded with a non-JavaScript
 * MIME type of text/html"*.
 *
 * **And the failure is silent where it matters.** No `error` event reaches the
 * map, so the screen does not fall back: the markers, the zoom controls and the
 * attribution are all main-thread DOM and render perfectly, over a blank
 * basemap. It looks like a styling bug and it is a missing worker. Shipped that
 * way on 2026-08-17 and spotted by the owner from a screenshot.
 *
 * **Both files, not one.** `maplibre-gl-worker.mjs` does
 * `import ... from "./maplibre-gl-shared.mjs"`, so the two have to stay
 * neighbours or the worker fails a second way.
 *
 * Runs from `dev` and `build`, like `sync-avatars.mjs` next door. If the map
 * draws pins on a blank background, this is the first thing to check.
 */
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Resolved rather than hard-coded, so a pnpm layout change or a version bump
// fails loudly here instead of quietly copying nothing.
const dist = path.dirname(require.resolve('maplibre-gl/dist/maplibre-gl.mjs'));
const to = path.join(here, '..', 'public', 'maplibre');

const files = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];

rmSync(to, { recursive: true, force: true });
mkdirSync(to, { recursive: true });

for (const file of files) {
  copyFileSync(path.join(dist, file), path.join(to, file));
}

console.log(`maplibre: copied ${files.length} files to public/maplibre/`);
