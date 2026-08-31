'use client';

import { Icon } from '@landit/ui-web';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

import { MOBILE_NAV, isNavActive } from './nav';

/**
 * The fixed bottom bar. Five items, no more: below 861px `.mobnav` is a
 * `repeat(5, 1fr)` grid and the design specifies five (handoff, Responsive).
 *
 * It reads `MOBILE_NAV` rather than the top bar's list, because the five are
 * sections rather than the first five pages — see `nav.ts` for why. Nothing
 * here knows that; a section is just a nav item with more `alsoActiveFor`.
 *
 * It is always in the DOM; the stylesheet is what shows it below 861px and
 * hides `.nav` in the top bar. Keeping the decision in CSS means no layout
 * shift on load and no matchMedia in the shell.
 */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="mobnav" aria-label="Main, compact">
      {MOBILE_NAV.map((item) => {
        const active = isNavActive(item, pathname);
        return (
          <Link
            key={item.id}
            href={item.href}
            className={active ? 'on' : undefined}
            aria-current={active ? 'page' : undefined}
            // The nav item's id, not its href: an id is a fixed name from
            // `nav.ts`, while an href could one day carry a parameter.
            onClick={() => capture(ANALYTICS_EVENTS.navClicked, { to: item.id, where: 'mobile' })}
          >
            <Icon name={item.icon} size={21} strokeWidth={2.2} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
