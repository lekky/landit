import {
  CATS,
  SPORTS,
  STAGES,
  TIERS_LABEL,
  categoryLabel,
  computeSportStats,
  insightsVisible,
  isTrickLocked,
  landedByMonth,
  latestLanded,
  monthKeyLabel,
  progressInsights,
  skillTree,
  stageBreakdown,
  trickById,
  tricksFor,
  type CategoryId,
  type PlanId,
  type SkillState,
  type SportId,
  type StageId,
  type Trick,
  type TrickLogEntry,
} from '@landit/core';

import { shortDate } from '@/lib/dates';

/**
 * The progress screen, shaped on the server.
 *
 * The sport switch is client state, so the screen has to be able to change
 * sports without another round trip — but shipping the whole trick library to
 * the browser to recompute a tree per switch is a lot of bytes for a rider on a
 * phone at a skatepark. So every sport the rider tracks is computed here, once,
 * and the client picks one. What crosses the boundary is a few hundred numbers
 * and names rather than 97 tricks and their copy.
 *
 * Everything locale-derived is resolved here too, into plain strings: month
 * names and dates come from `@landit/core`'s table and never from ICU, because
 * a label that renders on both sides of hydration is a mismatch waiting for the
 * one month Node and Chromium disagree about (LESSONS §3a).
 *
 * **The insights block is absent unless the rider may see it.** Not empty,
 * absent: if the plan does not carry the entitlement or the rider has not opted
 * in, no profiling is computed and nothing derived from it is sent. That is the
 * Children's code standard 12 position (plan §6.4) expressed as data flow
 * rather than as a hidden `<div>`.
 */

export interface MonthBarView {
  readonly key: string;
  readonly label: string;
  readonly n: number;
  readonly est: number;
}

export interface CategoryBarView {
  readonly cat: CategoryId;
  readonly label: string;
  readonly color: string;
  readonly count: number;
  readonly total: number;
}

export interface StageRowView {
  readonly id: StageId;
  readonly label: string;
  readonly color: string;
  readonly n: number;
}

export interface LatestLandView {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly date: string;
  readonly estimated: boolean;
}

export interface TreeNodeView {
  readonly id: string;
  readonly name: string;
  readonly diff: number;
  readonly state: SkillState;
}

export interface TreeTierView {
  readonly stage: number;
  readonly nodes: readonly TreeNodeView[];
}

export interface BranchView {
  readonly cat: CategoryId;
  readonly label: string;
  readonly color: string;
  readonly blurb: string;
  readonly landed: number;
  readonly total: number;
  readonly tiers: readonly TreeTierView[];
}

export interface TrendView {
  readonly cat: CategoryId;
  readonly label: string;
  readonly color: string;
  readonly landed: number;
  readonly total: number;
  readonly recent: number;
  readonly previous: number;
}

export interface RecordView {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
}

export interface NextTrickView {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly color: string;
  readonly diff: number;
  readonly why: string;
}

export interface InsightsView {
  readonly windowLabel: string;
  readonly trends: readonly TrendView[];
  readonly records: readonly RecordView[];
  readonly next: readonly NextTrickView[];
}

export interface SheetRowView {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly color: string;
  readonly stage: string;
}

export interface SportProgressView {
  readonly sport: SportId;
  readonly sportLabel: string;
  readonly sportShort: string;
  readonly sportColor: string;
  readonly landed: number;
  readonly total: number;
  readonly pct: number;
  readonly categories: readonly CategoryBarView[];
  readonly stages: readonly StageRowView[];
  readonly untouched: number;
  readonly months: readonly MonthBarView[];
  readonly landedInWindow: number;
  readonly estimatedInWindow: number;
  readonly latest: readonly LatestLandView[];
  readonly branches: readonly BranchView[];
  readonly lockedCount: number;
  readonly lockedTiers: string;
  readonly insights: InsightsView | null;
  readonly sheet: readonly SheetRowView[];
}

export interface ProgressViewInput {
  readonly byId: Readonly<Record<string, StageId>>;
  readonly log: readonly TrickLogEntry[];
  readonly tricks: readonly Trick[];
  readonly sports: readonly SportId[];
  readonly plan: PlanId;
  readonly optedIntoInsights: boolean;
  readonly timezone?: string;
  readonly now?: number;
}

const WINDOW_MONTHS = 6;

/** The tier names a rookie rider is missing: "Spicy, Gnarly and Pro". */
function lockedTierNames(locked: readonly Trick[]): string {
  const tiers = [...new Set(locked.map((t) => TIERS_LABEL[t.diff - 1]!))];
  if (!tiers.length) return '';
  if (tiers.length === 1) return tiers[0]!;
  return `${tiers.slice(0, -1).join(', ')} and ${tiers[tiers.length - 1]}`;
}

function buildInsights(input: ProgressViewInput, sport: SportId, now: number): InsightsView | null {
  if (!insightsVisible(input.plan, input.optedIntoInsights)) return null;

  const out = progressInsights({
    byId: input.byId,
    log: input.log,
    plan: input.plan,
    sport,
    timezone: input.timezone,
    now,
    months: WINDOW_MONTHS,
    suggestions: 4,
    tricks: input.tricks,
  });

  const half = WINDOW_MONTHS / 2;
  const first = out.window[out.window.length - half]!;
  const last = out.window[out.window.length - 1]!;

  const records: RecordView[] = [];
  if (out.records.bestMonth) {
    records.push({
      id: 'best-month',
      label: 'Busiest month',
      value: out.records.bestMonth.label,
      detail: `${out.records.bestMonth.n} landed`,
    });
  }
  if (out.records.hardestLanded) {
    records.push({
      id: 'hardest',
      label: 'Hardest you have landed',
      value: out.records.hardestLanded.name,
      detail: TIERS_LABEL[out.records.hardestLanded.diff - 1],
    });
  }
  if (out.records.firstEver) {
    const trick = trickById(out.records.firstEver.trick, input.tricks);
    records.push({
      id: 'first',
      label: 'Where it started',
      value: trick?.name ?? out.records.firstEver.trick,
      detail: shortDate(out.records.firstEver.at, input.timezone),
    });
  }
  if (out.records.bestRunMonths > 0) {
    records.push({
      id: 'run',
      label: 'Longest run of months with a land',
      value: `${out.records.bestRunMonths}`,
      detail: out.records.bestRunMonths === 1 ? 'month' : 'months',
    });
  }

  return {
    windowLabel: `${monthKeyLabel(first)}–${monthKeyLabel(last)} against the ${half} months before`,
    trends: out.trends.map((trend) => ({
      cat: trend.cat,
      label: categoryLabel(trend.cat, sport),
      color: CATS[trend.cat].color,
      landed: trend.landed,
      total: trend.total,
      recent: trend.recent,
      previous: trend.previous,
    })),
    records,
    next: out.next.map((suggestion) => ({
      id: suggestion.trick.id,
      name: suggestion.trick.name,
      label: categoryLabel(suggestion.trick.cat, sport),
      color: CATS[suggestion.trick.cat].color,
      diff: suggestion.trick.diff,
      why: suggestion.unlocks
        ? `Opens ${suggestion.unlocks} more ${suggestion.unlocks === 1 ? 'trick' : 'tricks'}`
        : 'Everything it needs is landed',
    })),
  };
}

/** One sport's worth of the progress screen. */
export function buildSportProgress(input: ProgressViewInput, sport: SportId): SportProgressView {
  const now = input.now ?? Date.now();
  const catalogue = { tricks: input.tricks };
  const stats = computeSportStats({ byId: input.byId, sports: input.sports }, sport, catalogue);
  const stages = stageBreakdown(input.byId, sport, input.tricks);
  const months = landedByMonth(input.log, now, WINDOW_MONTHS, {
    sport,
    timezone: input.timezone,
    tricks: input.tricks,
  });

  const pool = tricksFor(sport, input.tricks).filter((t) => t.isLive);
  const locked = pool.filter((t) => isTrickLocked(t, input.plan));

  const stageLabel = (id: StageId | undefined): string =>
    STAGES.find((s) => s.id === id)?.label ?? '';

  return {
    sport,
    sportLabel: SPORTS[sport].label,
    sportShort: SPORTS[sport].short,
    sportColor: SPORTS[sport].color,
    landed: stats.landed,
    total: stats.total,
    pct: stats.pct,
    categories: (Object.keys(CATS) as CategoryId[])
      .filter((cat) => stats.catTotal[cat] > 0)
      .map((cat) => ({
        cat,
        label: categoryLabel(cat, sport),
        color: CATS[cat].color,
        count: stats.catCount[cat],
        total: stats.catTotal[cat],
      })),
    stages: stages.counts.map((row) => ({
      id: row.stage.id,
      label: row.stage.label,
      color: row.stage.color,
      n: row.n,
    })),
    untouched: stages.untouched,
    months: months.map((month) => ({
      key: month.key,
      // From the key, not from `month.label`: that one comes out of ICU.
      label: monthKeyLabel(month.key),
      n: month.n,
      est: month.est,
    })),
    landedInWindow: months.reduce((n, m) => n + m.n, 0),
    estimatedInWindow: months.reduce((n, m) => n + m.est, 0),
    latest: latestLanded(input.log, 4, { sport, tricks: input.tricks }).map((entry) => {
      const trick = trickById(entry.trick, input.tricks);
      return {
        id: entry.trick,
        name: trick?.name ?? entry.trick,
        color: trick ? CATS[trick.cat].color : 'var(--ink-3)',
        date: shortDate(entry.at, input.timezone),
        estimated: entry.estimated === true,
      };
    }),
    branches: skillTree(input.byId, input.plan, sport, input.tricks).map((branch) => ({
      cat: branch.cat,
      label: categoryLabel(branch.cat, sport),
      color: CATS[branch.cat].color,
      blurb: CATS[branch.cat].blurb,
      landed: branch.landed,
      total: branch.total,
      tiers: branch.tiers.map((tier) => ({
        stage: tier.stage,
        nodes: tier.nodes.map((node) => ({
          id: node.trick.id,
          name: node.trick.name,
          diff: node.trick.diff,
          state: node.state,
        })),
      })),
    })),
    lockedCount: locked.length,
    lockedTiers: lockedTierNames(locked),
    insights: buildInsights(input, sport, now),
    // The sheet is the rider's own list, which is what the panel promises to
    // print — not the whole library.
    sheet: pool
      .filter((trick) => input.byId[trick.id])
      .map((trick) => ({
        id: trick.id,
        name: trick.name,
        label: categoryLabel(trick.cat, sport),
        color: CATS[trick.cat].color,
        stage: stageLabel(input.byId[trick.id]),
      })),
  };
}

/** Every sport the rider tracks, in `SPORT_IDS` order. */
export function buildProgressView(input: ProgressViewInput): SportProgressView[] {
  return input.sports.map((sport) => buildSportProgress(input, sport));
}
