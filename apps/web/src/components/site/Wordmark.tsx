import { Icon } from '@landit/ui-web';
import Link from 'next/link';

/**
 * The Land It mark: a tilted yellow glyph and the wordmark, `LAND` in paper
 * with `IT` in yellow.
 *
 * Every use in this task sits on an ink surface, so the `.logo` class's own
 * colours are correct as they stand — the auth card's ink-on-paper variant
 * arrives with T6 and can add a prop then.
 */
export function Wordmark({ href }: { href?: '/' }) {
  const mark = (
    <>
      <span className="glyph">
        <Icon name="scoot" size={19} strokeWidth={2.4} style={{ color: 'var(--ink)' }} />
      </span>
      <span className="wm">
        Land<em>It</em>
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
