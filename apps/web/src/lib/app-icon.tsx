import type { ReactElement } from 'react';

/**
 * The Land The Trick app icon, drawn once for every size that needs one.
 *
 * **Where it comes from.** The repo has no icon artwork — 36 avatars and
 * nothing else — so the icon is the mark that is already in the top bar
 * (`components/site/Wordmark.tsx`): the tilted yellow glyph with the scooter
 * inside it, on ink. Drawn here from the same tokens and the same path rather
 * than exported as a PNG somebody would have to re-cut whenever a colour moves.
 * A purpose-drawn launch icon is worth having and is an open issue; this is what
 * a rider gets on their home screen until there is one.
 *
 * **No wordmark.** At 48px on a home screen "LAND THE TRICK" in Anton is a
 * smear, and rendering text here would mean shipping the font file to the image
 * renderer for a result nobody can read. The glyph alone is the part of the mark
 * that survives being small — more so since the 2026-08-17 rename made the
 * wordmark three words long.
 *
 * The values are the design system's, copied rather than imported: this renders
 * through Satori, which resolves no CSS custom properties and knows nothing of a
 * stylesheet (`packages/ui-web/src/styles/tokens.css`).
 */

const INK = '#12100b';
const PAPER = '#fffdf5';
const YELLOW = '#ffc23f';

/**
 * How much of the square the mark takes up.
 *
 * A maskable icon may be cropped to a circle by the launcher, and the guarantee
 * is only the middle 80% — so the mark shrinks into that safe zone and the ink
 * field grows to fill what gets cut. Any icon declared `purpose: "maskable"`
 * that ignores this is an icon with its corners shaved off.
 */
const PLAIN_SCALE = 0.62;
const MASKABLE_SCALE = 0.44;

export function appIcon({
  size,
  maskable = false,
}: {
  size: number;
  maskable?: boolean;
}): ReactElement {
  const mark = Math.round(size * (maskable ? MASKABLE_SCALE : PLAIN_SCALE));
  const glyph = Math.round(mark * 0.63);

  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: INK,
      }}
    >
      <div
        style={{
          width: mark,
          height: mark,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: YELLOW,
          // The paper keyline and the -5deg tilt are the mark, not decoration:
          // straighten it and it stops being this product's logo.
          border: `${Math.max(2, Math.round(mark * 0.083))}px solid ${PAPER}`,
          transform: 'rotate(-5deg)',
        }}
      >
        {/*
         * `scoot`, transcribed from `ui-web/src/icons.tsx` rather than imported.
         * That module is a React component tree for the DOM; this one is fed to
         * an image renderer, and the two do not accept the same props.
         */}
        <svg
          width={glyph}
          height={glyph}
          viewBox="0 0 24 24"
          fill="none"
          stroke={INK}
          /**
           * Thinner than the 2.4 the top bar uses, and the paths are untouched.
           *
           * `scoot` draws the deck as a line starting at the exact centre of the
           * back wheel, so a round cap of half the stroke width sits inside that
           * wheel. At 19px in the nav nobody can see it; at 512px it fills the
           * wheel solid while the front one stays a clean ring, and the mark
           * reads as a mistake. Dropping the weight opens the hole back up
           * without redrawing a single path (`ui-web/src/icons.tsx`).
           */
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="5.5" cy="18.5" r="2.6" />
          <circle cx="18.5" cy="18.5" r="2.6" />
          <path d="M5.5 18.5 L13 6 H18.5" />
          <path d="M9 6 H15" />
        </svg>
      </div>
    </div>
  );
}
