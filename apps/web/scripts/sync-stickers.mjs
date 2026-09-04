/**
 * Copy the award badge PNGs from `@landit/ui-web` into `public/stickers/`, and
 * write the resized copies the sticker wall actually draws.
 *
 * Same shape as `sync-avatars.mjs`, for the same reason: the badges are
 * package assets — they live once, in the design system — and Next can only
 * serve static files out of `public/`, so they are copied there at dev and
 * build time rather than committed twice. `public/stickers/` is git-ignored.
 *
 * **The resizing, and why it is here.** The masters are 512×512 and weigh ~83 KB
 * each, and nothing draws a badge larger than 160 CSS px — 118px in the wall's
 * grid, 150px in the detail modal, 130px on the share card. A wall of ~65
 * badges was therefore fetching about 5 MB of PNG to paint 65 thumbnails, and
 * took visibly long to do it on a phone (owner, 2026-09-01, in chat). Each
 * master now also gets a WebP at each width in `STICKER_WIDTHS`, written to
 * `public/stickers/w<width>/`, and `StickerBadge` offers them through `srcset`.
 * A 160px WebP is about 9 KB against the master's 83 KB.
 *
 * Build time rather than `next/image`: `@landit/ui-web` may not depend on Next
 * (see `Avatar.tsx`), and on-demand optimisation would put 65 resizes of 65
 * distinct images on the box's CPU at first paint, thrown away on every
 * redeploy. This runs once per build and costs the browser nothing.
 *
 * **A missing resize is a broken image, not a slow one** — a `srcset` candidate
 * that 404s does not fall back. So a failed resize fails the build here rather
 * than shipping a wall of broken badges.
 *
 * This runs from the `dev` and `build` scripts. If badges are missing from
 * the sticker wall, this is the first thing to check.
 */
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * The widths written, and the widths `stickerArtSrcSet` in `@landit/ui-web`
 * promises. The two are checked against each other in
 * `apps/web/src/lib/award-art.test.ts`; changing one without the other is how
 * the wall ends up asking for a file nothing wrote.
 */
export const STICKER_WIDTHS = [160, 320];

/**
 * WebP quality, checked by eye rather than by number (2026-09-01).
 *
 * Worth knowing before anyone "fixes" this: the badges score ~31 dB PSNR
 * against the master downscaled to the same size, which reads as poor. It is
 * not. The art carries a deliberate scratch-and-grain texture across its flat
 * colour fields, and that texture is the first thing a lossy encoder smooths —
 * so the metric is measuring loss of noise. Raising quality barely moves it
 * (q96 buys 1 dB for 50% more bytes) because the loss is not in the detail
 * that matters, and `smartSubsample` moves it not at all.
 *
 * What was actually checked: every badge rendered against its master at the
 * wall's true 118px column and at 2× that, over `--ink`. The lettering, the
 * stars, the ink outlines and the colours are indistinguishable. 80 it is.
 */
const QUALITY = 80;

const here = path.dirname(fileURLToPath(import.meta.url));
const from = path.join(here, '..', '..', '..', 'packages', 'ui-web', 'assets', 'stickers');
const to = path.join(here, '..', 'public', 'stickers');

async function sync() {
  // Imported here rather than at the top so that a test can read
  // `STICKER_WIDTHS` off this module without needing sharp's native binary.
  const { default: sharp } = await import('sharp');

  rmSync(to, { recursive: true, force: true });
  mkdirSync(to, { recursive: true });
  for (const width of STICKER_WIDTHS) mkdirSync(path.join(to, `w${width}`), { recursive: true });

  const files = readdirSync(from).filter((f) => f.endsWith('.png'));
  let resized = 0;

  await Promise.all(
    files.map(async (file) => {
      const source = path.join(from, file);
      copyFileSync(source, path.join(to, file));

      const stem = file.slice(0, -'.png'.length);
      for (const width of STICKER_WIDTHS) {
        await sharp(source)
          .resize(width, width, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: QUALITY })
          .toFile(path.join(to, `w${width}`, `${stem}.webp`));
        resized += 1;
      }
    }),
  );

  console.log(
    `stickers: copied ${files.length} files to public/stickers/, ` +
      `plus ${resized} resized copies at ${STICKER_WIDTHS.join('px, ')}px`,
  );
}

// Only when run as a script. Importing this module must not wipe `public/`.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await sync();
}
