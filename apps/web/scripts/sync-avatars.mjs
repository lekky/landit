/**
 * Copy the built-in avatar PNGs from `@landit/ui-web` into `public/avatars/`.
 *
 * The 36 images are package assets: they live once, in the design system, and
 * nothing deep-links into `design-handoff/`. Next can only serve static files
 * out of `public/`, so they are copied there at dev and build time rather than
 * committed twice. `public/avatars/` is git-ignored for that reason.
 *
 * This runs from the `dev` and `build` scripts. If avatars are missing from a
 * page, that is the first thing to check.
 */
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const from = path.join(here, '..', '..', '..', 'packages', 'ui-web', 'assets', 'avatars');
const to = path.join(here, '..', 'public', 'avatars');

rmSync(to, { recursive: true, force: true });
mkdirSync(to, { recursive: true });

const files = readdirSync(from).filter((f) => f.endsWith('.png'));
for (const file of files) {
  copyFileSync(path.join(from, file), path.join(to, file));
}

console.log(`avatars: copied ${files.length} files to public/avatars/`);
