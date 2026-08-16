'use client';

import { Icon } from '@landit/ui-web';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NAV, isNavActive } from './nav';

/**
 * The fixed bottom bar. Five items, no more: below 860px `.mobnav` is a
 * `repeat(5, 1fr)` grid and the design specifies five (handoff, Responsive).
 *
 * It is always in the DOM; the stylesheet is what shows it below 860px and
 * hides `.nav` in the top bar. Keeping the decision in CSS means no layout
 * shift on load and no matchMedia in the shell.
 */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="mobnav" aria-label="Main, compact">
      {NAV.map((item) => {
        const active = isNavActive(item, pathname);
        const inner = (
          <>
            <Icon name={item.icon} size={21} strokeWidth={2.2} />
            {item.label}
          </>
        );

        if (!item.href) {
          // Not built yet (`lib/routes.ts`).
          return (
            <span key={item.id} aria-disabled="true">
              {inner}
            </span>
          );
        }
        return (
          <Link
            key={item.id}
            href={item.href}
            className={active ? 'on' : undefined}
            aria-current={active ? 'page' : undefined}
          >
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}
