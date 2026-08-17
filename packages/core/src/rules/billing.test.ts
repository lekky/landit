import { describe, expect, it } from 'vitest';

import { PLAN, PLANS } from '../data/plans';

import {
  BILLING_PERIODS,
  GUARDIAN_ONLY_AGE_BANDS,
  formatPricePence,
  isBillingPeriod,
  isPaidPlan,
  planPeriodLabel,
  planPricePence,
  requiredPayerKind,
  requiresGuardianPayer,
  statusEntitles,
  subscriptionRefusal,
  upgradeRouteFor,
  yearlySavingLabel,
  yearlySavingMonths,
} from './billing';

describe('prices', () => {
  it('quotes plan §6.7 exactly', () => {
    expect(planPricePence(PLAN.rookie, 'monthly')).toBe(0);
    expect(planPricePence(PLAN.rookie, 'yearly')).toBe(0);
    expect(planPricePence(PLAN.shredder, 'monthly')).toBe(399);
    expect(planPricePence(PLAN.shredder, 'yearly')).toBe(3999);
    expect(planPricePence(PLAN.legend, 'monthly')).toBe(699);
    expect(planPricePence(PLAN.legend, 'yearly')).toBe(6999);
  });

  it('calls zero "Free" rather than £0.00 — the free tier is not a trial', () => {
    expect(formatPricePence(0)).toBe('Free');
    expect(formatPricePence(-1)).toBe('Free');
  });

  it('keeps the pence on a whole pound so the cards line up on the decimal', () => {
    expect(formatPricePence(400)).toBe('£4.00');
    expect(formatPricePence(399)).toBe('£3.99');
    expect(formatPricePence(6999)).toBe('£69.99');
  });

  it('never says "per month" beside a yearly figure', () => {
    expect(planPeriodLabel(PLAN.shredder, 'monthly')).toBe('per month');
    expect(planPeriodLabel(PLAN.shredder, 'yearly')).toBe('per year');
    // The free tier has no period at all, whichever way the toggle is set.
    expect(planPeriodLabel(PLAN.rookie, 'monthly')).toBe('forever');
    expect(planPeriodLabel(PLAN.rookie, 'yearly')).toBe('forever');
  });

  it('knows a paid plan from its prices, never from its id', () => {
    expect(isPaidPlan(PLAN.rookie)).toBe(false);
    expect(isPaidPlan(PLAN.shredder)).toBe(true);
    expect(isPaidPlan(PLAN.legend)).toBe(true);
  });

  it('accepts only the two periods', () => {
    expect(BILLING_PERIODS).toEqual(['monthly', 'yearly']);
    expect(isBillingPeriod('monthly')).toBe(true);
    expect(isBillingPeriod('weekly')).toBe(false);
    expect(isBillingPeriod(null)).toBe(false);
  });
});

describe('the yearly saving', () => {
  it('derives "2 months free" from the prices rather than from copy', () => {
    // §6.7: "yearly ≈ two months free throughout". If a price moves and the
    // badge stops being true, this is where it says so.
    expect(yearlySavingMonths(PLAN.shredder)).toBe(2);
    expect(yearlySavingMonths(PLAN.legend)).toBe(2);
    expect(yearlySavingLabel([...PLANS])).toBe('2 months free');
  });

  it('says nothing when yearly saves nothing', () => {
    expect(yearlySavingMonths(PLAN.rookie)).toBe(0);
    expect(yearlySavingMonths({ priceMonthlyPence: 500, priceYearlyPence: 6000 })).toBe(0);
    expect(yearlySavingLabel([...PLANS].filter((p) => !isPaidPlan(p)))).toBeNull();
  });

  it('rounds a saving down rather than up when it is not close to a whole month', () => {
    // 1.5 months saved is one month free on the badge, never two: understating
    // is modest, overstating is an advertising claim.
    expect(yearlySavingMonths({ priceMonthlyPence: 400, priceYearlyPence: 4200 })).toBe(1);
    // Half a month saved is worth no badge at all.
    expect(yearlySavingMonths({ priceMonthlyPence: 400, priceYearlyPence: 4600 })).toBe(0);
  });

  it('quotes the smallest saving when the plans disagree', () => {
    expect(
      yearlySavingLabel([
        { ...PLAN.shredder, priceYearlyPence: 399 * 11 },
        { ...PLAN.legend, priceYearlyPence: 699 * 10 },
      ]),
    ).toBe('1 month free');
  });
});

describe('who may buy a subscription (plan §6.2)', () => {
  it('sends an under-16 rider to their guardian', () => {
    expect([...GUARDIAN_ONLY_AGE_BANDS]).toEqual(['under_13', '13_15']);
    expect(requiresGuardianPayer('under_13')).toBe(true);
    expect(requiresGuardianPayer('13_15')).toBe(true);
    expect(requiredPayerKind('13_15')).toBe('guardian');
  });

  it('lets a 16+ rider reach checkout', () => {
    expect(requiresGuardianPayer('16_17')).toBe(false);
    expect(requiresGuardianPayer('adult')).toBe(false);
    expect(requiredPayerKind('adult')).toBe('rider');
    expect(upgradeRouteFor({ ageBand: '16_17', consentState: 'not_required' })).toBe('checkout');
    expect(upgradeRouteFor({ ageBand: 'adult', consentState: 'not_required' })).toBe('checkout');
  });

  it('treats an undeclared band as under 16, not as an adult', () => {
    expect(requiresGuardianPayer(null)).toBe(true);
    expect(upgradeRouteFor({ consentState: 'not_required' })).toBe('guardian');
  });

  it('offers no upgrade at all behind the consent gate (§3 guarantee 4)', () => {
    expect(upgradeRouteFor({ ageBand: 'adult', consentState: 'pending' })).toBe('blocked');
    expect(upgradeRouteFor({ ageBand: 'adult', consentState: 'revoked' })).toBe('blocked');
    expect(upgradeRouteFor({ ageBand: '13_15', consentState: 'pending' })).toBe('blocked');
    // Granted is the state a consented child is in, and it is not a refusal.
    expect(upgradeRouteFor({ ageBand: '13_15', consentState: 'granted' })).toBe('guardian');
  });
});

describe('subscriptionRefusal — the client-side copy of the hook’s three checks', () => {
  const adult = { ageBand: 'adult', consentState: 'not_required' } as const;

  it('passes an adult who confirmed their age', () => {
    expect(subscriptionRefusal({ ...adult, payerKind: 'rider', payerAdultConfirmed: true })).toBe(
      null,
    );
  });

  it('refuses without the 18+ confirmation, whoever is paying', () => {
    expect(
      subscriptionRefusal({ ...adult, payerKind: 'rider', payerAdultConfirmed: false }),
    ).toMatch(/18 or over/);
    expect(
      subscriptionRefusal({
        ageBand: '13_15',
        consentState: 'granted',
        payerKind: 'guardian',
        payerAdultConfirmed: false,
      }),
    ).toMatch(/18 or over/);
  });

  it('refuses a child buying their own subscription', () => {
    expect(
      subscriptionRefusal({
        ageBand: 'under_13',
        consentState: 'granted',
        payerKind: 'rider',
        payerAdultConfirmed: true,
      }),
    ).toMatch(/parent or carer/);
  });

  it('lets a guardian buy for that same child', () => {
    expect(
      subscriptionRefusal({
        ageBand: 'under_13',
        consentState: 'granted',
        payerKind: 'guardian',
        payerAdultConfirmed: true,
      }),
    ).toBe(null);
  });

  it('refuses a consent-limited account before it asks anything else', () => {
    expect(
      subscriptionRefusal({
        ageBand: 'adult',
        consentState: 'pending',
        payerKind: 'rider',
        payerAdultConfirmed: true,
      }),
    ).toMatch(/guardian/);
  });
});

describe('which statuses entitle', () => {
  it('entitles active and trialing only', () => {
    expect(statusEntitles('active')).toBe(true);
    expect(statusEntitles('trialing')).toBe(true);
  });

  it('fails towards the free tier on anything else, past_due included', () => {
    for (const status of ['past_due', 'canceled', 'expired', '', null, undefined, 'unpaid']) {
      expect(statusEntitles(status)).toBe(false);
    }
  });
});
