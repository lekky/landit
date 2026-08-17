import type { Plan } from '../types';

import type { AgeBand, ConsentState } from './consent';

/**
 * What a subscription costs, and who is allowed to buy one (plan §2.4, §6.2,
 * §6.7).
 *
 * Two rules live here and they are not the same kind of thing.
 *
 * **Price** is presentation: pence in, a string out, with the yearly saving
 * derived from the two numbers rather than written into copy that could
 * disagree with them (LESSONS §4 — copy that quotes a value somebody can change
 * belongs beside that value). The prototype multiplied the monthly price by ten
 * to get the yearly one; the plan fixes both explicitly in §6.7, so nothing here
 * computes a price.
 *
 * **Who may buy** is a safeguarding decision, and this module is only where it
 * is *defined*. It is **enforced** in `pocketbase/hooks/55_subscriptions.pb.js`
 * at the model layer, on every write path, exactly as the paywall is (plan §3).
 * A rider whose plan changed because a screen let them press a button would be
 * the same class of bug as a client-side paywall.
 *
 * Nothing here decides what a plan *contains*. Entitlements are resolved from
 * the `plans` record — `unlocks_paid_tricks`,
 * `includes_insights`, `includes_flair` — never by comparing a plan id to the
 * string `legend`. See `planUnlocksPaidTricks` in `./tricks` and
 * `planIncludesInsights` in `./progress` for the same arrangement.
 */

/* ---------------------------------------------------------------- pricing -- */

/** Monthly or yearly. The plans page toggles between the two. */
export type BillingPeriod = 'monthly' | 'yearly';

export const BILLING_PERIODS = ['monthly', 'yearly'] as const satisfies readonly BillingPeriod[];

export function isBillingPeriod(value: unknown): value is BillingPeriod {
  return value === 'monthly' || value === 'yearly';
}

/** A plan is paid when either price is above zero. Never `id === 'legend'`. */
export function isPaidPlan(plan: Pick<Plan, 'priceMonthlyPence' | 'priceYearlyPence'>): boolean {
  return plan.priceMonthlyPence > 0 || plan.priceYearlyPence > 0;
}

/** What this plan costs for that period, in pence. */
export function planPricePence(
  plan: Pick<Plan, 'priceMonthlyPence' | 'priceYearlyPence'>,
  period: BillingPeriod,
): number {
  return period === 'yearly' ? plan.priceYearlyPence : plan.priceMonthlyPence;
}

/**
 * Pence as a price a rider reads. `0` is **"Free"**, not "£0.00" — the free
 * tier is not a trial and the page says so in the one place a price is quoted.
 *
 * Whole pounds keep their pence (`£4.00`, not `£4`) so the three cards line up
 * on the decimal point, which is what the design does.
 */
export function formatPricePence(pence: number): string {
  if (pence <= 0) return 'Free';
  return `£${(pence / 100).toFixed(2)}`;
}

/**
 * The words after the price. `per` on the plan record is the free tier's
 * ("forever"); a paid tier's follows the toggle, so it can never say "per
 * month" beside a yearly figure.
 */
export function planPeriodLabel(
  plan: Pick<Plan, 'priceMonthlyPence' | 'priceYearlyPence'>,
  period: BillingPeriod,
): string {
  if (!isPaidPlan(plan)) return 'forever';
  return period === 'yearly' ? 'per year' : 'per month';
}

/**
 * How close is the yearly price is 10% (0.1 of a month) of a whole number of
 * months' saving? Anything looser is not a claim this product will print.
 */
const SAVING_CLAIM_TOLERANCE_MONTHS = 0.1;

/**
 * How many months of the monthly price the yearly price saves.
 *
 * §6.7 says "yearly ≈ two months free throughout" and the badge on the toggle
 * says so. Deriving it from the two prices means the badge cannot outlive a
 * price change — the trap issue #10 caught in sticker names, arriving in the
 * pricing table.
 *
 * The rounding is where the "≈" gets spent, so it only ever spends a little.
 * Shredder saves £47.88 − £39.99 = £7.89, which is 1.98 monthly payments;
 * calling that two months free is what any reader would call it. A saving that
 * is *not* close to a whole month rounds **down** rather than up, so a plan
 * saving a month and a half is advertised as one month and never as two. A
 * badge that overstates by half a month is an advertising claim; one that
 * understates is only modest.
 */
export function yearlySavingMonths(
  plan: Pick<Plan, 'priceMonthlyPence' | 'priceYearlyPence'>,
): number {
  if (!isPaidPlan(plan) || plan.priceMonthlyPence <= 0) return 0;
  const saved = plan.priceMonthlyPence * 12 - plan.priceYearlyPence;
  if (saved <= 0) return 0;

  const months = saved / plan.priceMonthlyPence;
  const nearest = Math.round(months);
  if (nearest >= 1 && Math.abs(months - nearest) <= SAVING_CLAIM_TOLERANCE_MONTHS) return nearest;
  return Math.floor(months);
}

/**
 * The badge beside the monthly/yearly toggle, or `null` when yearly saves
 * nothing on any plan.
 */
export function yearlySavingLabel(plans: readonly Plan[]): string | null {
  const months = plans.map(yearlySavingMonths).filter((n) => n > 0);
  if (!months.length) return null;
  const least = Math.min(...months);
  return least === 1 ? '1 month free' : `${least} months free`;
}

/* ------------------------------------------------------------ who may pay -- */

/**
 * Who the counterparty on a subscription is.
 *
 * `guardian` is not a discount or a different product — it is the same
 * single-rider subscription, bought by the adult the consent flow already knows
 * about (plan §6.2). It exists as a stored fact because "an adult bought this"
 * is the thing the hook has to be able to check later.
 */
export type PayerKind = 'rider' | 'guardian';

/**
 * The bands that cannot be sold to in-app, whoever is holding the phone.
 *
 * §6.2: "for riders under 16 the upgrade routes to a guardian by email rather
 * than being purchasable in-app by the child." Sixteen is the line because the
 * bands are `under_13 | 13_15 | 16_17 | adult` and 16 is the only boundary the
 * band data can actually resolve — a birth date was never stored (§3), so a
 * finer line would be a guess.
 */
export const GUARDIAN_ONLY_AGE_BANDS = ['under_13', '13_15'] as const satisfies readonly AgeBand[];

/**
 * Whether this rider's upgrade must be bought by their guardian.
 *
 * **A missing band counts as under 16.** The band is set at sign-up and frozen
 * (§3), so its absence means a record older or stranger than the flow that
 * writes it — and the direction that over-protects is the only safe reading of
 * "we do not know how old this rider is". Same fail-safe as §6.3's table.
 */
export function requiresGuardianPayer(band: AgeBand | null | undefined): boolean {
  if (!band) return true;
  return (GUARDIAN_ONLY_AGE_BANDS as readonly string[]).includes(band);
}

/** The payer a subscription for this rider must record. */
export function requiredPayerKind(band: AgeBand | null | undefined): PayerKind {
  return requiresGuardianPayer(band) ? 'guardian' : 'rider';
}

/**
 * What happens when a rider presses "Get Shredder".
 *
 * - `blocked` — the account is behind the consent gate (`pending`/`revoked`).
 *   §3 guarantee 4 lists "hold a subscription" among the things it cannot do,
 *   so there is no upgrade to offer, only an explanation.
 * - `guardian` — under 16. The checkout link goes to the guardian by email; the
 *   child never reaches a payment form.
 * - `checkout` — 16+ and consented. Checkout opens, and it still requires the
 *   payer to confirm they are 18 or over (§6.2), which is why this is a route
 *   and not a yes/no.
 *
 * A rider with no declared band reads as `guardian`, the over-protective
 * direction — the same fail-safe the consent table takes (§6.3).
 */
export type UpgradeRoute = 'checkout' | 'guardian' | 'blocked';

export function upgradeRouteFor(rider: {
  readonly ageBand?: AgeBand | null;
  readonly consentState?: ConsentState | null;
}): UpgradeRoute {
  const consent = rider.consentState ?? 'not_required';
  if (consent === 'pending' || consent === 'revoked') return 'blocked';
  if (!rider.ageBand) return 'guardian';
  return requiresGuardianPayer(rider.ageBand) ? 'guardian' : 'checkout';
}

/**
 * Whether a subscription record is one this product is willing to hold.
 *
 * The same three questions the hook asks, in the language the client has. It is
 * here so a screen can explain the refusal before it happens; it is **not** the
 * refusal. `pocketbase/hooks/55_subscriptions.pb.js` is, and it runs at the
 * model layer where no client and no superuser token can go round it.
 */
export function subscriptionRefusal(input: {
  readonly ageBand?: AgeBand | null;
  readonly consentState?: ConsentState | null;
  readonly payerKind?: PayerKind | null;
  readonly payerAdultConfirmed?: boolean;
}): string | null {
  const route = upgradeRouteFor(input);
  if (route === 'blocked') {
    return 'This account is waiting on a guardian’s approval and cannot hold a subscription.';
  }
  if (!input.payerAdultConfirmed) {
    return 'Whoever pays has to confirm they are 18 or over.';
  }
  if (route === 'guardian' && input.payerKind !== 'guardian') {
    return 'A rider under 16 is upgraded by their parent or carer, not in the app.';
  }
  return null;
}

/* ------------------------------------------------------- what Stripe says -- */

/**
 * The subscription statuses that entitle a rider to their plan.
 *
 * `past_due` is deliberately **not** here. A failed payment is a billing
 * problem to be sorted out, not a reason to keep charging entitlement to it;
 * and the direction that fails towards the free tier is the one that cannot
 * over-serve a child's account. Stripe's own retry schedule moves a genuinely
 * temporary failure back to `active` on its own.
 */
export const ENTITLING_SUBSCRIPTION_STATUSES = ['active', 'trialing'] as const;

/** Whether a subscription in this status entitles the rider to its plan. */
export function statusEntitles(status: string | null | undefined): boolean {
  return (ENTITLING_SUBSCRIPTION_STATUSES as readonly string[]).includes(String(status ?? ''));
}
