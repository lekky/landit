'use client';

import { Icon } from '@landit/ui-web';
import Link from 'next/link';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

import type { SectionTab } from './nav';
import styles from './sectionDrawer.module.css';

/**
 * The two screens a folded bottom-bar cell holds, named, above the bar.
 *
 * `MOBILE_NAV` folds nine destinations into five cells, and two of those cells
 * are sections rather than screens: What's on is Spots *and* Events, Progress
 * is progress *and* the sticker wall. Highlighting a cell is not navigation, so
 * for a rider who did not already know, the second screen in each pair did not
 * exist — which is what this drawer is for.
 *
 * It replaced `SectionTabs`, a row at the top of each of the four screens. That
 * row worked and was still the wrong answer: it wore `.sporttab`, the same box,
 * size and shadow as the sport switch rendered directly beneath it on
 * `/progress`, so a rider met the same control twice and read the first one as
 * a filter (issue #379, item 5). It also sat at the top of a scrolling page,
 * where the thumb is not.
 *
 * Purely presentational — `MobileNav` owns when this is on screen, because that
 * is a fact about the bar and not about a list of two links.
 */
export function SectionDrawer({
  tabs,
  label,
  pathname,
  id,
  onNavigate,
}: {
  tabs: readonly SectionTab[];
  /** The section's own name, e.g. "What's on". */
  label: string;
  /** The screen being looked at, so the drawer can say which of the two it is. */
  pathname: string;
  /** Ties the drawer to the cell that opens it, for `aria-controls`. */
  id: string;
  /**
   * Close the drawer, because the rider has chosen.
   *
   * Needed because both tabs are inside one section: picking Events from Spots
   * does not change which section the bar is in, so nothing else would take the
   * drawer down and it would sit there over the screen it just opened.
   */
  onNavigate: () => void;
}) {
  return (
    /*
     * `role="group"`, because `aria-label` on a bare div is not exposed to a
     * screen reader at all — it would have named nothing. Not a second `nav`:
     * this is inside the compact nav's landmark already, and nesting a
     * landmark inside itself makes both harder to skip past.
     */
    <div className={styles.drawer} id={id} role="group" aria-label={label}>
      <p className={styles.label}>{label}</p>
      {tabs.map((tab) => {
        // The same prefix rule the bar uses, so `/events/brighton-jam` is still
        // Events. `isNavActive` is not reused: it answers for a whole section,
        // and every tab in a section would come back true.
        const on = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`${styles.tab} ${on ? styles.on : ''}`}
            aria-current={on ? 'page' : undefined}
            onClick={() => {
              capture(ANALYTICS_EVENTS.navClicked, { to: tab.id, where: 'section-drawer' });
              onNavigate();
            }}
          >
            <Icon name={tab.icon} size={19} strokeWidth={2.2} />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
