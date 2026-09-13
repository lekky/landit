import Link from 'next/link';

import { ROUTES } from '@/lib/routes';
import { sessionsHref } from '@/lib/sessionRoutes';

import styles from './progressTabs.module.css';

/**
 * The Progress page's two tabs: "Where you're at" and "Sessions" (T37, design
 * 1a/2a). Links rather than client state, so each tab has an address a rider
 * can come back to and Back moves between them.
 */
export function ProgressTabs({ current }: { current: 'tricks' | 'sessions' }) {
  return (
    <nav className={styles.tabs} aria-label="Progress">
      <Link
        href={ROUTES.progress}
        className={`${styles.tab} ${current === 'tricks' ? styles.on : ''}`}
        aria-current={current === 'tricks' ? 'page' : undefined}
      >
        Where you&rsquo;re at
      </Link>
      <Link
        href={sessionsHref()}
        className={`${styles.tab} ${current === 'sessions' ? styles.on : ''}`}
        aria-current={current === 'sessions' ? 'page' : undefined}
      >
        Sessions
      </Link>
    </nav>
  );
}
