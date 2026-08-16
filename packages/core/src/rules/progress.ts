import { CATEGORY_IDS } from '../data/categories';
import { PLAN } from '../data/plans';
import { STAGES } from '../data/stages';
import { TRICKS } from '../data/tricks';
import type {
  CategoryId,
  Instant,
  PlanId,
  SportId,
  Stage,
  StageId,
  Trick,
  TrickLogEntry,
} from '../types';
import { firstLanded } from './log';
import { DEFAULT_TIMEZONE, toDayKey } from './time';
import { isTrickLanded, isTrickLocked, isTrickUnlocked, missingPrereqs, tricksFor } from './tricks';

/**
 * Everything the progress screen and the skill tree are made of, as pure
 * functions (plan §2.2 — every game rule lives here, and hooks and UI both call
 * it).
 *
 * Two things in this file are load-bearing beyond the arithmetic:
 *
 * - **Month labels never come from ICU.** `landedByMonth` names its months with
 *   `toLocaleDateString`, which is fine on a server that only ever prints them,
 *   but a label rendered on both sides of a hydration boundary is a mismatch
 *   waiting for the one month Node and Chromium disagree about — and a React
 *   hydration mismatch does not warn, it throws the tree away (LESSONS §3a).
 *   `monthKeyLabel` reads the month out of the key instead.
 * - **The insights functions take the rider's own history and nothing else.**
 *   The Legend insights panel is profiling under the Children's code
 *   (plan §6.4, standard 12): off by default, opt-in, and never fed by anyone
 *   else's data. `ProgressInsightsInput` has no field that could carry another
 *   rider's rows, which is the cheapest way to keep that true.
 */

/* ------------------------------------------------------------------ months */

/**
 * Short month names by index, as data.
 *
 * The whole product is English-only and these are the twelve strings ICU would
 * have produced for `en-GB`. Taking them from a table rather than from the
 * runtime is what makes a month label safe to render on the server and the
 * client (LESSONS §3a).
 */
export const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** The short month name for a `YYYY-MM` key, or `''` when the key is malformed. */
export function monthKeyLabel(key: string): string {
  const month = Number(String(key).slice(5, 7));
  return MONTH_LABELS[month - 1] ?? '';
}

/**
 * The last `count` month keys, oldest first, in the rider's timezone.
 *
 * The boundary between one month and the next is midnight where the rider is,
 * not midnight UTC — same rule `landedByMonth` follows.
 */
export function monthKeysBack(
  now: Instant = Date.now(),
  count = 6,
  timezone: string = DEFAULT_TIMEZONE,
): string[] {
  const today = toDayKey(now, timezone);
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;

  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(year, month - i, 1));
    keys.push(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

/* -------------------------------------------------------------- by stage */

export interface StageCount {
  readonly stage: Stage;
  readonly n: number;
}

/** The "by stage" panel: one count per stage, plus everything untouched. */
export interface StageBreakdown {
  readonly counts: readonly StageCount[];
  /** Live tricks in scope the rider has never given a stage. */
  readonly untouched: number;
  readonly total: number;
  readonly tracked: number;
}

/**
 * How many tricks sit at each stage, for one sport or for all of them.
 *
 * Hidden tricks (`isLive: false`) are out of scope in both directions, exactly
 * as `computeSportStats` treats them — so pulling a trick from the library never
 * leaves a rider at 61 of 60.
 */
export function stageBreakdown(
  byId: Readonly<Record<string, StageId>>,
  sport?: SportId | null,
  tricks: readonly Trick[] = TRICKS,
): StageBreakdown {
  const pool = tricksFor(sport, tricks).filter((t) => t.isLive);
  const inScope = new Set(pool.map((t) => t.id));

  const tracked = Object.keys(byId).filter((id) => inScope.has(id));
  const counts = STAGES.map((stage) => ({
    stage: stage as Stage,
    n: tracked.filter((id) => byId[id] === stage.id).length,
  }));

  return {
    counts,
    untouched: pool.length - tracked.length,
    total: pool.length,
    tracked: tracked.length,
  };
}

/* ------------------------------------------------------------- skill tree */

/**
 * How a node draws (the design system's `SkillNodeState`, and the prototype's
 * four classes):
 *
 * - `done` — landed
 * - `paid` — behind the paywall
 * - `lock` — prerequisites still missing
 * - `open` — reachable now
 *
 * The order matters and is the prototype's: the paywall wins over everything,
 * because it is the only one of the four that is a *refusal*. `lock` is a
 * display state, not a refusal — plan §3 is explicit that a rider may track a
 * trick whose prerequisites they have not landed.
 */
export type SkillState = 'open' | 'done' | 'lock' | 'paid';

export interface SkillTreeNode {
  readonly trick: Trick;
  readonly state: SkillState;
  /** Prerequisite trick ids still unlanded. Empty unless `state` is `lock`. */
  readonly missing: readonly string[];
}

export interface SkillTreeTier {
  /** 1-based, as the screen labels it: "Stage 1", "Stage 2". */
  readonly stage: number;
  readonly nodes: readonly SkillTreeNode[];
}

export interface SkillTreeBranch {
  readonly cat: CategoryId;
  readonly landed: number;
  readonly total: number;
  readonly tiers: readonly SkillTreeTier[];
}

/**
 * How deep a trick sits in its prerequisite graph: 0 with no prerequisites,
 * otherwise one past the deepest of them.
 *
 * A prerequisite that is not in the list counts as depth 0 — the same fallback
 * the prototype takes, and the one that matters when a hook passes live rows
 * with a trick hidden. A cycle also resolves to 0 rather than recursing
 * forever: the seed data has none and the same-sport hook makes one hard to
 * introduce, but "the server hangs" is not an acceptable answer to bad data.
 */
export function trickDepth(
  trick: Trick,
  tricks: readonly Trick[] = TRICKS,
  seen: ReadonlySet<string> = new Set(),
): number {
  if (!trick.pre.length || seen.has(trick.id)) return 0;
  const next = new Set(seen).add(trick.id);
  let deepest = -1;
  for (const id of trick.pre) {
    const prereq = tricks.find((t) => t.id === id);
    const depth = prereq ? trickDepth(prereq, tricks, next) : 0;
    if (depth > deepest) deepest = depth;
  }
  return deepest + 1;
}

/**
 * The skill tree: one branch per category that has tricks, each branch a set of
 * dependency stages, each stage a set of nodes with their draw state.
 *
 * Categories with no tricks in scope are dropped rather than rendered empty —
 * a sport with no Air library should not show an Air branch with nothing in it.
 */
export function skillTree(
  byId: Readonly<Record<string, StageId>>,
  plan: PlanId,
  sport?: SportId | null,
  tricks: readonly Trick[] = TRICKS,
): SkillTreeBranch[] {
  const pool = tricksFor(sport, tricks).filter((t) => t.isLive);
  const branches: SkillTreeBranch[] = [];

  for (const cat of CATEGORY_IDS) {
    const inCat = pool.filter((t) => t.cat === cat);
    if (!inCat.length) continue;

    const byDepth = new Map<number, SkillTreeNode[]>();
    for (const trick of inCat) {
      const missing = missingPrereqs(trick, byId);
      const state: SkillState = isTrickLocked(trick, plan)
        ? 'paid'
        : isTrickLanded(byId, trick.id)
          ? 'done'
          : isTrickUnlocked(trick, byId)
            ? 'open'
            : 'lock';

      const depth = trickDepth(trick, tricks);
      const nodes = byDepth.get(depth) ?? [];
      nodes.push({ trick, state, missing: state === 'lock' ? missing : [] });
      byDepth.set(depth, nodes);
    }

    const tiers = [...byDepth.keys()]
      .sort((a, b) => a - b)
      .map((depth, index) => ({ stage: index + 1, nodes: byDepth.get(depth)! }));

    branches.push({
      cat,
      total: inCat.length,
      landed: inCat.filter((t) => isTrickLanded(byId, t.id)).length,
      tiers,
    });
  }

  return branches;
}

/* --------------------------------------------------------------- insights */

/** Does this plan include the progress insights panel (plan §2.4)? */
export function planIncludesInsights(plan: PlanId): boolean {
  return PLAN[plan].includesInsights;
}

/**
 * Whether the insights panel may be shown at all: the plan includes it **and**
 * the rider has switched it on.
 *
 * Both halves, always. Profiling is opt-in even where it is paid for
 * (plan §6.4, standard 12), so an entitled rider who has never opted in sees
 * the invitation, not the panel. The plan half is resolved from our own
 * records server-side — never from a client's claim about itself (plan §2.4,
 * and §3 guarantee 3 for why that direction is the only safe one).
 */
export function insightsVisible(plan: PlanId, optedIn: boolean): boolean {
  return planIncludesInsights(plan) && optedIn === true;
}

export interface CategoryTrend {
  readonly cat: CategoryId;
  readonly landed: number;
  readonly total: number;
  /** Landings in the most recent half of the window. */
  readonly recent: number;
  /** Landings in the half before it. */
  readonly previous: number;
  readonly direction: 'up' | 'level' | 'down';
}

export interface PersonalRecords {
  /** The month with the most first-landings in the window, or null for none. */
  readonly bestMonth: { readonly key: string; readonly label: string; readonly n: number } | null;
  /** The highest-difficulty trick landed. Ties go to the one landed first. */
  readonly hardestLanded: Trick | null;
  /** The first trick ever landed, and the most recent. */
  readonly firstEver: TrickLogEntry | null;
  readonly latest: TrickLogEntry | null;
  /** The longest run of consecutive months in the window with a landing in each. */
  readonly bestRunMonths: number;
}

export interface NextTrickSuggestion {
  readonly trick: Trick;
  /** How many other tricks in scope list this one as a prerequisite. */
  readonly unlocks: number;
}

/**
 * The rider's own history, and nothing else.
 *
 * There is deliberately no field here for another rider, a crew, or a
 * population average. Insights are profiling, and the standard they are built
 * against says they never leave the rider's own data (plan §6.4). A signature
 * that cannot express the other thing is worth more than a comment asking
 * nobody to do it.
 */
export interface ProgressInsightsInput {
  readonly byId: Readonly<Record<string, StageId>>;
  readonly log: readonly TrickLogEntry[];
  readonly plan: PlanId;
  readonly sport?: SportId | null;
  readonly timezone?: string;
  readonly now?: Instant;
  /** Window length in months. Halved to compare recent against previous. */
  readonly months?: number;
  readonly suggestions?: number;
  readonly tricks?: readonly Trick[];
}

export interface ProgressInsights {
  readonly trends: readonly CategoryTrend[];
  readonly records: PersonalRecords;
  readonly next: readonly NextTrickSuggestion[];
  /** The window the trends were measured over, oldest month first. */
  readonly window: readonly string[];
}

/**
 * Per-category trends, personal records and next-trick suggestions — the three
 * things §2.4 sells as Legend's insights.
 *
 * Everything is derived from first-landings, so it moves the way the rest of the
 * product does: deleting a log row takes the landing back out (plan §3).
 */
export function progressInsights(input: ProgressInsightsInput): ProgressInsights {
  const tricks = input.tricks ?? TRICKS;
  const timezone = input.timezone || DEFAULT_TIMEZONE;
  const now = input.now ?? Date.now();
  const months = Math.max(2, input.months ?? 6);
  const window = monthKeysBack(now, months, timezone);
  const half = Math.floor(months / 2);
  const recentKeys = new Set(window.slice(window.length - half));
  const previousKeys = new Set(window.slice(0, window.length - half));

  const pool = tricksFor(input.sport, tricks).filter((t) => t.isLive);
  const inScope = new Map(pool.map((t) => [t.id, t]));

  const landings = Object.values(firstLanded(input.log))
    .filter((entry) => inScope.has(entry.trick))
    .sort((a, b) => a.at - b.at);

  const monthOf = new Map<string, string>();
  for (const entry of landings) monthOf.set(entry.trick, toDayKey(entry.at, timezone).slice(0, 7));

  /* trends */
  const trends: CategoryTrend[] = [];
  for (const cat of CATEGORY_IDS) {
    const inCat = pool.filter((t) => t.cat === cat);
    if (!inCat.length) continue;
    const landedInCat = inCat.filter((t) => isTrickLanded(input.byId, t.id));
    const recent = landedInCat.filter((t) => recentKeys.has(monthOf.get(t.id) ?? '')).length;
    const previous = landedInCat.filter((t) => previousKeys.has(monthOf.get(t.id) ?? '')).length;
    trends.push({
      cat,
      landed: landedInCat.length,
      total: inCat.length,
      recent,
      previous,
      direction: recent > previous ? 'up' : recent < previous ? 'down' : 'level',
    });
  }

  /* records */
  const perMonth = new Map<string, number>();
  for (const key of window) perMonth.set(key, 0);
  for (const [, key] of monthOf) {
    if (perMonth.has(key)) perMonth.set(key, perMonth.get(key)! + 1);
  }

  let bestMonth: PersonalRecords['bestMonth'] = null;
  for (const key of window) {
    const n = perMonth.get(key) ?? 0;
    if (n > 0 && (!bestMonth || n > bestMonth.n)) {
      bestMonth = { key, label: monthKeyLabel(key), n };
    }
  }

  let bestRunMonths = 0;
  let run = 0;
  for (const key of window) {
    run = (perMonth.get(key) ?? 0) > 0 ? run + 1 : 0;
    if (run > bestRunMonths) bestRunMonths = run;
  }

  let hardestLanded: Trick | null = null;
  for (const entry of landings) {
    const trick = inScope.get(entry.trick);
    if (!trick || !isTrickLanded(input.byId, trick.id)) continue;
    if (!hardestLanded || trick.diff > hardestLanded.diff) hardestLanded = trick;
  }

  /* suggestions, ranked out of the skill tree */
  const unlockCount = new Map<string, number>();
  for (const trick of pool) {
    for (const id of trick.pre) unlockCount.set(id, (unlockCount.get(id) ?? 0) + 1);
  }

  const next = pool
    .filter(
      (t) =>
        !isTrickLanded(input.byId, t.id) &&
        isTrickUnlocked(t, input.byId) &&
        !isTrickLocked(t, input.plan),
    )
    .map((trick) => ({ trick, unlocks: unlockCount.get(trick.id) ?? 0 }))
    // Plain string comparison, never `localeCompare`: collation is locale-derived
    // and therefore a hydration risk anywhere a list renders on both sides
    // (LESSONS §3a). Trick names are ASCII, so code-point order is alphabetical.
    .sort(
      (a, b) =>
        b.unlocks - a.unlocks ||
        a.trick.diff - b.trick.diff ||
        (a.trick.name < b.trick.name ? -1 : a.trick.name > b.trick.name ? 1 : 0),
    )
    .slice(0, Math.max(0, input.suggestions ?? 4));

  return {
    trends,
    records: {
      bestMonth,
      hardestLanded,
      firstEver: landings[0] ?? null,
      latest: landings.length ? landings[landings.length - 1]! : null,
      bestRunMonths,
    },
    next,
    window,
  };
}
