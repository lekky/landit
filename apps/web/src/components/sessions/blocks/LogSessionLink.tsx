'use client';

import { Icon } from '@landit/ui-web';
import type { Route } from 'next';
import Link from 'next/link';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

/**
 * "Log a session here", counted.
 *
 * Fires `session_log_opened` with `source` and nothing else — never which spot,
 * event or trick the page was about (`analytics.ts`: a page is a place, and
 * `source: 'spot'` already says all this needs). On the press, before the
 * navigation, because a client-side navigation is the success and there is no
 * later moment to fire from (the same shape as `TrickLink`).
 *
 * `'home'` joined the three block sources on 2026-09-14, when the streak card
 * gained the same link (T43). The component is shared rather than copied so
 * that there is one place a session link is counted from, and a new entry point
 * is a word in this union rather than a second `capture` somebody has to
 * remember to keep in step.
 */
export function LogSessionLink({
  href,
  source,
  className,
  children,
}: {
  readonly href: Route;
  readonly source: 'spot' | 'event' | 'trick' | 'home';
  readonly className?: string;
  readonly children: string;
}) {
  return (
    <Link
      href={href}
      className={className}
      prefetch={false}
      onClick={() => capture(ANALYTICS_EVENTS.sessionLogOpened, { source })}
    >
      <Icon name="plus" size={16} strokeWidth={2.2} />
      {children}
    </Link>
  );
}
