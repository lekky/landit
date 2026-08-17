'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ADMIN_TABS, isAdminTabActive } from './nav';

import styles from './admin.module.css';

/**
 * The tab row.
 *
 * A client component only because the highlight follows the URL, and the
 * unbuilt tabs are `<span>`s rather than disabled buttons: there is no
 * interaction to disable, they are labels for screens T17 will land. Marked
 * `aria-disabled` so a screen reader is told the same thing sighted staff are
 * told by the fade, and left out of the tab order so keyboard focus does not
 * stop on seven dead stops before reaching Riders.
 *
 * `.pill` styles a `button` in the design pack, so putting it on an `<a>` needs
 * the class to carry its own look — LESSONS §3a, the trap that rendered the
 * whole rider nav unstyled. `admin.module.css` composes it rather than assuming.
 */
export function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav className={styles.tabs} aria-label="Staff portal sections">
      {ADMIN_TABS.map((tab) => {
        if (!tab.href) {
          return (
            <span key={tab.id} className={`pill ${styles.tabSoon}`} aria-disabled="true">
              {tab.label}
            </span>
          );
        }

        const on = isAdminTabActive(tab, pathname);
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`pill ${styles.tab} ${on ? 'on' : ''}`}
            aria-current={on ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
