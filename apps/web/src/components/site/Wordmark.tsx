import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';

/**
 * The Land The Trick mark: the LTT badge from the 2026-08-30 logo pack and the
 * wordmark, `LAND THE` in paper with `TRICK` in yellow.
 *
 * The badge is artwork now, not a drawing. Until 2026-08-30 the glyph was a
 * tilted yellow square with the scooter icon inside, built from tokens in
 * `packages/ui-web` — a placeholder from before there was a logo, and wrong
 * twice over once there was one: the product has three sports and the glyph
 * showed one of them. The badge (crown over "LTT" on an ink splash tile) is cut
 * from the same asset pack as the favicon and the install icons, so a rider
 * sees one mark on the home screen, the tab and the top bar.
 *
 * The -5deg tilt carries over from the old glyph: every sticker in this design
 * language sits slightly off-square, and the badge joining the bar dead level
 * would be the odd one out.
 *
 * **It is 14 glyphs where it was 6, and that has a cost the top bar pays.** The
 * mark, nine nav items, the streak chip and the avatar stopped fitting between
 * 861px and roughly 1065px, which `e2e/shell.spec.ts` caught. The band in
 * `packages/ui-web/src/styles/additions.css` absorbs it by dropping this to
 * 15px there. Anything that makes the name longer again lands in the same
 * place — that band, not this file.
 *
 * `href` is a `Route` because where "home" is depends on who is looking: the
 * top bar sends a signed-in rider to their dashboard and everybody else to the
 * landing page (`TopBar`).
 *
 * `onPaper` is the variant the auth card uses (screenshot 04), where the mark
 * sits on paper instead of ink: the badge is a sticker and needs no change, but
 * `LAND THE` turns ink and `TRICK` turns orange. The colours are inline because
 * the design system styles `.logo` for the ink bar it was drawn on, and
 * widening that selector would restyle the top bar.
 */
export function Wordmark({ href, onPaper = false }: { href?: Route; onPaper?: boolean }) {
  const mark = (
    <>
      <Image
        src="/brand/ltt-badge-64.png"
        alt=""
        width={30}
        height={30}
        style={{ transform: 'rotate(-5deg)', flex: 'none' }}
      />
      <span className="wm" style={onPaper ? { color: 'var(--ink)' } : undefined}>
        Land The <em style={onPaper ? { color: 'var(--orange)' } : undefined}>Trick</em>
      </span>
    </>
  );

  if (!href) return <span className="logo">{mark}</span>;
  return (
    <Link className="logo" href={href} aria-label="Land The Trick, home">
      {mark}
    </Link>
  );
}
