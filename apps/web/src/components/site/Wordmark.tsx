import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';

/**
 * The Land The Trick mark: the one-line wordmark from the 2026-08-30 header
 * pack — "LAND THE TRICK" in the brush lettering, crown over "THE", the splash
 * accents behind.
 *
 * This is artwork now, front to back. Until 2026-08-30 the mark was a badge
 * image beside "Land The Trick" set in the display font, and before that a
 * code-drawn glyph — both stand-ins from before there was a logo. The one-line
 * cut is the logo itself, and the sticker outline means the same file works on
 * the ink top bar and the paper auth card, so `onPaper` no longer changes
 * anything: the prop is still accepted so callers did not have to move, and
 * ignored.
 *
 * Sizing lives in `packages/ui-web/src/styles/additions.css` (`.logo img`):
 * 34px tall by default, and 27px in the 861–1100px band where the top bar
 * fights for width — the same band that used to shrink the wordmark text
 * (#157). At 3.4:1 the art is ~115px wide at full height, a little narrower
 * than the badge-plus-text lockup it replaced.
 *
 * `href` is a `Route` because where "home" is depends on who is looking: the
 * top bar sends a signed-in rider to their dashboard and everybody else to the
 * landing page (`TopBar`).
 */
export function Wordmark({ href }: { href?: Route; onPaper?: boolean }) {
  const mark = (
    <Image src="/brand/wordmark-line-720.png" alt="Land The Trick" width={720} height={214} />
  );

  if (!href) return <span className="logo">{mark}</span>;
  return (
    <Link className="logo" href={href} aria-label="Land The Trick, home">
      {mark}
    </Link>
  );
}
