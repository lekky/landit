import { SHREDDER_VIDEO_LINK_CAP, videoLinkAllowanceLabel } from '../rules/video';
import type { Plan, PlanId, VideoLinkAllowance } from '../types';

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
 * put a number derived from it on a screen.** The per-plan video limit that
 * replaced it is `videoLinkCap`/`videoLinksUnlimited` below — a **count of
 * links**, not bytes, because we do not hold the bytes.
 *
 * `videoLinkCap` and `videoLinksUnlimited` are the video-link allowance (§6.6,
 * owner's decision 2026-08-17: Rookie none, Shredder a limited number, Legend
 * unlimited). Two fields rather than one number with a sentinel in it —
 * `videoLinkAllowance` in `rules/video.ts` records why, and why that is also the
 * fail-closed direction in the database. **Shredder's number is a tunable
 * default, not a deliberated decision** (`SHREDDER_VIDEO_LINK_CAP`, plan §1
 * alongside `WEEKLY_RIDE_TARGET`); Rookie's zero and Legend's unlimited are the
 * owner's.
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
 *
 * ---
 *
 * **What the free tier actually is, and why the copy says what it says**
 * (rewritten 2026-09-04, `chore-plan-card-rewrite`, closing issue #286).
 *
 * Rookie is **not a tier boundary**, and describing it as one was false in both
 * directions for months. "Every Rookie and Easy trick" was wrong because four
 * BMX difficulty-2 tricks carry `free: false`; "Spicy, Gnarly and Pro tricks"
 * as the missing line was wrong because a skater already gets four Spicy tricks
 * free, a scooter rider gets the Tailwhip and a BMX rider the Double Peg Grind.
 * Shredder's "unlocks the Spicy, Gnarly and Pro tiers" was the same untruth
 * read from the other side. A parent comparing the cards against the library
 * would have found the cards wrong.
 *
 * The free tier is instead a **deliberate hand-picked spread: ten tricks in
 * each sport, weighted towards the easy end but reaching past it** (owner's
 * decision, 2026-09-04 — the shape is 4 Rookie / 3 Easy / 2 Spicy / 1 Gnarly
 * per sport, nothing free at Pro, implemented in `./tricks.ts`). The reason is
 * a product one: an experienced rider on the free plan who only ever sees
 * tricks they landed years ago is shown nothing, and they are the person most
 * able to pay.
 *
 * So the copy names **ten**, and it names **three sports**, and it names no
 * tier at all. Two rules govern it:
 *
 * - **"Ten" is safe to write down; a library count is not.** It is a
 *   deliberated, per-sport, tested number — `data.test.ts` fails if any sport
 *   drifts off it — which is exactly the condition `./stickers.ts` sets for a
 *   name that quotes a value (issue #10). A line saying "87 paid tricks" would
 *   go stale the next time staff add one, so nothing here counts the library.
 * - **No line names a tier as the boundary**, because the boundary is not a
 *   tier and cannot become one again without this comment and those tests
 *   changing on purpose.
 */
/**
 * The allowance each plan grants, and the one place the numbers live.
 *
 * The perk lines below are *rendered* from these through
 * `videoLinkAllowanceLabel`, rather than being typed out beside them, so a card
 * cannot advertise a number the hook does not enforce. Moving Shredder's cap is
 * `SHREDDER_VIDEO_LINK_CAP` and nothing else.
 */
const VIDEO_LINKS = {
  rookie: { cap: 0, unlimited: false },
  shredder: { cap: SHREDDER_VIDEO_LINK_CAP, unlimited: false },
  legend: { cap: 0, unlimited: true },
} as const satisfies Record<PlanId, VideoLinkAllowance>;

export const PLANS = [
  {
    id: 'rookie',
    name: 'Rookie',
    hue: '#10A06A',
    pitch:
      'Ten hand-picked tricks in every sport, easy ones and hard ones, tracked properly. No trial, no card.',
    perks: [
      'Scooter, skateboard and BMX libraries',
      'Ten free tricks in each sport, not just the beginner ones',
      'Track every trick through 5 stages',
      'Digital sticker wall',
      "This week's challenge",
      'Spots map and your crew',
    ],
    missing: [
      'Every other trick in the library',
      'Progress insights',
      videoLinkAllowanceLabel(VIDEO_LINKS.rookie),
    ],
    priceMonthlyPence: 0,
    priceYearlyPence: 0,
    clipCapBytes: 0,
    unlocksPaidTricks: false,
    includesInsights: false,
    includesFlair: false,
    videoLinkCap: VIDEO_LINKS.rookie.cap,
    videoLinksUnlimited: VIDEO_LINKS.rookie.unlimited,
  },
  {
    id: 'shredder',
    name: 'Shredder',
    hue: '#FF5A1F',
    popular: true,
    pitch: 'The whole library, not just the ten we picked for you. The whips, flips and tre flips.',
    perks: [
      'Everything in Rookie',
      'Every trick in all three sports, nothing locked',
      'Challenge history kept, week after week',
      'Custom printable trick sheets',
      `${videoLinkAllowanceLabel(VIDEO_LINKS.shredder)}, private until you say otherwise`,
    ],
    missing: ['Legend flair', 'Progress insights'],
    priceMonthlyPence: 399,
    priceYearlyPence: 3999,
    clipCapBytes: 2 * GB,
    unlocksPaidTricks: true,
    includesInsights: false,
    includesFlair: false,
    videoLinkCap: VIDEO_LINKS.shredder.cap,
    videoLinksUnlimited: VIDEO_LINKS.shredder.unlimited,
  },
  {
    id: 'legend',
    name: 'Legend',
    hue: '#8A3BE0',
    pitch: 'Everything unlocked, plus the numbers behind your riding.',
    // "Exclusive avatar drops" was here until 2026-09-04 and was never true:
    // `./avatars.ts` gates nothing on a plan, and no hook, screen or rule reads
    // a plan when it lists avatars — every rider on every tier sees all 36. It
    // is removed rather than rewritten because there is nothing to rewrite it
    // to. The three lines that replaced it are the three things
    // `progressInsights` actually returns (`../rules/progress.ts`: `trends`,
    // `records`, `next`), which is Legend's real differentiator alongside
    // unlimited video links — issue #129 asks whether that is worth £6.99, and
    // that is the owner's question, not this file's.
    perks: [
      'Everything in Shredder',
      'Legend flair on your profile and crew board',
      'Progress insights: which categories you are speeding up in',
      'Personal records: best month, longest run, hardest landing',
      'Next-trick suggestions from the skill tree',
      videoLinkAllowanceLabel(VIDEO_LINKS.legend),
    ],
    missing: [],
    priceMonthlyPence: 699,
    priceYearlyPence: 6999,
    clipCapBytes: 5 * GB,
    unlocksPaidTricks: true,
    includesInsights: true,
    includesFlair: true,
    videoLinkCap: VIDEO_LINKS.legend.cap,
    videoLinksUnlimited: VIDEO_LINKS.legend.unlimited,
  },
] as const satisfies readonly Plan[];

const byPlanId = {} as Record<PlanId, Plan>;
for (const plan of PLANS) byPlanId[plan.id] = plan;

/** Plan id to record, for the many places that only have the id. */
export const PLAN: Readonly<Record<PlanId, Plan>> = byPlanId;

export const PLAN_IDS = PLANS.map((p) => p.id) as readonly PlanId[];
