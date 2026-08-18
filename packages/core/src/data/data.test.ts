import { describe, expect, it } from 'vitest';

import { AVATARS, AVATAR_GROUPS } from './avatars';
import { CATEGORY_IDS, CATS, TIERS_LABEL, categoryLabel } from './categories';
import { CHALLENGES } from './challenges';
import { EVENTS } from './events';
import { PLAN, PLANS } from './plans';
import { DEFAULT_PRIVACY, GOALS, LEVELS, PRIVACY, STANCES } from './profile';
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
  it('holds all 97 tricks: 30 scooter, 31 skate and 36 BMX', () => {
    expect(TRICKS).toHaveLength(97);
    expect(TRICKS.filter((t) => t.sport === 'scooter')).toHaveLength(30);
    expect(TRICKS.filter((t) => t.sport === 'skate')).toHaveLength(31);
    expect(TRICKS.filter((t) => t.sport === 'bmx')).toHaveLength(36);
  });

  it('gives every sport a library, so none is a tab with nothing behind it', () => {
    // The count above is a fact about today. This is the invariant: a sport in
    // `SPORT_IDS` with no tricks would render an empty library, and T21 is the
    // task that would have shipped one.
    for (const sport of SPORT_IDS) {
      expect(TRICKS.filter((t) => t.sport === sport).length, sport).toBeGreaterThan(0);
    }
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
  it('names the three launch sports with their design colours', () => {
    expect(SPORT_IDS).toEqual(['scooter', 'skate', 'bmx']);
    expect(SPORTS.scooter.color).toBe('#FF5A1F');
    expect(SPORTS.skate.color).toBe('#246BFF');
    // `--pink`, confirmed by the owner on 2026-08-16 (plan §7, T21).
    expect(SPORTS.bmx.color).toBe('#FF3D78');
  });

  it('shows BMX riders "Flatground", where the other two sports say "Flat"', () => {
    // The id is shared and stays shared — only the word on the chip moves.
    expect(categoryLabel('flat')).toBe('Flat');
    expect(categoryLabel('flat', 'scooter')).toBe('Flat');
    expect(categoryLabel('flat', 'skate')).toBe('Flat');
    expect(categoryLabel('flat', 'bmx')).toBe('Flatground');

    // Not "Flatland": that is a separate BMX discipline on a different bike,
    // and this category does not hold it. The label avoids the word on purpose,
    // so a well-meaning "correction" back to it should fail here.
    expect(categoryLabel('flat', 'bmx')).not.toBe('Flatland');

    // Every other category reads the same to everyone.
    for (const sport of SPORT_IDS) {
      for (const cat of CATEGORY_IDS.filter((c) => c !== 'flat')) {
        expect(categoryLabel(cat, sport), `${cat}/${sport}`).toBe(CATS[cat].label);
      }
    }
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
  it('holds all 25 stickers with unique ids', () => {
    // 24 transcribed from the design pack, plus `every-time` (T10, issue #81).
    // One of the 24 — `upside` — is retired rather than removed, so it is still
    // a record here; `stickersFor` keeps it off the wall.
    expect(STICKERS).toHaveLength(25);
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

  // `clipCapBytes` stopped being an entitlement on 2026-08-17 (plan §1, §6.6).
  // What is asserted now is not a vault size — it is that the three values stay
  // strictly ascending, because `listPlans` orders every plan-card surface by
  // this column and equal values would make the card order arbitrary. If a rank
  // column ever replaces it, delete this test with the field.
  it('keeps the dormant clipCapBytes values ascending, which is what orders the plan cards', () => {
    expect(PLAN.rookie.clipCapBytes).toBeLessThan(PLAN.shredder.clipCapBytes);
    expect(PLAN.shredder.clipCapBytes).toBeLessThan(PLAN.legend.clipCapBytes);
  });

  it('advertises no clip vault on any plan, and no video at all', () => {
    for (const plan of allPlans) {
      for (const line of [...plan.perks, ...plan.missing, plan.pitch]) {
        expect(line).not.toMatch(/vault|clip|\bGB\b/i);
      }
    }
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
  // Counted off `SPORT_IDS`, not a literal pair: the two-sport version of this
  // was green for as long as BMX had no challenges at all (issue #80).
  it('holds six challenges for every sport, with unique ids', () => {
    for (const sport of SPORT_IDS) {
      expect(
        CHALLENGES.filter((c) => c.sport === sport),
        sport,
      ).toHaveLength(6);
    }
    expect(CHALLENGES).toHaveLength(SPORT_IDS.length * 6);
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

  it('seeds a worldwide calendar, each event on a calendar day with a unique id', () => {
    // Not a fixed count. This list is researched and goes stale by existing, so
    // pinning it to a number would mean a failing test every time a staff member
    // adds a comp. What must hold is that it is not empty, that ids are unique
    // (they are the seed's natural key — a duplicate silently overwrites an
    // event) and that every date is a day the rules can compare.
    expect(EVENTS.length).toBeGreaterThan(0);
    expect(new Set(EVENTS.map((event) => event.id)).size).toBe(EVENTS.length);
    for (const event of EVENTS) {
      expect(event.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(event.id.length).toBeLessThanOrEqual(40);
      expect(event.sports.length).toBeGreaterThan(0);
    }
  });

  it('offers three stances, three privacy levels and four riding levels', () => {
    expect(ids(STANCES)).toEqual(['regular', 'goofy', 'switch']);
    expect(ids(PRIVACY)).toEqual(['public', 'members', 'private']);
    expect(LEVELS).toHaveLength(4);
  });

  it('starts a new account private (Children’s code standard 7, plan §6.4)', () => {
    // Not "anything but public": `members` opens a child's profile to every
    // signed-in stranger, and the privacy policy T5 shipped says in writing
    // that new accounts start private. Owner-authorised change from `members`
    // (Rachid, 2026-08-16) — changing it back is a decision, not a tidy-up.
    expect(DEFAULT_PRIVACY).toBe('private');
  });

  it('never advertises a privacy setting as the default in its own copy', () => {
    // LESSONS §4: the `members` blurb called itself the sensible default and
    // silently became wrong when the default moved. The copy describes what a
    // setting does; `DEFAULT_PRIVACY` is the only place that says which is default.
    for (const level of PRIVACY) {
      expect(level.blurb).not.toMatch(/default/i);
      expect(level.other).not.toMatch(/default/i);
    }
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
