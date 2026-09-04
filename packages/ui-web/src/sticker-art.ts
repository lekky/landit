/**
 * How a printed award badge is served: which file, and at what size.
 *
 * The art is square PNGs under `assets/stickers/`, one per award, on the same terms
 * as the avatars and the sport art — they live once, in the design system, and
 * `apps/web` copies them into `public/` at dev and build time (see
 * `apps/web/scripts/sync-stickers.mjs`). That is why the base path is a URL.
 *
 * **Why this file exists at all.** The masters are 512×512 and weigh ~83 KB
 * each. Every place the badge is drawn draws it small — 118px in the wall's
 * grid, 150px in the detail modal, 130px on the share card — so a sticker wall
 * of ~65 badges was fetching about 5 MB of PNG to paint about 65 thumbnails,
 * and took visibly long to do it on a phone (owner, 2026-09-01, in chat). The
 * sync script now writes a 160px and a 320px WebP beside each master, and the
 * badge offers them through `srcset`; the browser takes the 160 on a plain
 * screen and the 320 at 2×, which is roughly a tenth of the bytes.
 *
 * The PNG stays the `src`. It is the fallback for a browser with no WebP, and
 * the fallback for a record whose art the sync step has not been run over —
 * neither of which should render a broken image just because this is faster.
 */

/** Where `apps/web` serves the copies from. */
export const STICKER_ART_BASE_PATH = '/stickers';

/**
 * The widths the sync script writes, smallest first.
 *
 * 160 covers every drawn size (118–160 CSS px) on a plain screen; 320 covers
 * the same at 2×. Nothing draws a badge larger than 160px, so there is no third
 * step — adding one means adding it here and in the sync script together, and
 * the script's own check is what stops the two drifting apart.
 */
export const STICKER_ART_WIDTHS = [160, 320] as const;

/**
 * What `sizes` a badge declares when the caller does not say.
 *
 * The largest a badge is ever drawn. Over-declaring costs a rider the next size
 * up; under-declaring costs them a blurry badge, so this errs upwards.
 */
export const STICKER_ART_SIZES = '160px';

/** `/stickers/180.png` — the master, and the `src` every badge falls back to. */
export function stickerArtSrc(img: string, base: string = STICKER_ART_BASE_PATH): string {
  return `${base}/${img}`;
}

/**
 * The `srcset` of resized WebP for one badge, or `undefined` when there is
 * none to offer.
 *
 * Empty for anything that is not a `.png`, because that is the only thing the
 * sync script resizes. A record carrying some other file gets the plain `src`
 * and renders exactly as it did before — the point being that a badge whose
 * variants do not exist must not become a broken image.
 */
export function stickerArtSrcSet(
  img: string,
  base: string = STICKER_ART_BASE_PATH,
): string | undefined {
  if (!img.toLowerCase().endsWith('.png')) return undefined;
  const stem = img.slice(0, -'.png'.length);
  if (!stem) return undefined;
  return STICKER_ART_WIDTHS.map((w) => `${base}/w${w}/${stem}.webp ${w}w`).join(', ');
}
