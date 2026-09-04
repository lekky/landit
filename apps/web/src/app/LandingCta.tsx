'use client';

import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

/**
 * A link on the landing page that counts itself.
 *
 * The page is server-rendered and wants to stay that way, so this is the one
 * thin client boundary on it: a `Link` that fires `landing_cta` on the way out.
 * Everything else — the hero, the rows, the grid, the FAQ — is static markup.
 *
 * `target` and `place` are the only things it sends, both from the union types
 * below, so a call site cannot put anything a visitor typed into an event even
 * by accident. A person on this page has no account, so there is no rider fact
 * available to leak; the types are belt and braces on top of that.
 */

/** Where a call to action goes. Fixed strings, not routes, so a path change here is not a funnel break. */
export type CtaTarget = 'signup' | 'signin' | 'spots' | 'events' | 'plans' | 'library';

/** Which of the page's three zones it was pressed in. */
export type CtaPlace = 'bar' | 'hero' | 'band';

export type LandingCtaProps = {
  href: Route;
  target: CtaTarget;
  place: CtaPlace;
  className?: string;
  children: ReactNode;
};

export function LandingCta({ href, target, place, className, children }: LandingCtaProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => capture(ANALYTICS_EVENTS.landingCta, { target, place })}
    >
      {children}
    </Link>
  );
}
