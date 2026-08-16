import type { Plan, PlanId } from '../types';

/** One gigabyte, as the clip caps are quoted in GB (plan §6). */
const GB = 1024 * 1024 * 1024;

/**
 * The three launch plans (plan §2.4 and §6). This is where the plan overrides
 * the prototype: the prototype's third card is a five-seat "Crew Pass", which
 * was **dropped** on 2026-08-15 and replaced by **Legend** — still a
 * single-rider subscription, so billing stays one rider / one subscription.
 *
 * One principle governs what a paid tier may ever contain: **achievements are
 * never for sale**. Stickers and stages are earned-only on every plan; paid
 * tiers sell capacity, cosmetics and insight. Nothing in `perks` below may be a
 * sticker, a stage or a shortcut to one.
 *
 * `clipCapBytes` is the number the upload hook enforces, read from the plan
 * record so staff can tune it without a deploy. Rookie is zero: free riders
 * cannot save clips at all.
 *
 * `includesInsights` is the same idea for the progress insights panel (§2.4):
 * Legend only, resolved from the plan record rather than from a hard-coded
 * `plan === 'legend'` anywhere. It is an entitlement, not a consent — an
 * entitled rider still has to opt in before any profiling happens (§6.4).
 *
 * Copy is the plan's pitch rendered into the prototype's card shape; T15 owns
 * the final wording of the plans page.
 */
export const PLANS = [
  {
    id: 'rookie',
    name: 'Rookie',
    hue: '#10A06A',
    pitch: 'Both libraries, up to the Easy tier, tracked properly. No trial, no card.',
    perks: [
      'Scooter and skateboard libraries',
      'Every Rookie and Easy trick',
      'Track every trick through 5 stages',
      'Digital sticker wall',
      "This week's challenge",
      'Spots map and your crew',
    ],
    missing: ['Spicy, Gnarly and Pro tricks', 'Saving clips', 'Progress insights'],
    priceMonthlyPence: 0,
    priceYearlyPence: 0,
    clipCapBytes: 0,
    unlocksPaidTricks: false,
    includesInsights: false,
  },
  {
    id: 'shredder',
    name: 'Shredder',
    hue: '#FF5A1F',
    popular: true,
    pitch: 'Unlocks the Spicy, Gnarly and Pro tiers. The whips, flips and tre flips.',
    perks: [
      'Everything in Rookie',
      'Every trick, both sports',
      'Spicy, Gnarly and Pro unlocked',
      '2GB clip vault',
      'Challenge history + progress stats',
      'Custom printable sheets',
    ],
    missing: ['5GB clip vault', 'Legend flair', 'Progress insights'],
    priceMonthlyPence: 399,
    priceYearlyPence: 3999,
    clipCapBytes: 2 * GB,
    unlocksPaidTricks: true,
    includesInsights: false,
  },
  {
    id: 'legend',
    name: 'Legend',
    hue: '#8A3BE0',
    pitch: 'Everything unlocked, a bigger vault, and the numbers behind your riding.',
    perks: [
      'Everything in Shredder',
      '5GB clip vault',
      'Legend flair on your profile and crew board',
      'Exclusive avatar drops',
      'Progress insights: per-category trends and personal records',
      'Next-trick suggestions from the skill tree',
    ],
    missing: [],
    priceMonthlyPence: 699,
    priceYearlyPence: 6999,
    clipCapBytes: 5 * GB,
    unlocksPaidTricks: true,
    includesInsights: true,
  },
] as const satisfies readonly Plan[];

const byPlanId = {} as Record<PlanId, Plan>;
for (const plan of PLANS) byPlanId[plan.id] = plan;

/** Plan id to record, for the many places that only have the id. */
export const PLAN: Readonly<Record<PlanId, Plan>> = byPlanId;

export const PLAN_IDS = PLANS.map((p) => p.id) as readonly PlanId[];
