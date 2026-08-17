import {
  PLAN,
  formatPricePence,
  isPaidPlan,
  planPeriodLabel,
  yearlySavingLabel,
  type BillingPeriod,
  type PlanId,
  type UpgradeRoute,
} from '@landit/core';
import type { PlansRecord } from '@landit/db';

/**
 * The plans page's data, shaped on the server (screenshot 20, plan §2.4).
 *
 * A view module for the reason every other screen has one: the monthly/yearly
 * toggle is client state, so without this every price string would be produced
 * twice — once by Node and once by Chromium — and the two are exactly the sort
 * of thing that drifts (LESSONS §3a). Both prices are computed here and the
 * toggle only chooses which of them to show.
 *
 * **The cards come from the `plans` records**, not from a table in this file.
 * Name, pitch, perks, the struck-through list, the hue and the "Most riders"
 * flag are all staff-editable, and a page that hard-coded them would be a
 * second copy that stops agreeing the first time somebody edits one.
 */

export interface PlanCardView {
  readonly slug: string;
  readonly name: string;
  readonly hue: string;
  readonly pitch: string;
  readonly perks: readonly string[];
  readonly missing: readonly string[];
  readonly popular: boolean;
  readonly paid: boolean;
  /** Price and period label for each side of the toggle. */
  readonly price: Readonly<Record<BillingPeriod, string>>;
  readonly per: Readonly<Record<BillingPeriod, string>>;
  /** The plan this rider is on right now. */
  readonly current: boolean;
}

export interface PlansView {
  readonly cards: readonly PlanCardView[];
  /** "2 months free", or `null` when yearly saves nothing. */
  readonly savingLabel: string | null;
  readonly signedIn: boolean;
  /** What pressing "Get Shredder" does for this rider (plan §6.2). */
  readonly upgradeRoute: UpgradeRoute;
  /** Whether a Stripe account is configured on this deployment at all. */
  readonly checkoutLive: boolean;
  /** Whether there is a subscription to manage. */
  readonly hasSubscription: boolean;
  readonly currentPlanSlug: string;
}

/** A `perks`/`missing` JSON column, which PocketBase hands back as `unknown`. */
function stringList(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/**
 * Prices, from the plan record with the canonical pence behind them.
 *
 * `price_monthly` and `price_yearly` are text on the record so staff can retune
 * them (plan §3), and the seed writes them from `@landit/core`'s pence — which
 * is also what the yearly-saving badge is derived from. Where a record is blank
 * (an older seed, a plan added by hand) the canonical figure fills in, so a
 * card never renders with an empty price.
 */
function priceStrings(record: PlansRecord): Record<BillingPeriod, string> {
  const canonical = PLAN[record.slug as PlanId];
  return {
    monthly:
      record.price_monthly ||
      (canonical ? formatPricePence(canonical.priceMonthlyPence) : formatPricePence(0)),
    yearly:
      record.price_yearly ||
      (canonical ? formatPricePence(canonical.priceYearlyPence) : formatPricePence(0)),
  };
}

export function buildPlansView(input: {
  readonly plans: readonly PlansRecord[];
  readonly currentPlanSlug: string;
  readonly signedIn: boolean;
  readonly upgradeRoute: UpgradeRoute;
  readonly checkoutLive: boolean;
  readonly hasSubscription: boolean;
}): PlansView {
  const cards = input.plans.map((record): PlanCardView => {
    const canonical = PLAN[record.slug as PlanId];
    const paid = canonical
      ? isPaidPlan(canonical)
      : Boolean(record.price_monthly && record.price_monthly !== 'Free');

    // The free tier's word is "forever" whichever way the toggle is set; a paid
    // tier's follows it, so a card can never say "per month" beside a yearly
    // figure. `planPeriodLabel` decides, in `@landit/core`, for both.
    const per: Record<BillingPeriod, string> = canonical
      ? {
          monthly: planPeriodLabel(canonical, 'monthly'),
          yearly: planPeriodLabel(canonical, 'yearly'),
        }
      : { monthly: record.per || 'per month', yearly: record.per || 'per year' };

    return {
      slug: record.slug,
      name: record.name,
      hue: record.hue || 'var(--ink)',
      pitch: record.pitch,
      perks: stringList(record.perks),
      missing: stringList(record.missing),
      popular: Boolean(record.popular),
      paid,
      price: priceStrings(record),
      per,
      // Only a signed-in rider is *on* a plan. `currentPlanSlug` falls back to
      // `rookie` for a visitor, so without the first half the free card would
      // greet a stranger with "Your plan" — which is both wrong and the sort of
      // thing only a look at the rendered page catches.
      current: input.signedIn && record.slug === input.currentPlanSlug,
    };
  });

  return {
    cards,
    savingLabel: yearlySavingLabel(
      cards
        .map((card) => PLAN[card.slug as PlanId])
        .filter((plan): plan is (typeof PLAN)[PlanId] => Boolean(plan)),
    ),
    signedIn: input.signedIn,
    upgradeRoute: input.upgradeRoute,
    checkoutLive: input.checkoutLive,
    hasSubscription: input.hasSubscription,
    currentPlanSlug: input.currentPlanSlug,
  };
}
