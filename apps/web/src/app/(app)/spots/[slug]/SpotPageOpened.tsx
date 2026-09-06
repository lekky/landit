'use client';

import { useEffect } from 'react';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

/**
 * Counts a spot page being read (§6.8). Renders nothing.
 *
 * The page itself is a server component and should stay one — it is copy, a
 * grid and two lists — so the client boundary is this and nothing else.
 *
 * **What it may carry, and what it may not.** `origin` says whether this is a
 * place staff researched or one a rider put forward and staff approved; `type`
 * is the spot's kind. Both are values chosen in this repository, so neither can
 * carry anything anybody typed. The spot's **name and slug are deliberately
 * absent**: a submitted spot's name is text a child wrote into a form, and its
 * slug is that text with the punctuation taken out. The catalogue rule is
 * catalogue facts, never rider facts, and a slug is a rider fact wearing a
 * product fact's clothes.
 *
 * The consequence is worth being clear about rather than working around: this
 * event cannot tell you *which* spot was opened. It can tell you whether
 * anybody reads a rider-submitted listing at all, which is the question the
 * page was built to answer.
 */
export function SpotPageOpened({
  origin,
  type,
}: {
  origin: 'researched' | 'submitted';
  type: string;
}) {
  useEffect(() => {
    capture(ANALYTICS_EVENTS.spotPageOpened, { origin, type });
  }, [origin, type]);

  return null;
}
