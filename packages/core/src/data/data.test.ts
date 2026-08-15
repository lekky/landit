import { describe, expect, it } from 'vitest';

import { AVATARS, AVATAR_GROUPS } from './avatars';
import { CATEGORY_IDS, TIERS_LABEL } from './categories';
import { CHALLENGES } from './challenges';
import { EVENTS } from './events';
import { PLAN, PLANS } from './plans';
import { GOALS, LEVELS, PRIVACY, STANCES } from './profile';
import { SPORTS, SPORT_IDS } from './sports';
import { SPOTS } from './spots';
import { STAGES } from './stages';
import { STICKERS } from './stickers';
import { TRICKS, TRICK_PREREQS } from './tricks';
import { STICKER_RULES } from '../rules/stickers';
import { challengesOverlap } from '../rules/challenges';
import type { Plan, Sticker } from '../types';

/**
 * The canonical arrays are `as const`, so an optional field is absent from the
 * literal type of the records that do not carry one. Widening to the record
 * type is what lets a test ask whether an optional field is set.
 */
const allStickers: readonly Sticker[] = STICKERS;
const allPlans: readonly Plan[] = PLANS;

/**
 * The canonical data is the single source for both the database seeds (T4) and
 * every fixture the rules are tested against. If it drifts from the design pack
 * or from the plan, both of those go wrong quietly — so it is checked here
 * rather than trusted.
 */

const ids = <T extends { id: string }>(records: readonly T[]): string[] => records.map((r) => r.id);

describe('the trick library', () => {
  it('holds all 61 tricks, 30 scooter and 31 skate', () => {
    expect(TRICKS).toHaveLength(61);
    expect(TRICKS.filter((t) => t.sport === 'scooter')).toHaveLength(30);
    expect(TRICKS.filter((t) => t.sport === 'skate')).toHaveLength(31);
  });

  it('has unique ids', () => {
    expect(new Set(ids(TRICKS)).size).toBe(TRICKS.length);
  });

  it('only uses known sports, categories and difficulties', () => {
    for (const trick of TRICKS) {
      expect(SPORT_IDS).toContain(trick.sport);
      expect(CATEGORY_IDS).toContain(trick.cat);
      expect(trick.diff).toBeGreaterThanOrEqual(1);
      expect(trick.diff).toBeLessThanOrEqual(TIERS_LABEL.length);
    }
  });

  it('gives every trick the lowdown, tips and a fact', () => {
    for (const trick of TRICKS) {
      expect(trick.about.length).toBeGreaterThan(20);
      expect(trick.tips.length).toBeGreaterThan(20);
      expect(trick.fact.length).toBeGreaterThan(20);
    }
  });

  it('points every prerequisite at a trick that exists', () => {
    const known = new Set(ids(TRICKS));
    for (const trick of TRICKS) {
      for (const prereq of trick.pre) expect(known).toContain(prereq);
    }
  });

  it('never crosses sports in a prerequisite', () => {
    const sportOf = new Map(TRICKS.map((t) => [t.id, t.sport]));
    for (const trick of TRICKS) {
      for (const prereq of trick.pre) expect(sportOf.get(prereq)).toBe(trick.sport);
    }
  });

  it('has no cycles, so every trick is reachable from a no-prerequisite start', () => {
    const byId = new Map(TRICKS.map((t) => [t.id, t]));
    const resolved = new Set<string>();
    // Repeatedly admit tricks whose prerequisites are all already admitted. A
    // cycle leaves at least one trick that can never be admitted.
    let grew = true;
    while (grew) {
      grew = false;
      for (const trick of TRICKS) {
        if (resolved.has(trick.id)) continue;
        if (trick.pre.every((p) => resolved.has(p))) {
          resolved.add(trick.id);
          grew = true;
        }
      }
    }
    expect([...byId.keys()].filter((id) => !resolved.has(id))).toEqual([]);
  });

  it('exports the prerequisite graph as seedable edges', () => {
    const expected = TRICKS.reduce((n, t) => n + t.pre.length, 0);
    expect(TRICK_PREREQS).toHaveLength(expected);
    for (const edge of TRICK_PREREQS) {
      expect(edge.trick).not.toBe(edge.prereq);
    }
  });

  it('ships every trick live', () => {
    expect(TRICKS.every((t) => t.isLive)).toBe(true);
  });
});

describe('sports, categories and stages', () => {
  it('names both sports with their design colours', () => {
    expect(SPORT_IDS).toEqual(['scooter', 'skate']);
    expect(SPORTS.scooter.color).toBe('#FF5A1F');
    expect(SPORTS.skate.color).toBe('#246BFF');
  });

  it('has five categories and five named difficulty tiers', () => {
    expect(CATEGORY_IDS).toHaveLength(5);
    expect(TIERS_LABEL).toEqual(['Rookie', 'Easy', 'Spicy', 'Gnarly', 'Pro']);
  });

  it('has the five stages in order, want to every', () => {
    expect(ids(STAGES)).toEqual(['want', 'trying', 'some', 'most', 'every']);
    expect(STAGES.map((s) => s.pct)).toEqual([0, 25, 55, 80, 100]);
  });
});

describe('stickers', () => {
  it('holds all 24 stickers with unique ids', () => {
    expect(STICKERS).toHaveLength(24);
    expect(new Set(ids(STICKERS)).size).toBe(STICKERS.length);
  });

  it('gives every sticker a rule, so none can be permanently unearnable', () => {
    for (const sticker of STICKERS) {
      expect(Object.keys(STICKER_RULES)).toContain(sticker.id);
    }
  });

  it('has no rule without a sticker record behind it', () => {
    const known = new Set(ids(STICKERS));
    for (const id of Object.keys(STICKER_RULES)) expect(known).toContain(id);
  });

  it('scopes each sticker to a real sport, or to everything', () => {
    for (const sticker of STICKERS) {
      if (sticker.sport !== null) expect(SPORT_IDS).toContain(sticker.sport);
    }
    expect(STICKERS.filter((s) => s.sport === null).length).toBeGreaterThan(0);
  });

  it('keeps every threshold on the record, never in the rule', () => {
    // The rules read `n` off the sticker; a sticker that quotes a number in its
    // copy but has no `n` would be uneditable by staff.
    for (const sticker of allStickers) {
      if (sticker.n !== undefined) expect(sticker.n).toBeGreaterThan(0);
    }
  });
});

describe('plans (implementation plan §2.4)', () => {
  it('has exactly rookie, shredder and legend — the Crew Pass is gone', () => {
    expect(ids(PLANS)).toEqual(['rookie', 'shredder', 'legend']);
    expect(ids(PLANS)).not.toContain('crew');
  });

  it('prices Rookie free, Shredder £3.99/£39.99 and Legend £6.99/£69.99', () => {
    expect(PLAN.rookie.priceMonthlyPence).toBe(0);
    expect(PLAN.rookie.priceYearlyPence).toBe(0);
    expect(PLAN.shredder.priceMonthlyPence).toBe(399);
    expect(PLAN.shredder.priceYearlyPence).toBe(3999);
    expect(PLAN.legend.priceMonthlyPence).toBe(699);
    expect(PLAN.legend.priceYearlyPence).toBe(6999);
  });

  it('caps the clip vault at 2GB on Shredder and 5GB on Legend, with none on Rookie', () => {
    expect(PLAN.rookie.clipCapBytes).toBe(0);
    expect(PLAN.shredder.clipCapBytes).toBe(2 * 1024 ** 3);
    expect(PLAN.legend.clipCapBytes).toBe(5 * 1024 ** 3);
  });

  it('unlocks the paid tiers on both paid plans and neither on Rookie', () => {
    expect(PLAN.rookie.unlocksPaidTricks).toBe(false);
    expect(PLAN.shredder.unlocksPaidTricks).toBe(true);
    expect(PLAN.legend.unlocksPaidTricks).toBe(true);
  });

  it('raises Shredder as the "Most riders" card, and only Shredder', () => {
    expect(allPlans.filter((p) => p.popular)).toHaveLength(1);
    expect(PLAN.shredder.popular).toBe(true);
  });

  it('never sells an achievement', () => {
    // Plan §2.4: stickers and stages are earned-only on every plan. Paid tiers
    // sell capacity, cosmetics and insight — never a milestone.
    const forbidden = /\bsticker(s)?\b|\bstage(s)?\b|\bachievement/i;
    for (const plan of PLANS) {
      if (plan.id === 'rookie') continue; // The free plan may mention the wall.
      for (const perk of plan.perks) expect(perk).not.toMatch(forbidden);
    }
  });
});

describe('challenges', () => {
  it('holds twelve challenges, six per sport, with unique ids', () => {
    expect(CHALLENGES).toHaveLength(12);
    expect(CHALLENGES.filter((c) => c.sport === 'scooter')).toHaveLength(6);
    expect(CHALLENGES.filter((c) => c.sport === 'skate')).toHaveLength(6);
    expect(new Set(ids(CHALLENGES)).size).toBe(CHALLENGES.length);
  });

  it('runs each one over a sane, inclusive date range', () => {
    for (const challenge of CHALLENGES) {
      expect(challenge.starts).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(challenge.ends).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(challenge.starts <= challenge.ends).toBe(true);
      expect(challenge.goal).toBeGreaterThan(0);
    }
  });

  it('never schedules two overlapping weeks for the same sport', () => {
    // "One live challenge per sport" is a hook-enforced constraint (plan §3).
    // The seed data must not be the first thing to break it.
    for (const a of CHALLENGES) {
      for (const b of CHALLENGES) {
        expect(challengesOverlap(a, b)).toBe(false);
      }
    }
  });
});

describe('spots, events and profile options', () => {
  it('seeds seven live spots with usable coordinates', () => {
    expect(SPOTS).toHaveLength(7);
    for (const spot of SPOTS) {
      expect(spot.status).toBe('live');
      expect(Math.abs(spot.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(spot.lng)).toBeLessThanOrEqual(180);
      expect(spot.sports.length).toBeGreaterThan(0);
    }
  });

  it('seeds six events, each on a calendar day', () => {
    expect(EVENTS).toHaveLength(6);
    for (const event of EVENTS) expect(event.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('offers three stances, three privacy levels and four riding levels', () => {
    expect(ids(STANCES)).toEqual(['regular', 'goofy', 'switch']);
    expect(ids(PRIVACY)).toEqual(['public', 'members', 'private']);
    expect(LEVELS).toHaveLength(4);
  });

  it('offers goals for both sports plus shared ones', () => {
    expect(GOALS.filter((g) => g.sport === null).length).toBeGreaterThan(0);
    expect(GOALS.filter((g) => g.sport === 'scooter').length).toBeGreaterThan(0);
    expect(GOALS.filter((g) => g.sport === 'skate').length).toBeGreaterThan(0);
  });
});

describe('avatars', () => {
  it('registers all 36 built-in avatars across three groups', () => {
    expect(AVATARS).toHaveLength(36);
    expect(new Set(ids(AVATARS)).size).toBe(AVATARS.length);
    expect(AVATAR_GROUPS.map((g) => g.id)).toEqual(['Lids', 'Heads', 'Kit']);
  });

  it('puts every avatar in a registered group', () => {
    const groups = new Set(AVATAR_GROUPS.map((g) => g.id));
    for (const avatar of AVATARS) expect(groups).toContain(avatar.group);
  });

  it('stores a bare PNG filename, not a path', () => {
    // `packages/core` must not know where the assets resolve to (plan §2.2).
    for (const avatar of AVATARS) {
      expect(avatar.file).toMatch(/^[a-z0-9-]+\.png$/);
      expect(avatar.file).not.toContain('/');
    }
  });
});
