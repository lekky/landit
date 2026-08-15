/**
 * Refresh the self-hosted font files in `src/fonts/` from the Fontsource
 * packages in `devDependencies`.
 *
 * The plan (§2.5) requires Anton, Barlow Condensed and Archivo to be served
 * from our own origin, never the Google Fonts CDN: the audience is children,
 * the cookie policy promises no cross-site tracking, and GDPR case law has gone
 * against CDN font pings. So the `.woff2` files are committed to the repo and
 * loaded with `next/font/local`.
 *
 * This script is NOT part of the build — the fonts are already in the repo. Run
 * it by hand (`pnpm --filter @landit/web fonts:sync`) when a font needs
 * updating, so the provenance of those binaries is a command and not a memory.
 *
 * Only the `latin` subset is shipped. Fontsource splits subsets into separate
 * files with `unicode-range`, and `next/font/local` has no way to express that,
 * so latin-ext and Vietnamese glyphs fall back to the system font.
 */
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'src', 'fonts');

/** [package, file within the package, name it gets in src/fonts/] */
const FILES = [
  ['@fontsource/anton', 'files/anton-latin-400-normal.woff2', 'anton-latin-400.woff2'],
  ['@fontsource/anton', 'LICENSE', 'anton-OFL.txt'],

  [
    '@fontsource/barlow-condensed',
    'files/barlow-condensed-latin-500-normal.woff2',
    'barlow-condensed-latin-500.woff2',
  ],
  [
    '@fontsource/barlow-condensed',
    'files/barlow-condensed-latin-600-normal.woff2',
    'barlow-condensed-latin-600.woff2',
  ],
  [
    '@fontsource/barlow-condensed',
    'files/barlow-condensed-latin-700-normal.woff2',
    'barlow-condensed-latin-700.woff2',
  ],
  ['@fontsource/barlow-condensed', 'LICENSE', 'barlow-condensed-OFL.txt'],

  [
    '@fontsource-variable/archivo',
    'files/archivo-latin-wght-normal.woff2',
    'archivo-latin-variable.woff2',
  ],
  ['@fontsource-variable/archivo', 'LICENSE', 'archivo-OFL.txt'],
];

mkdirSync(out, { recursive: true });

for (const [pkg, from, to] of FILES) {
  const root = path.dirname(
    fileURLToPath(import.meta.resolve(`${pkg}/package.json`, import.meta.url)),
  );
  copyFileSync(path.join(root, from), path.join(out, to));
  const version = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  console.log(`${to}  <-  ${pkg}@${version}/${from}`);
}
