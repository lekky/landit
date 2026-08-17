import { Icon } from '@landit/ui-web';
import Link from 'next/link';

/**
 * The Land The Trick mark: a tilted yellow glyph and the wordmark, `LAND THE` in
 * paper with `TRICK` in yellow.
 *
 * The prototype drew this as `LAND` + `IT`, and the 2026-08-17 rename kept the
 * shape rather than the words: the accent still falls on the back half of the
 * name, which is the part that carries it.
 *
 * **It is 14 glyphs where it was 6, and that has a cost the top bar pays.** The
 * mark, nine nav items, the streak chip and the avatar stopped fitting between
 * 861px and roughly 1065px, which `e2e/shell.spec.ts` caught. The band in
 * `packages/ui-web/src/styles/additions.css` absorbs it by dropping this to
 * 15px there. Anything that makes the name longer again lands in the same
 * place — that band, not this file.
 *
 * `onPaper` is the variant the auth card uses (screenshot 04), where the mark
 * sits on paper instead of ink: the glyph's ring turns ink, `LAND THE` turns ink
 * and `TRICK` turns orange. T5 left the prop for T6, which is the first screen to
 * need it; the colours are inline because the design system styles `.logo` for
 * the ink bar it was drawn on, and widening that selector would restyle the top
 * bar.
 */
export function Wordmark({ href, onPaper = false }: { href?: '/'; onPaper?: boolean }) {
  const mark = (
    <>
      <span className="glyph" style={onPaper ? { borderColor: 'var(--ink)' } : undefined}>
        <Icon name="scoot" size={19} strokeWidth={2.4} style={{ color: 'var(--ink)' }} />
      </span>
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
