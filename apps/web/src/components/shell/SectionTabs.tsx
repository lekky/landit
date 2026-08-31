'use client';

import { Icon } from '@landit/ui-web';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

import type { SectionTab } from './nav';

/**
 * The row that switches between the two screens inside one bottom-bar section.
 *
 * `MOBILE_NAV` folds nine destinations into five sections, which only works if
 * the second screen in a section is reachable once you are on the first —
 * highlighting the bar is not navigation. So Spots and Events each carry
 * `Spots | Events`, and Progress and the sticker wall each carry
 * `Progress | Stickers`.
 *
 * Shown at every width, not only below the bottom-bar breakpoint. On desktop it
 * duplicates two entries of the top bar, which is a small cost against a row
 * that appears and disappears as the window is dragged — and it is the only
 * thing on either screen that says the two belong together.
 *
 * `.sporttab` styles a `button` in the design pack, so an `<a>` wearing it needs
 * the class to carry its own look — `additions.css` does that for `.nav` and
 * `.mobnav` already, and `.sectiontabs a` is the third instance of the same
 * trap (LESSONS §3a).
 */

export function SectionTabs({
  tabs,
  label,
}: {
  tabs: readonly SectionTab[];
  /** Accessible name for the row, e.g. "What's on". */
  label: string;
}) {
  const pathname = usePathname();

  return (
    <nav className="sporttabs sectiontabs" aria-label={label}>
      {tabs.map((tab) => {
        const on = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`sporttab ${on ? 'on' : ''}`}
            aria-current={on ? 'page' : undefined}
            onClick={() =>
              capture(ANALYTICS_EVENTS.navClicked, { to: tab.id, where: 'section-tabs' })
            }
          >
            <Icon name={tab.icon} size={17} strokeWidth={2.3} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
