'use client';

import { useEffect } from 'react';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

/**
 * Counts a rider meeting the paywall (§6.8). Renders nothing.
 *
 * `LockedTrick` is a server component, and it should stay one — the page is
 * mostly copy, and turning it into a client component to fire a counter would
 * ship the whole thing to the browser for the sake of one event. So the client
 * boundary is this, and it is as small as a client boundary gets.
 *
 * **It counts the paywall being *seen*, not a trick being opened.** Which is
 * the question §6.8 actually wants answered: how often does a rookie run into
 * the tier they do not have, and on which tricks. That is also why it lives on
 * the locked page rather than beside the `trick_progress` refusal — the hook is
 * the paywall (plan §3, guarantee 3), but a 403 nobody is looking at is not the
 * moment a rider decides whether to upgrade.
 *
 * The trick's id, tier and sport are catalogue facts. Nothing here says who was
 * looking, and with no cookie and no person profile there is nothing to join it
 * to if it did.
 */
export function PaywallSeen({
  trickId,
  sport,
  tier,
}: {
  trickId: string;
  sport: string;
  /**
   * The difficulty tier's label — "Spicy", "Gnarly", "Pro". Optional because
   * it is read out of `TIERS_LABEL` by index, and the caller should not have to
   * assert its way past that to fire a counter.
   */
  tier: string | undefined;
}) {
  useEffect(() => {
    capture(ANALYTICS_EVENTS.paywallHit, { trick: trickId, sport, tier });
  }, [trickId, sport, tier]);

  return null;
}
