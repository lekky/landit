/**
 * Copy the session sticker art from `@landit/ui-web` into `public/session-icons/`,
 * and write the resized copies the screens actually draw.
 *
 * Same shape as `sync-stickers.mjs` and `sync-sports.mjs`, for the same reason:
 * the ten stickers are package assets — they live once, in the design system —
 * and Next can only serve static files out of `public/`, so they are copied
 * there at dev and build time rather than committed twice.
 * `public/session-icons/` is git-ignored.
 *
 * **The resizing, and why it is worth it here.** The masters are 512×512 and
 * ~65 KB each, and nothing draws this art above 32 CSS px. The log form paints
 * all ten at once — five feels and five weather — so a rider opening it would
 * otherwise fetch ~650 KB of PNG to draw ten thumbnails the size of a
 * fingernail. A 64px WebP is a couple of KB.
 *
 * **A missing resize is a broken image, not a slow one** — a `srcset` candidate
 * that 404s does not fall back to the `src`. So a failed resize fails the build
 * here rather than shipping a log form full of broken stickers.
 *
 * This runs from the `dev` and `build` scripts. If the feel faces or the
 * weather row show broken pictures, this is the first thing to check.
 */
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * The widths written, and the widths `sessionArtSrcSet` in `@landit/ui-web`
 * promises. The two are checked against each other in
 * `apps/web/src/lib/session-art.test.ts`; changing one without the other is how
 * a screen ends up asking for a file nothing wrote.
 */
export const SESSION_ICON_WIDTHS = [64, 128];

/** WebP quality, on the same terms as the award badges (see `sync-stickers.mjs`). */
const QUALITY = 80;

const here = path.dirname(fileURLToPath(import.meta.url));
const from = path.join(here, '..', '..', '..', 'packages', 'ui-web', 'assets', 'session-icons');
const to = path.join(here, '..', 'public', 'session-icons');

async function sync() {
  // Imported here rather than at the top so that a test can read
  // `SESSION_ICON_WIDTHS` off this module without needing sharp's native binary.
  const { default: sharp } = await import('sharp');

  rmSync(to, { recursive: true, force: true });
  mkdirSync(to, { recursive: true });
  for (const width of SESSION_ICON_WIDTHS) {
    mkdirSync(path.join(to, `w${width}`), { recursive: true });
  }

  const files = readdirSync(from).filter((f) => f.endsWith('.png'));
  let resized = 0;

  await Promise.all(
    files.map(async (file) => {
      const source = path.join(from, file);
      copyFileSync(source, path.join(to, file));

      const stem = file.slice(0, -'.png'.length);
      for (const width of SESSION_ICON_WIDTHS) {
        await sharp(source)
          .resize(width, width, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: QUALITY })
          .toFile(path.join(to, `w${width}`, `${stem}.webp`));
        resized += 1;
      }
    }),
  );

  console.log(
    `session icons: copied ${files.length} files to public/session-icons/, ` +
      `plus ${resized} resized copies at ${SESSION_ICON_WIDTHS.join('px, ')}px`,
  );
}

// Only when run as a script. Importing this module must not wipe `public/`.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await sync();
}
