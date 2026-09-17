/**
 * Export the three sport equipment illustrations into `assets/sports/`.
 *
 * The masters the art arrives as are 1254×1254 RGBA PNGs weighing 1.5–2 MB
 * each. Nothing in the app draws equipment larger than about 64 CSS px, so the
 * masters never belong in the repo: 5 MB of PNG in a package that every app
 * installs, to paint a 19px chip, is 5 MB nobody asked for. They stay wherever
 * the owner keeps them, and this writes the two sizes that ship.
 *
 * Usage, from the repo root or anywhere:
 *
 *     node packages/ui-web/scripts/export-sport-art.mjs --from <dir>
 *
 * `<dir>` holds one file per sport, named `scoot`, `board` and `bmx` with an
 * optional `-source` suffix (`scoot-source.png` and `scoot.png` both work) and
 * any extension sharp reads. Each one is written twice:
 *
 * - `assets/sports/<name>.png` at 256px — the `src`, and what a plain screen
 *   takes;
 * - `assets/sports/<name>@2x.png` at 512px — the `srcset` candidate a
 *   high-density screen takes. `Equipment` offers both.
 *
 * Swapping the art is therefore this one command plus a commit. That matters:
 * the splash colours behind the equipment do not match the product's sport
 * colours, the owner knows, and recoloured masters may follow (owner,
 * 2026-09-16, in chat). Nothing about that swap should need a code change.
 *
 * **What the transform does, and why.** `.trim()` first, because the masters
 * are painted on a square canvas with uneven transparent margins — without it
 * the scooter and the skateboard sit at visibly different weights in the same
 * 19px chip. Then `fit: 'contain'` on a transparent background, so the art
 * keeps its own aspect ratio inside the square the component reserves.
 *
 * sharp is a dependency of `apps/web`, not of this package — `@landit/ui-web`
 * ships no build step and should not grow a native binary for a script that
 * runs about once a year. It is resolved from there.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const assets = path.join(here, '..', 'assets', 'sports');
const webPackage = path.join(here, '..', '..', '..', 'apps', 'web', 'package.json');

/** The three names the registry in `src/sport-art.tsx` knows. */
export const SPORT_ART_STEMS = ['scoot', 'board', 'bmx'];

/**
 * The exported widths, and what each is for. `256` is the `src`: every drawn
 * size today is 15–28px, and the design gallery's 64px is the largest, so 256
 * leaves room for a screen at 4× without a second thought. `512` is the `@2x`
 * candidate.
 */
export const SPORT_ART_WIDTHS = { '': 256, '@2x': 512 };

/**
 * PNG rather than WebP, palettised at quality 70.
 *
 * The art is flat colour over an ink outline with a hard-edged splash behind
 * it — the kind of image a palette costs little and a lossy codec would soften
 * at exactly the edges that carry it. PNG also keeps the sync script, the
 * registry and the fallback behaviour exactly as they were, which a second
 * format would not.
 *
 * 70 rather than sharp's 100 default, measured 2026-09-16: against the same
 * resize written losslessly, the six exports score 40.5–42.4 dB PSNR, which is
 * the range where a difference is not findable by eye — and they weigh a third
 * of the lossless file. 80 buys about 1.5 dB for 15% more bytes and pushes the
 * BMX's 512 over 120 KB; 60 starts to show in the splash's soft edge. Checked
 * by eye at 16, 19, 22, 28 and 64px, on paper and on each sport's fill.
 */
const PNG = { palette: true, quality: 70, effort: 10 };

function usage(message) {
  console.error(
    `${message}\n\nUsage: node ${path.relative(process.cwd(), fileURLToPath(import.meta.url))} --from <dir>`,
  );
  process.exit(1);
}

/** `--from <dir>`, or `--from=<dir>`. */
function readFromArg(argv) {
  const flag = argv.indexOf('--from');
  if (flag !== -1) return argv[flag + 1];
  const inline = argv.find((a) => a.startsWith('--from='));
  return inline ? inline.slice('--from='.length) : undefined;
}

/**
 * The master for one sport in `dir`: `<name>.<ext>` or `<name>-source.<ext>`,
 * whichever is there. Anything else in the directory is ignored, so the same
 * folder can hold notes, renders and older takes.
 */
function findSource(dir, stem) {
  const entries = readdirSync(dir).filter((f) => statSync(path.join(dir, f)).isFile());
  const match = entries.find((f) => {
    const base = f.slice(0, f.length - path.extname(f).length).toLowerCase();
    return base === stem || base === `${stem}-source`;
  });
  return match ? path.join(dir, match) : undefined;
}

export async function exportSportArt(from) {
  const require = createRequire(webPackage);
  const sharp = require('sharp');

  if (!existsSync(from)) usage(`No such directory: ${from}`);
  await mkdir(assets, { recursive: true });

  const written = [];
  for (const stem of SPORT_ART_STEMS) {
    const source = findSource(from, stem);
    if (!source)
      usage(`No master for "${stem}" in ${from} (expected ${stem}.png or ${stem}-source.png)`);

    for (const [suffix, width] of Object.entries(SPORT_ART_WIDTHS)) {
      const out = path.join(assets, `${stem}${suffix}.png`);
      const { size } = await sharp(source)
        .trim()
        .resize(width, width, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png(PNG)
        .toFile(out);
      written.push({ file: path.basename(out), width, size });
    }
  }

  for (const { file, width, size } of written) {
    console.log(
      `${file.padEnd(14)} ${String(width).padStart(4)}px  ${(size / 1024).toFixed(1)} KB`,
    );
  }
  return written;
}

// Only when run as a script, so a test can import the widths without sharp.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const from = readFromArg(process.argv.slice(2));
  if (!from) usage('Missing --from <dir>.');
  await exportSportArt(path.resolve(from));
}
