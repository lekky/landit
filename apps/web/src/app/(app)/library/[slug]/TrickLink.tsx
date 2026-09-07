'use client';

import type { Route } from 'next';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

/** Which of the trick page's four link groups a press came from (T31). */
export type TrickLinkKind = 'road' | 'unlocks' | 'similar' | 'practise';

/**
 * An onward link from a trick page, counted.
 *
 * The page grew four groups of links at once — the road, the unlocks, the
 * similar tricks and the practise line — and the question they were built to
 * answer is whether riders use them to move *through* the library rather than
 * bouncing back to the grid. One component so the four cannot drift apart in
 * what they send: `kind` says which group, `from` and `to` are catalogue slugs
 * (or, for practise, a feature tag from a list this repo wrote), and nothing
 * else travels. Fired on the press, before navigation, because a client-side
 * navigation is the success and there is no later moment to fire from.
 */
export function TrickLink({
  kind,
  from,
  to,
  href,
  className,
  style,
  children,
  'aria-label': ariaLabel,
}: {
  kind: TrickLinkKind;
  /** The slug of the trick page the rider is on. */
  from: string;
  /** The target trick's slug, or the feature tag for `practise`. */
  to: string;
  href: Route;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  'aria-label'?: string;
}) {
  return (
    <Link
      href={href}
      className={className}
      style={style}
      aria-label={ariaLabel}
      onClick={() => capture(ANALYTICS_EVENTS.trickLinkFollowed, { kind, from, to })}
    >
      {children}
    </Link>
  );
}
