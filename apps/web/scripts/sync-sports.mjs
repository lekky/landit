/**
 * Copy the sport equipment art from `@landit/ui-web` into `public/sports/`.
 *
 * Same shape as `sync-avatars.mjs` and `sync-stickers.mjs`, for the same
 * reason: the three stickers are package assets — they live once, in the design
 * system — and Next can only serve static files out of `public/`, so they are
 * copied there at dev and build time rather than committed twice.
 * `public/sports/` is git-ignored.
 *
 * Two files per sport since 2026-09-16: `<name>.png` at 256px and
 * `<name>@2x.png` at 512px, which `Equipment` offers together through `srcset`.
 * Both are plain `.png` in the same directory, so the copy below already takes
 * them — but a `srcset` candidate that 404s shows a broken image rather than
 * falling back, so anything that narrows this filter has to leave the `@2x`
 * alone. `packages/ui-web/scripts/export-sport-art.mjs` is what writes them.
 *
 * This runs from the `dev` and `build` scripts. If a sport chip shows a broken
 * picture instead of a scooter, this is the first thing to check.
 */
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const from = path.join(here, '..', '..', '..', 'packages', 'ui-web', 'assets', 'sports');
const to = path.join(here, '..', 'public', 'sports');

rmSync(to, { recursive: true, force: true });
mkdirSync(to, { recursive: true });

const files = readdirSync(from).filter((f) => f.endsWith('.png'));
for (const file of files) {
  copyFileSync(path.join(from, file), path.join(to, file));
}

console.log(`sports: copied ${files.length} files to public/sports/`);
