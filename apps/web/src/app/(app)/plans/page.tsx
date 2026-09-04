import { upgradeRouteFor, type AgeBand } from '@landit/core';
import { getActiveSubscription, listPlans } from '@landit/db';
import type { Metadata } from 'next';

import { ROUTES } from '@/lib/routes';
import { anonymousClient, currentRider } from '@/lib/session';
import { stripeConfig } from '@/lib/stripe';

import { PlansScreen } from './PlansScreen';
import { buildPlansView } from './view';

export const metadata: Metadata = {
  title: 'Plans · Land The Trick',
  description:
    'Rookie is free forever. Shredder unlocks every trick; Legend adds flair and progress insights.',
  alternates: { canonical: ROUTES.plans },
};

/**
 * Membership (screenshot 20, plan §2.4 and §6.7).
 *
 * **Readable signed out**, unlike every other screen in this group. A pricing
 * page is the one thing in the app a person might reasonably want to see before
 * they have an account — the site footer links it, and sending a prospective
 * rider to a sign-in form to find out what things cost is the wrong answer. The
 * app shell already handles a signed-out visitor (it shows Sign in instead of
 * the streak chip), so the page only has to decide what its buttons say.
 *
 * **The cards are read from the `plans` collection**, whose `listRule` is
 * `is_live = true` and which is therefore readable anonymously. That is
 * deliberate: prices, perks and the "Most riders" flag are staff-editable, and
 * a page that carried its own copy of them would be a second source that stops
 * agreeing with the admin the first time somebody edits one.
 *
 * **Nothing on this page is the paywall.** What a plan unlocks is decided by
 * `plans.unlocks_paid_tricks`, `includes_insights` and
 * `includes_flair` on the server, and what a rider is entitled to is resolved
 * from their own `subscriptions` rows by the hook. This screen sells; it does
 * not grant.
 */
export default async function PlansPage() {
  const session = await currentRider();
  const rider = session?.rider ?? null;

  // Anonymous when signed out — `plans` is public, which is what makes that one
  // line rather than a second code path.
  const plans = await listPlans(session?.client ?? anonymousClient());

  // **Stripe-sourced only.** A staff comp is also a `subscriptions` row now
  // (`source: 'staff'`, see the §7 T15 note on precedence), and there is no
  // billing behind one — no customer, no card, nothing for the portal to open.
  // Offering "Manage billing" for a comp would be a dead end.
  const subscription =
    session && rider ? await getActiveSubscription(session.client, rider.id, 'stripe') : null;

  const view = buildPlansView({
    plans,
    currentPlanSlug: rider?.plan ?? 'rookie',
    signedIn: Boolean(rider),
    upgradeRoute: upgradeRouteFor({
      ageBand: (rider?.age_band as AgeBand | null) ?? null,
      consentState: rider?.consent_state ?? null,
    }),
    checkoutLive: stripeConfig() !== null,
    hasSubscription: Boolean(subscription),
  });

  return <PlansScreen view={view} />;
}
