'use client';

import { useId } from 'react';

import { cx } from '../cx';
import { ICONS, type IconName } from '../icons';
import { STICKER_ART_SIZES, stickerArtSrc, stickerArtSrcSet } from '../sticker-art';

/**
 * The die-cut sticker. A record with printed art (T24) renders that art; a
 * record without one is drawn in SVG at render time, transcribed from
 * `StickerBadge` in
 * `design-handoff/design/landit-ui.jsx` — white die-cut edge, ink ring, a 42%
 * tint of the sticker's hue, a dashed inner ring, the name curved over the top,
 * the icon in the middle, and EARNED / LOCKED curved along the bottom.
 *
 * Two differences from the prototype, neither visual:
 * - the curved text takes its font from `style`, not a `font-family` attribute,
 *   because `var()` is only reliable in a real CSS declaration;
 * - it renders as a `<button>` only when it can be clicked.
 */

export type StickerLook = {
  /** e.g. "Five Deep". Rendered uppercase around the top arc. */
  name: string;
  /** The sticker's colour. Tinted to 42% for the disc. */
  hue: string;
  /** Icon in the middle. Falls back to the star. */
  icon?: IconName;
  /**
   * Printed award art (T24): a file name under `/stickers/`. When set, the
   * badge renders the image — name, shape, stars and colour are baked into
   * the art — and the drawn SVG below is the fallback for records without it.
   */
  img?: string;
};

export type StickerBadgeProps = {
  sticker: StickerLook;
  earned?: boolean;
  /** Plays the `pop` keyframe — scale .3, rotate −25°, 1.12 overshoot. */
  just?: boolean;
  /**
   * The `sizes` the printed art declares, when a caller draws it at some width
   * other than the 160px every current one draws it at or under. Ignored by the
   * SVG fallback, which has no fixed size to declare.
   */
  sizes?: string;
  onClick?: () => void;
};

const INK = '#16140F';

export function StickerBadge({
  sticker,
  earned = false,
  just = false,
  sizes = STICKER_ART_SIZES,
  onClick,
}: StickerBadgeProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const fill = `color-mix(in oklab, ${sticker.hue} 42%, #fff)`;
  const glyph = (sticker.icon && ICONS[sticker.icon]) || ICONS.star;
  const label = `${sticker.name} sticker, ${earned ? 'earned' : 'locked'}`;

  const art = sticker.img ? (
    // The printed award badge (T24). The art carries the name, shape and
    // stars; the locked state is the CSS treatment (`.sticker.locked img`),
    // and the label carries it for a screen reader either way.
    //
    // The master PNG is the `src` and the resized WebP are only offered
    // through `srcset`, so a browser without WebP and a record the sync step
    // has not resized both still get a badge rather than a broken image
    // (`sticker-art.ts`). The intrinsic `width`/`height` are the master's and
    // are belt-and-braces: `.sticker` already carries `aspect-ratio: 1`, so the
    // box is reserved either way, but a badge rendered outside that class
    // should still not reflow when its art lands.
    <img
      src={stickerArtSrc(sticker.img)}
      srcSet={stickerArtSrcSet(sticker.img)}
      sizes={sizes}
      alt={label}
      width={512}
      height={512}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  ) : (
    <svg viewBox="0 0 120 120" role="img" aria-label={label}>
      <defs>
        <path id={`${uid}t`} d="M29.5 60 a30.5 30.5 0 0 1 61 0" fill="none" />
        <path id={`${uid}b`} d="M24 60 a36 36 0 0 0 72 0" fill="none" />
      </defs>
      <circle cx="60" cy="60" r="58.5" fill="#fff" />
      <circle cx="60" cy="60" r="54.5" fill={INK} />
      <circle cx="60" cy="60" r="48" fill={fill} />
      <circle
        cx="60"
        cy="60"
        r="44.5"
        fill="none"
        stroke={INK}
        strokeWidth="1.5"
        strokeDasharray="5 3.6"
      />
      <text
        style={{ fontFamily: 'var(--fd)' }}
        fontSize={sticker.name.length > 11 ? 10.5 : 12.5}
        letterSpacing="1"
        fill={INK}
      >
        <textPath href={`#${uid}t`} startOffset="50%" textAnchor="middle">
          {sticker.name.toUpperCase()}
        </textPath>
      </text>
      <g
        transform={earned ? 'translate(40.8,42) scale(1.6)' : 'translate(43,36.5) scale(1.42)'}
        stroke={INK}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {glyph}
      </g>
      {!earned && (
        <g
          transform="translate(54.5,71.5) scale(0.46)"
          stroke={INK}
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {ICONS.lock}
        </g>
      )}
      <text
        style={{ fontFamily: 'var(--fc)' }}
        fontWeight="700"
        fontSize="8.5"
        letterSpacing="1.8"
        fill={INK}
      >
        <textPath href={`#${uid}b`} startOffset="50%" textAnchor="middle">
          {earned ? 'EARNED' : 'LOCKED'}
        </textPath>
      </text>
    </svg>
  );

  const className = cx('sticker', !earned && 'locked', just && 'just');

  /*
   * The printed art carries no LOCKED lettering of its own (the drawn SVG
   * does), and the fade that used to say it is gone — the badge keeps its
   * colour everywhere now (#266). So the state is a mark over the art, the
   * trick page's NOT YET at wall scale. `aria-hidden`: the `alt` already says
   * "locked", and a screen reader hearing it twice is once too often.
   */
  const mark =
    !earned && sticker.img ? (
      <span className="sticker-mark" aria-hidden="true">
        Not yet
      </span>
    ) : null;

  return onClick ? (
    <button type="button" className={className} onClick={onClick}>
      {art}
      {mark}
    </button>
  ) : (
    <span className={className} style={{ display: 'block' }}>
      {art}
      {mark}
    </span>
  );
}
