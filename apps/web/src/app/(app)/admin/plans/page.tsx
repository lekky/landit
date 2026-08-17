import { adminRiderCounts, listAdminPlans } from '@landit/db';
import type { Metadata } from 'next';

import { requireStaff } from '@/lib/staff';

import type { AdminPlanCard } from '../view';

import { PlansScreen } from './PlansScreen';

/**
 * The Plans tab (`landit-admin.jsx`, `AdminPlans`).
 *
 * Copy and pricing only, exactly as the prototype's own footnote says. The two
 * fields that decide what a plan *gives* — `unlocks_paid_tricks` and
 * `clip_cap_bytes` — are read here and shown, and are not editable from this
 * screen: they are the entitlements the paywall hook resolves, and a screen
 * whose job is wording should not be one slip from handing the paid library to
 * everybody (plan §3 guarantee 3).
 *
 * The rider count per plan comes from the same counter the Overview uses, so
 * the number staff see beside a price is the number they saw on the front page.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Plans · Staff portal',
  robots: { index: false, follow: false },
};

/** The counts want a window for "active"; this screen does not use that figure. */
const SINCE = new Date(0);

export default async function AdminPlansPage() {
  const staff = await requireStaff();
  const pb = staff.superuser;

  const plans = await listAdminPlans(pb);
  const counts = await adminRiderCounts(
    pb,
    plans.map((p) => p.slug),
    [],
    SINCE,
  );

  const asLines = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];

  const cards: AdminPlanCard[] = plans.map((plan) => ({
    id: plan.id,
    slug: plan.slug,
    name: plan.name,
    hue: plan.hue || 'var(--ink-3)',
    priceMonthly: plan.price_monthly,
    priceYearly: plan.price_yearly,
    per: plan.per,
    pitch: plan.pitch,
    perks: asLines(plan.perks),
    missing: asLines(plan.missing),
    isLive: plan.is_live,
    unlocksPaidTricks: plan.unlocks_paid_tricks,
    riders: counts.byPlan[plan.slug] ?? 0,
  }));

  return <PlansScreen cards={cards} />;
}
