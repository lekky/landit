import type { CSSProperties } from 'react';

/**
 * Painted sticker art for the five feels and the five weather options, replacing
 * the stroked glyphs `FEEL_FACES` and `WEATHER_ICONS` drew (owner, 2026-09-14,
 * in chat).
 *
 * This is the second deliberate divergence of its kind, and it follows the
 * first exactly: the three equipment glyphs became die-cut sticker art on
 * 2026-08-31 for the same reason, and `sport-art.tsx` is the shape this file
 * copies. The case is the same one. "How it felt" is the only question the log
 * form asks that is about the rider rather than about their data, and a hand-
 * drawn face is worth pressing where a 2.2px stroked circle is a form control.
 * The weather row comes with it because the two sit on one card and a half-
 * painted card reads as a bug.
 *
 * **Scope was the owner's call, 2026-09-14, in chat: everywhere a feel or a
 * weather is drawn** — not only the log form. The trade that came with it is
 * recorded under `SESSION_ART_WIDTHS` below and in the plan's sixth divergence,
 * and a later session should not "fix" it back to a screenshot.
 *
 * The stroked paths stay exported from `components/sessions.tsx`, untouched, on
 * the same terms as the three sport glyphs: for anywhere the art cannot go — a
 * one-colour print, an email, a canvas that cannot fetch.
 *
 * The PNGs are package assets under `assets/session-icons/`, on the same terms
 * as the avatars, the sport art and the award badges: they live once, in the
 * design system, and `apps/web` copies them into `public/` at dev and build
 * time (see `apps/web/scripts/sync-session-icons.mjs`). That is why the base
 * path is a URL.
 */

/** Where `apps/web` serves the copies from. */
export const SESSION_ART_BASE_PATH = '/session-icons';

/**
 * The widths the sync script writes, smallest first.
 *
 * Nothing draws this art above 32px — 30–32 in the two feel pickers, 26 on the
 * session detail, 21 in the weather row, and 13–15 in the feed cards, the
 * sessions table and the spot block. 64 therefore covers every size on a plain
 * screen and 128 covers the same at 2×.
 *
 * **The small end is a known cost, and the colour pass softened it.** A die-cut
 * sticker at 13px is a mark, not a drawing: the rain's three drops are gone and
 * so is the grin's tongue. The owner accepted that trade for the feels and the
 * weather alike (2026-09-14, in chat) — but the faces that arrived later that
 * day are **colour-coded down the feel scale** (teal, green, yellow, orange,
 * red), so at 13px a feel is still a distinct hue even once the expression has
 * closed up. The five cream faces this replaced were five near-identical discs
 * at that size. The weather row got no such rescue and is the one still
 * trading on detail alone.
 *
 * Nothing is readable *only* as a picture in any case: every place that draws
 * this small names the feel in text beside it. Shrink the art, or commission
 * simplified small variants, before reaching for a second size step here.
 */
export const SESSION_ART_WIDTHS = [64, 128] as const;

/**
 * What `sizes` an image declares when the caller does not say. The largest the
 * art is ever drawn; over-declaring costs the next size up, under-declaring
 * costs a blurry sticker, so this errs upwards.
 */
export const SESSION_ART_SIZES = '32px';

/**
 * Keyed by core's `SessionFeelId` and `SessionWeatherId`, exactly as
 * `FEEL_FACES` and `WEATHER_ICONS` are, so a caller swapping one for the other
 * changes nothing but the import. As everywhere in this package, nothing here
 * imports `@landit/core`: the ids are spelled out, and
 * `packages/ui-web/src/session-art.test.ts` is what holds the two in step.
 */
export const FEEL_ART = {
  sent: 'feel-sent.png',
  good: 'feel-good.png',
  fine: 'feel-fine.png',
  rough: 'feel-rough.png',
  hurt: 'feel-hurt.png',
} as const satisfies Record<string, string>;

export const WEATHER_ART = {
  sun: 'weather-sun.png',
  cloud: 'weather-cloud.png',
  rain: 'weather-rain.png',
  wind: 'weather-wind.png',
  cold: 'weather-cold.png',
} as const satisfies Record<string, string>;

/** Every file the two maps name, for the script and the tests that check them. */
export const SESSION_ART_FILES = [
  ...Object.values(FEEL_ART),
  ...Object.values(WEATHER_ART),
] as readonly string[];

/** `/session-icons/feel-sent.png` — the master, and the `src` every image falls back to. */
export function sessionArtSrc(file: string, base: string = SESSION_ART_BASE_PATH): string {
  return `${base}/${file}`;
}

/**
 * The `srcset` of resized WebP for one sticker, or `undefined` when there is
 * none to offer.
 *
 * Empty for anything that is not a `.png`, because that is the only thing the
 * sync script resizes — a file whose variants do not exist must render the
 * plain `src`, not a broken image.
 */
export function sessionArtSrcSet(
  file: string,
  base: string = SESSION_ART_BASE_PATH,
): string | undefined {
  if (!file.toLowerCase().endsWith('.png')) return undefined;
  const stem = file.slice(0, -'.png'.length);
  if (!stem) return undefined;
  return SESSION_ART_WIDTHS.map((w) => `${base}/w${w}/${stem}.webp ${w}w`).join(', ');
}

export type SessionArtProps = {
  /** The file from `FEEL_ART` or `WEATHER_ART`. */
  file: string;
  /** The box the art is fitted inside, in px. It keeps its own aspect ratio. */
  size: number;
  /**
   * Describe it to a screen reader. Leave it off wherever the feel or the
   * weather is already named in text beside it, which is most callers.
   */
  title?: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * One painted sticker, fitted in a square box.
 *
 * Width and height are the *box*; `object-fit: contain` is what stops a
 * sticker being stretched square inside it. `flex: none` because every caller
 * puts this in a flex row or a picker cell next to a label.
 */
export function SessionArt({ file, size, title, className, style }: SessionArtProps) {
  return (
    <img
      src={sessionArtSrc(file)}
      srcSet={sessionArtSrcSet(file)}
      sizes={`${size}px`}
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      width={size}
      height={size}
      draggable={false}
      className={className}
      style={{ objectFit: 'contain', flex: 'none', ...style }}
    />
  );
}
