import Link from 'next/link';

import { ROUTES } from '@/lib/routes';
import { sessionsHref } from '@/lib/sessionRoutes';

import styles from './progressTabs.module.css';

/**
 * The Progress page's two tabs: "Sessions" and "Where you're at" (T37, design
 * 1a/2a). Links rather than client state, so each tab has an address a rider
 * can come back to and Back moves between them.
 *
 * **Sessions leads** (Rachid, 2026-09-13, in chat), and the bottom bar's
 * Progress cell now lands there too. On a phone the section drawer says the
 * same thing; this row is the only way to the sibling screen above 860px,
 * where there is no drawer, so it stays rather than being replaced by one.
 */
export function ProgressTabs({ current }: { current: 'tricks' | 'sessions' }) {
  return (
    <nav className={styles.tabs} aria-label="Progress">
      <Link
        href={sessionsHref()}
        className={`${styles.tab} ${current === 'sessions' ? styles.on : ''}`}
        aria-current={current === 'sessions' ? 'page' : undefined}
      >
        Sessions
      </Link>
      <Link
        href={ROUTES.progress}
        className={`${styles.tab} ${current === 'tricks' ? styles.on : ''}`}
        aria-current={current === 'tricks' ? 'page' : undefined}
      >
        Where you&rsquo;re at
      </Link>
    </nav>
  );
}
