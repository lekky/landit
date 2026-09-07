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
 * is the spot's kind; `operating` is whether the place is still standing and
 * `indoor` whether it is under a roof. All four are values chosen in this
 * repository or picked from a fixed list by staff, so none can carry anything
 * anybody typed. The spot's **name and slug are deliberately
 * absent**: a submitted spot's name is text a child wrote into a form, and its
 * slug is that text with the punctuation taken out. The catalogue rule is
 * catalogue facts, never rider facts, and a slug is a rider fact wearing a
 * product fact's clothes.
 *
 * The consequence is worth being clear about rather than working around: this
 * event cannot tell you *which* spot was opened. It can tell you whether
 * anybody reads a rider-submitted listing at all, which is the question the
 * page was built to answer.
 *
 * **Why `operating` is worth counting.** A closed park keeps its page, and the
 * only way to learn whether that was the right call is to see how many readings
 * land on one. If the answer turns out to be "hundreds a month", the closed
 * notice is doing real work and deserves more than a red block; if it is
 * "none", these pages can be quietly dropped from the sitemap.
 */
export function SpotPageOpened({
  origin,
  type,
  operating,
  indoor,
}: {
  origin: 'researched' | 'submitted';
  type: string;
  operating: string;
  indoor: boolean;
}) {
  useEffect(() => {
    capture(ANALYTICS_EVENTS.spotPageOpened, { origin, type, operating, indoor });
  }, [origin, type, operating, indoor]);

  return null;
}
