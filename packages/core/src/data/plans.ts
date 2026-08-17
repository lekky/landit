import type { Plan, PlanId } from '../types';

/** One gigabyte. Only `clipCapBytes` uses it, and that field is dormant — see below. */
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
 * `clipCapBytes` is **dormant, and is not an entitlement any more.** It was the
 * per-rider clip-vault cap; the owner reversed clip hosting on 2026-08-17 (plan
 * §1, §6.6) and the hook that enforced it is gone, so nothing reads this number
 * to decide what a rider may do. It is kept, unchanged, for one reason only:
 * `listPlans` in `@landit/db` orders every plan-card surface — the plans page,
 * the staff plan bars, the staff plan dropdown — by `plans.clip_cap_bytes`
 * ascending, because it is that collection's only numeric column and happened
 * to rise with price. Zeroing it would collapse that ordering; replacing it
 * needs an explicit rank column, which is issue territory rather than this PR's
 * (see the §6.6 note in the plan). **Do not read it as a vault size, and do not
 * put a number derived from it on a screen.** `t15b-video-links` decides
 * whether any per-plan video limit exists at all.
 *
 * `includesInsights` is the same idea for the progress insights panel (§2.4):
 * Legend only, resolved from the plan record rather than from a hard-coded
 * `plan === 'legend'` anywhere. It is an entitlement, not a consent — an
 * entitled rider still has to opt in before any profiling happens (§6.4).
 *
 * `includesFlair` is the third of the same kind (T11): the Legend tag beside a
 * rider's name on their profile and crew board. Cosmetic by construction — it
 * decorates a name and touches no score, stage or sticker, which is what keeps
 * it on the right side of "achievements are never for sale".
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
    missing: ['Spicy, Gnarly and Pro tricks', 'Progress insights'],
    priceMonthlyPence: 0,
    priceYearlyPence: 0,
    clipCapBytes: 0,
    unlocksPaidTricks: false,
    includesInsights: false,
    includesFlair: false,
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
      'Challenge history + progress stats',
      'Custom printable sheets',
    ],
    missing: ['Legend flair', 'Progress insights'],
    priceMonthlyPence: 399,
    priceYearlyPence: 3999,
    clipCapBytes: 2 * GB,
    unlocksPaidTricks: true,
    includesInsights: false,
    includesFlair: false,
  },
  {
    id: 'legend',
    name: 'Legend',
    hue: '#8A3BE0',
    pitch: 'Everything unlocked, plus the numbers behind your riding.',
    perks: [
      'Everything in Shredder',
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
    includesFlair: true,
  },
] as const satisfies readonly Plan[];

const byPlanId = {} as Record<PlanId, Plan>;
for (const plan of PLANS) byPlanId[plan.id] = plan;

/** Plan id to record, for the many places that only have the id. */
export const PLAN: Readonly<Record<PlanId, Plan>> = byPlanId;

export const PLAN_IDS = PLANS.map((p) => p.id) as readonly PlanId[];
