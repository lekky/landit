import { Icon } from '@landit/ui-web';
import Link from 'next/link';

/**
 * The Land It mark: a tilted yellow glyph and the wordmark, `LAND` in paper
 * with `IT` in yellow.
 *
 * `onPaper` is the variant the auth card uses (screenshot 04), where the mark
 * sits on paper instead of ink: the glyph's ring turns ink, `LAND` turns ink and
 * `IT` turns orange. T5 left the prop for T6, which is the first screen to need
 * it; the colours are inline because the design system styles `.logo` for the
 * ink bar it was drawn on, and widening that selector would restyle the top bar.
 */
export function Wordmark({ href, onPaper = false }: { href?: '/'; onPaper?: boolean }) {
  const mark = (
    <>
      <span className="glyph" style={onPaper ? { borderColor: 'var(--ink)' } : undefined}>
        <Icon name="scoot" size={19} strokeWidth={2.4} style={{ color: 'var(--ink)' }} />
      </span>
      <span className="wm" style={onPaper ? { color: 'var(--ink)' } : undefined}>
        Land<em style={onPaper ? { color: 'var(--orange)' } : undefined}>It</em>
      </span>
    </>
  );

  if (!href) return <span className="logo">{mark}</span>;
  return (
    <Link className="logo" href={href} aria-label="Land It, home">
      {mark}
    </Link>
  );
}
