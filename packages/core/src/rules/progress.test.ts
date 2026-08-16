import { describe, expect, it } from 'vitest';

import { PLAN_IDS } from '../data/plans';
import { TRICKS } from '../data/tricks';
import type { StageId, Trick, TrickLogEntry } from '../types';
import {
  MONTH_LABELS,
  insightsVisible,
  monthKeyLabel,
  monthKeysBack,
  planIncludesInsights,
  progressInsights,
  skillTree,
  stageBreakdown,
  trickDepth,
} from './progress';

const trick = (over: Partial<Trick> & Pick<Trick, 'id'>): Trick => ({
  name: over.id,
  sport: 'scooter',
  cat: 'flat',
  diff: 1,
  pre: [],
  about: '',
  tips: '',
  fact: '',
  isLive: true,
  ...over,
});

/** A tiny two-category library with a three-deep chain, so tiers are visible. */
const LIB: Trick[] = [
  trick({ id: 'a' }),
  trick({ id: 'b', pre: ['a'] }),
  trick({ id: 'c', pre: ['b'] }),
  trick({ id: 'hard', cat: 'street', diff: 5 }),
  trick({ id: 'easy-street', cat: 'street', diff: 2 }),
  trick({ id: 'hidden', cat: 'air', isLive: false }),
  trick({ id: 'skate-a', sport: 'skate' }),
];

const at = (iso: string): number => Date.parse(iso);

describe('month labels come from data, not ICU', () => {
  it('reads the month out of a YYYY-MM key', () => {
    expect(monthKeyLabel('2026-01')).toBe('Jan');
    expect(monthKeyLabel('2026-08')).toBe('Aug');
    expect(monthKeyLabel('2026-12')).toBe('Dec');
  });

  it('has twelve of them and never throws on a bad key', () => {
    expect(MONTH_LABELS).toHaveLength(12);
    expect(monthKeyLabel('')).toBe('');
    expect(monthKeyLabel('nonsense')).toBe('');
    expect(monthKeyLabel('2026-13')).toBe('');
  });

  it('walks months back in the rider order, oldest first', () => {
    const keys = monthKeysBack(at('2026-02-10T12:00:00Z'), 4, 'Europe/London');
    expect(keys).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('takes the month boundary from the rider timezone, not UTC', () => {
    // 02:00 UTC on 1 August is still 31 July in Los Angeles.
    const instant = at('2026-08-01T02:00:00Z');
    expect(monthKeysBack(instant, 1, 'Europe/London')).toEqual(['2026-08']);
    expect(monthKeysBack(instant, 1, 'America/Los_Angeles')).toEqual(['2026-07']);
  });
});

describe('by stage', () => {
  const byId: Record<string, StageId> = { a: 'every', b: 'trying', c: 'want' };

  it('counts each stage and what is left untouched', () => {
    const out = stageBreakdown(byId, 'scooter', LIB);
    expect(out.total).toBe(5); // hidden is out of scope, skate is another sport
    expect(out.tracked).toBe(3);
    expect(out.untouched).toBe(2);
    expect(out.counts.map((c) => [c.stage.id, c.n])).toEqual([
      ['want', 1],
      ['trying', 1],
      ['some', 0],
      ['most', 0],
      ['every', 1],
    ]);
  });

  it('leaves hidden tricks out of the total as well as out of the count', () => {
    const all = stageBreakdown(byId, null, LIB);
    expect(all.total).toBe(6);
    expect(all.counts.every((c) => c.n >= 0)).toBe(true);
  });

  it('counts nothing for a rider who has tracked nothing', () => {
    const out = stageBreakdown({}, 'scooter', LIB);
    expect(out.tracked).toBe(0);
    expect(out.untouched).toBe(out.total);
  });
});

describe('prerequisite depth', () => {
  it('is zero with no prerequisites and one past the deepest otherwise', () => {
    expect(trickDepth(LIB[0]!, LIB)).toBe(0);
    expect(trickDepth(LIB[1]!, LIB)).toBe(1);
    expect(trickDepth(LIB[2]!, LIB)).toBe(2);
  });

  it('treats an unknown prerequisite as depth zero', () => {
    expect(trickDepth(trick({ id: 'orphan', pre: ['nope'] }), LIB)).toBe(1);
  });

  it('terminates on a cycle rather than recursing forever', () => {
    // The seed data has no cycles and the same-sport hook makes one hard to
    // introduce; this is here so bad data is a wrong number, not a hung server.
    const cyclic = [trick({ id: 'x', pre: ['y'] }), trick({ id: 'y', pre: ['x'] })];
    expect(trickDepth(cyclic[0]!, cyclic)).toBe(2);
    expect(trickDepth(cyclic[1]!, cyclic)).toBe(2);
  });
});

describe('skill tree', () => {
  const byId: Record<string, StageId> = { a: 'some' };

  it('draws one branch per category that has tricks, and none for empty ones', () => {
    const tree = skillTree(byId, 'shredder', 'scooter', LIB);
    expect(tree.map((b) => b.cat)).toEqual(['flat', 'street']);
  });

  it('groups a chain into consecutive stages', () => {
    const flat = skillTree(byId, 'shredder', 'scooter', LIB).find((b) => b.cat === 'flat')!;
    expect(flat.tiers.map((t) => [t.stage, t.nodes.map((n) => n.trick.id)])).toEqual([
      [1, ['a']],
      [2, ['b']],
      [3, ['c']],
    ]);
  });

  it('marks landed, reachable and prerequisite-locked nodes apart', () => {
    const flat = skillTree(byId, 'shredder', 'scooter', LIB).find((b) => b.cat === 'flat')!;
    const state = (id: string) =>
      flat.tiers.flatMap((t) => t.nodes).find((n) => n.trick.id === id)!.state;
    expect(state('a')).toBe('done');
    expect(state('b')).toBe('open');
    expect(state('c')).toBe('lock');
  });

  it('reports which prerequisites are missing, and only on a locked node', () => {
    const flat = skillTree(byId, 'shredder', 'scooter', LIB).find((b) => b.cat === 'flat')!;
    const nodes = flat.tiers.flatMap((t) => t.nodes);
    expect(nodes.find((n) => n.trick.id === 'c')!.missing).toEqual(['b']);
    expect(nodes.find((n) => n.trick.id === 'b')!.missing).toEqual([]);
  });

  it('lets the paywall win over every other state', () => {
    const rookie = skillTree(byId, 'rookie', 'scooter', LIB).find((b) => b.cat === 'street')!;
    const state = (id: string) =>
      rookie.tiers.flatMap((t) => t.nodes).find((n) => n.trick.id === id)!.state;
    expect(state('hard')).toBe('paid');
    expect(state('easy-street')).toBe('open');

    // Landed *and* paid still draws as paid, which is the prototype's order.
    const landedHard = skillTree({ hard: 'every' }, 'rookie', 'scooter', LIB).find(
      (b) => b.cat === 'street',
    )!;
    expect(landedHard.tiers.flatMap((t) => t.nodes).find((n) => n.trick.id === 'hard')!.state).toBe(
      'paid',
    );
  });

  it('keeps hidden tricks out of the tree and out of the branch totals', () => {
    const tree = skillTree(byId, 'shredder', null, LIB);
    expect(tree.some((b) => b.cat === 'air')).toBe(false);
    expect(tree.find((b) => b.cat === 'flat')!.total).toBe(4); // a, b, c and skate-a
    expect(tree.find((b) => b.cat === 'flat')!.landed).toBe(1);
  });

  it('runs over the real library for every sport without an empty tier', () => {
    for (const sport of ['scooter', 'skate', 'bmx'] as const) {
      const tree = skillTree({}, 'legend', sport, TRICKS);
      expect(tree.length).toBeGreaterThan(0);
      for (const branch of tree) {
        expect(branch.total).toBeGreaterThan(0);
        for (const tier of branch.tiers) expect(tier.nodes.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('insights entitlement', () => {
  it('is a Legend perk, read from the plan record', () => {
    expect(planIncludesInsights('rookie')).toBe(false);
    expect(planIncludesInsights('shredder')).toBe(false);
    expect(planIncludesInsights('legend')).toBe(true);
  });

  it('needs the plan *and* the opt-in, on every plan', () => {
    for (const plan of PLAN_IDS) {
      expect(insightsVisible(plan, false)).toBe(false);
    }
    expect(insightsVisible('legend', true)).toBe(true);
    expect(insightsVisible('shredder', true)).toBe(false);
    expect(insightsVisible('rookie', true)).toBe(false);
  });
});

describe('progress insights', () => {
  const now = at('2026-08-15T12:00:00Z');
  const log: TrickLogEntry[] = [
    { trick: 'a', stage: 'some', at: at('2026-04-04T10:00:00Z') },
    { trick: 'a', stage: 'every', at: at('2026-05-04T10:00:00Z') },
    { trick: 'b', stage: 'some', at: at('2026-07-09T10:00:00Z') },
    { trick: 'easy-street', stage: 'most', at: at('2026-08-01T10:00:00Z') },
  ];
  const byId: Record<string, StageId> = { a: 'every', b: 'some', 'easy-street': 'most' };

  const insights = () =>
    progressInsights({ byId, log, plan: 'legend', sport: 'scooter', now, tricks: LIB });

  it('measures each category over the window and says which way it is going', () => {
    const flat = insights().trends.find((t) => t.cat === 'flat')!;
    // Window is Mar–Aug; recent half is Jun–Aug. `a` landed in April, `b` in July.
    expect(flat.landed).toBe(2);
    expect(flat.total).toBe(3);
    expect(flat.previous).toBe(1);
    expect(flat.recent).toBe(1);
    expect(flat.direction).toBe('level');

    const street = insights().trends.find((t) => t.cat === 'street')!;
    expect(street.recent).toBe(1);
    expect(street.previous).toBe(0);
    expect(street.direction).toBe('up');
  });

  it('uses the first landing, not the latest stage change', () => {
    // `a` reached `every` in May but first landed in April, so April is its month.
    const records = insights().records;
    expect(records.firstEver?.trick).toBe('a');
    expect(records.firstEver?.at).toBe(at('2026-04-04T10:00:00Z'));
    expect(records.latest?.trick).toBe('easy-street');
  });

  it('finds the best month and the longest run of months', () => {
    const records = insights().records;
    expect(records.bestMonth).toEqual({ key: '2026-04', label: 'Apr', n: 1 });
    expect(records.bestRunMonths).toBe(2); // July and August
  });

  it('names the hardest trick landed', () => {
    expect(insights().records.hardestLanded?.id).toBe('easy-street');
  });

  it('suggests unlanded, unlocked, unpaywalled tricks, most-unlocking first', () => {
    const next = insights().next;
    expect(next.map((n) => n.trick.id)).toEqual(['c', 'hard']);
    expect(next[0]!.unlocks).toBe(0);
  });

  it('never suggests a trick the rider cannot track on their plan', () => {
    const rookie = progressInsights({
      byId,
      log,
      plan: 'rookie',
      sport: 'scooter',
      now,
      tricks: LIB,
    });
    expect(rookie.next.map((n) => n.trick.id)).not.toContain('hard');
  });

  it('holds up for a rider who has landed nothing', () => {
    const empty = progressInsights({
      byId: {},
      log: [],
      plan: 'legend',
      sport: 'scooter',
      now,
      tricks: LIB,
    });
    expect(empty.records.bestMonth).toBeNull();
    expect(empty.records.firstEver).toBeNull();
    expect(empty.records.hardestLanded).toBeNull();
    expect(empty.records.bestRunMonths).toBe(0);
    expect(empty.trends.every((t) => t.landed === 0 && t.direction === 'level')).toBe(true);
    expect(empty.next.length).toBeGreaterThan(0);
  });

  it('reads only the rider it was handed — the window is the whole of its world', () => {
    const out = insights();
    expect(out.window).toEqual(['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08']);
  });
});
