import { Icon } from '@landit/ui-web';
import Link from 'next/link';
import type { Route } from 'next';

import styles from './shell.module.css';

/**
 * "← Home" at the top of a screen that belongs to a group (rethink §2.3).
 *
 * Folding nine destinations into four groups moves five screens off the bar —
 * Progress, Sessions, Stickers, Challenge and the glossary are reached from
 * Home's cards and from the library rather than from a cell of their own. That
 * is only fair if each of them says what it is under, which is what this is.
 *
 * **An ordinary link to the parent route, never `history.back()`.** A rider who
 * arrived from a shared link, a search result or an email has no history to go
 * back through, and a control that does nothing on a deep link is worse than no
 * control. It also means the destination is visible in the status bar and the
 * link can be opened in a new tab, both of which `history.back()` gives up.
 *
 * T45 ships the component; T46 and T49 onward are what put it on the screens.
 */
export function BackLink({
  href,
  label,
  scroll,
}: {
  href: Route;
  label: string;
  /**
   * `false` where the destination restores a scroll offset of its own — the
   * library's place memory does, and Next's own jump to the top would fight it
   * for the same frame. Left undefined everywhere else, which is Next's
   * default: a fresh arrival belongs at the top of the page.
   */
  scroll?: boolean;
}) {
  return (
    <Link href={href} className={styles.backLink} scroll={scroll}>
      <Icon name="arrow-left" size={16} strokeWidth={2.6} aria-hidden />
      {label}
    </Link>
  );
}
