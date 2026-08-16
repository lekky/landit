import { describe, expect, it } from 'vitest';

import { STICKERS } from '../data/stickers';
import { TRICKS } from '../data/tricks';
import type { RiderSnapshot, SportId, StageId, Sticker } from '../types';
import { computeStats } from './stats';
import { isTrickFree, tricksInCategory } from './tricks';
import {
  earnedStickerIds,
  evaluateSticker,
  newlyEarnedStickerIds,
  stickerCondition,
  stickerScope,
  stickersFor,
} from './stickers';

const byId = (entries: Record<string, StageId>): Record<string, StageId> => entries;

const statsFor = (over: Partial<RiderSnapshot> = {}) =>
  computeStats({ byId: {}, sports: ['scooter', 'skate'], ...over });

const sticker = (id: string): Sticker => {
  const found = STICKERS.find((s) => s.id === id);
  if (!found) throw new Error(`No sticker ${id}`);
  return found;
};

describe('which stickers are on the wall', () => {
  it('always shows the shared ones', () => {
    const shown = stickersFor(['scooter']).map((s) => s.id);
    expect(shown).toContain('first-land');
    expect(shown).toContain('both-feet');
  });

  it('hides sport stickers for a sport the rider does not ride', () => {
    const scooterOnly = stickersFor(['scooter']).map((s) => s.id);
    expect(scooterOnly).toContain('hop-master');
    expect(scooterOnly).not.toContain('ollie-up');

    const both = stickersFor(['scooter', 'skate']).map((s) => s.id);
    expect(both).toContain('ollie-up');
  });

  it('hides a sticker staff have taken off the wall', () => {
    const hidden: Sticker[] = [{ ...sticker('first-land'), isLive: false }];
    expect(stickersFor(['scooter'], hidden)).toEqual([]);
  });
});

describe('sticker scoping', () => {
  it('judges a sport sticker against that sport alone', () => {
    const stats = statsFor({ byId: byId({ 'bunny-hop': 'every' }) });
    expect(stickerScope(stats, sticker('hop-master')).sport).toBe('scooter');
    expect(stickerScope(stats, sticker('ollie-up')).sport).toBe('skate');
  });

  it('judges a shared sticker against the combined stats', () => {
    const stats = statsFor({ byId: byId({ 'bunny-hop': 'every' }) });
    expect(stickerScope(stats, sticker('first-land')).sport).toBeNull();
  });

  it('does not award a scooter sticker for skate riding', () => {
    // All ten skate Flat tricks landed, and Flat Out is still locked because it
    // is a scooter sticker. (`flat-track`'s threshold is ten for the same
    // reason — see issue #78.)
    const skateFlat = [
      'sk-ollie',
      'sk-manual',
      'sk-shuvit',
      'sk-fakie-ollie',
      'sk-pop-shuvit',
      'sk-180',
      'sk-nollie',
      'sk-kickflip',
      'sk-heelflip',
      'sk-nose-manual',
    ];
    const stats = statsFor({
      byId: Object.fromEntries(skateFlat.map((id) => [id, 'some' as StageId])),
    });
    expect(evaluateSticker(stats, sticker('flat-track'))).toBe(true); // skate
    expect(evaluateSticker(stats, sticker('flat-out'))).toBe(false); // scooter
  });

  it('counts a shared milestone across both sports', () => {
    const stats = statsFor({
      byId: byId({ 'bunny-hop': 'some', 'tic-tac': 'some', 'sk-ollie': 'some' }),
    });
    // Five Deep needs five landed anywhere; three is not five.
    expect(evaluateSticker(stats, sticker('five-deep'))).toBe(false);
    expect(evaluateSticker(stats, sticker('first-land'))).toBe(true);
  });
});

describe('thresholds come off the record, not the code', () => {
  const fiveLanded = statsFor({
    byId: byId({
      'bunny-hop': 'some',
      'tic-tac': 'some',
      'x-up': 'some',
      manual: 'some',
      fingerwhip: 'some',
    }),
  });

  it('earns Five Deep at the shipped threshold of five', () => {
    expect(sticker('five-deep').n).toBe(5);
    expect(evaluateSticker(fiveLanded, sticker('five-deep'))).toBe(true);
    expect(evaluateSticker(fiveLanded, sticker('ten-deep'))).toBe(false);
  });

  it('moves with the threshold when staff retune it', () => {
    const easier: Sticker = { ...sticker('ten-deep'), n: 3 };
    expect(evaluateSticker(fiveLanded, easier)).toBe(true);

    const harder: Sticker = { ...sticker('five-deep'), n: 50 };
    expect(evaluateSticker(fiveLanded, harder)).toBe(false);
  });

  it('stays locked when the threshold has been cleared, rather than firing', () => {
    // Failing closed matters: a sticker is the one thing that must be earned.
    const broken: Sticker = { ...sticker('five-deep'), n: undefined };
    expect(evaluateSticker(fiveLanded, broken)).toBe(false);
  });

  it('reads the threshold into the condition copy', () => {
    expect(stickerCondition(sticker('five-deep'))).toBe('5 tricks landed');
    expect(stickerCondition(sticker('first-land'))).toBe('Log your first trick');
    expect(stickerCondition({ ...sticker('five-deep'), n: 12 })).toBe('12 tricks landed');
  });
});

describe('the shipped rules', () => {
  it('First Land needs one landed trick, not one tracked trick', () => {
    expect(
      evaluateSticker(statsFor({ byId: byId({ 'bunny-hop': 'want' }) }), sticker('first-land')),
    ).toBe(false);
    expect(
      evaluateSticker(statsFor({ byId: byId({ 'bunny-hop': 'trying' }) }), sticker('first-land')),
    ).toBe(false);
    expect(
      evaluateSticker(statsFor({ byId: byId({ 'bunny-hop': 'some' }) }), sticker('first-land')),
    ).toBe(true);
  });

  it('Hop Master needs the Bunny Hop at every time, nothing less', () => {
    expect(
      evaluateSticker(statsFor({ byId: byId({ 'bunny-hop': 'most' }) }), sticker('hop-master')),
    ).toBe(false);
    expect(
      evaluateSticker(statsFor({ byId: byId({ 'bunny-hop': 'every' }) }), sticker('hop-master')),
    ).toBe(true);
  });

  it('Ollie Up is the same rule on the skate side', () => {
    expect(
      evaluateSticker(statsFor({ byId: byId({ 'sk-ollie': 'most' }) }), sticker('ollie-up')),
    ).toBe(false);
    expect(
      evaluateSticker(statsFor({ byId: byId({ 'sk-ollie': 'every' }) }), sticker('ollie-up')),
    ).toBe(true);
  });

  it('Grind Time accepts any one of the scooter grinds', () => {
    for (const id of ['50-50', 'feeble', 'smith', 'icepick']) {
      expect(
        evaluateSticker(statsFor({ byId: byId({ [id]: 'some' }) }), sticker('grind-time')),
      ).toBe(true);
    }
    expect(
      evaluateSticker(statsFor({ byId: byId({ 'bunny-hop': 'every' }) }), sticker('grind-time')),
    ).toBe(false);
  });

  it('Gnarly needs a landed difficulty-5 trick, at a threshold staff can move', () => {
    expect(
      evaluateSticker(statsFor({ byId: byId({ backflip: 'trying' }) }), sticker('gnarly')),
    ).toBe(false);
    expect(evaluateSticker(statsFor({ byId: byId({ backflip: 'some' }) }), sticker('gnarly'))).toBe(
      true,
    );
    // Issue #81: it was a literal `>= 1`, the only threshold sticker staff
    // could not retune. One is still the shipped bar.
    expect(sticker('gnarly').n).toBe(1);
    expect(
      evaluateSticker(statsFor({ byId: byId({ backflip: 'some' }) }), {
        ...sticker('gnarly'),
        n: 2,
      }),
    ).toBe(false);
  });

  it('Every Time counts tricks landed at the every stage, and nothing less', () => {
    // Issue #81: `SportStats.mastered` was computed and read by nothing.
    const three = byId({ 'bunny-hop': 'every', 'tic-tac': 'every', 'x-up': 'every' });
    expect(evaluateSticker(statsFor({ byId: three }), sticker('every-time'))).toBe(true);
    expect(
      evaluateSticker(
        statsFor({ byId: byId({ 'bunny-hop': 'every', 'tic-tac': 'every', 'x-up': 'most' }) }),
        sticker('every-time'),
      ),
    ).toBe(false);
  });

  it('Crossover needs something landed on two sports', () => {
    expect(
      evaluateSticker(statsFor({ byId: byId({ 'bunny-hop': 'every' }) }), sticker('both-feet')),
    ).toBe(false);
    expect(
      evaluateSticker(
        statsFor({ byId: byId({ 'bunny-hop': 'every', 'sk-ollie': 'some' }) }),
        sticker('both-feet'),
      ),
    ).toBe(true);
  });

  it('the streak stickers count weeks, not days (issue #10)', () => {
    // `RiderSnapshot.streak` counts qualifying *weeks* (plan §1). These two
    // records tested it against 7 and 30 under the names "7 Day Streak" and
    // "30 Day Streak", so the day the rule changed they silently became a
    // seven-week and a thirty-week sticker — LESSONS §4.
    expect(evaluateSticker(statsFor({ streak: 3 }), sticker('week-one'))).toBe(false);
    expect(evaluateSticker(statsFor({ streak: 4 }), sticker('week-one'))).toBe(true);
    expect(evaluateSticker(statsFor({ streak: 11 }), sticker('month-on'))).toBe(false);
    expect(evaluateSticker(statsFor({ streak: 12 }), sticker('month-on'))).toBe(true);
  });

  it('no streak sticker name states a unit the rule can change under it', () => {
    for (const id of ['week-one', 'month-on']) {
      const name = sticker(id).name;
      expect(name, id).not.toMatch(/day|week|month|\d/i);
      expect(stickerCondition(sticker(id)), id).toContain('weeks in a row');
    }
  });

  it('Caught On Cam, Challenger and Crew Up read their own counters', () => {
    expect(evaluateSticker(statsFor({ clips: 1 }), sticker('first-clip'))).toBe(true);
    expect(evaluateSticker(statsFor({ clips: 0 }), sticker('first-clip'))).toBe(false);
    expect(evaluateSticker(statsFor({ crew: true }), sticker('crew-up'))).toBe(true);
    expect(evaluateSticker(statsFor({ crew: false }), sticker('crew-up'))).toBe(false);
  });

  it('the category-count stickers use their own sport’s categories', () => {
    const streetScooter = statsFor({
      byId: byId({ '180': 'some', '50-50': 'some', gap: 'some' }),
    });
    expect(sticker('street-cred').n).toBe(3);
    expect(evaluateSticker(streetScooter, sticker('street-cred'))).toBe(true);
    // Ledge Rat is the skate equivalent and must not fire on scooter riding.
    expect(evaluateSticker(streetScooter, sticker('ledge-rat'))).toBe(false);
  });
});

describe('earning and announcing', () => {
  it('lists nothing for a rider who has done nothing', () => {
    expect(earnedStickerIds(statsFor())).toEqual([]);
  });

  it('lists every sticker currently satisfied, in canonical order', () => {
    const earned = earnedStickerIds(
      statsFor({ byId: byId({ 'bunny-hop': 'every', 'sk-ollie': 'every' }), crew: true }),
    );
    expect(earned).toContain('first-land');
    expect(earned).toContain('both-feet');
    expect(earned).toContain('crew-up');
    expect(earned).toContain('hop-master');
    expect(earned).toContain('ollie-up');
    // Canonical order, so the wall never reshuffles itself.
    const order: string[] = STICKERS.map((s) => s.id);
    expect(earned).toEqual([...earned].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
  });

  it('leaves out a sport sticker for a sport the rider dropped', () => {
    const stats = computeStats({ byId: byId({ 'sk-ollie': 'every' }), sports: ['scooter'] });
    expect(earnedStickerIds(stats)).not.toContain('ollie-up');
  });

  it('announces only what is new, so a sticker is never re-announced', () => {
    const stats = statsFor({ byId: byId({ 'bunny-hop': 'every' }) });
    const all = earnedStickerIds(stats);
    expect(newlyEarnedStickerIds(stats, [])).toEqual(all);
    expect(newlyEarnedStickerIds(stats, all)).toEqual([]);
    expect(newlyEarnedStickerIds(stats, ['first-land'])).not.toContain('first-land');
  });

  it('never earns a sticker that has no rule behind it', () => {
    const invented: Sticker = {
      id: 'staff-invented',
      name: 'Invented',
      sport: null,
      hue: '#000',
      ico: 'star',
      cond: 'exists',
      isLive: true,
    };
    const stats = statsFor({ byId: byId({ 'bunny-hop': 'every' }) });
    expect(evaluateSticker(stats, invented)).toBe(false);
    expect(earnedStickerIds(stats, [invented])).toEqual([]);
  });
});

/**
 * The T10 sticker audit, as tests rather than as intentions.
 *
 * Every one of these encodes a decision recorded in `docs/implementation-plan.md`
 * §7 T10. They exist because a copy or threshold decision that is not asserted
 * gets quietly reverted by the next session that finds it odd (LESSONS §3a).
 */
describe('the T10 sticker decisions', () => {
  const landedAll = (ids: readonly string[]) =>
    statsFor({ byId: Object.fromEntries(ids.map((id) => [id, 'some' as StageId])) });

  it('badges no inversion, in any sport (issue #77)', () => {
    // The app's own coaching copy says foam pit first for both of these. A
    // badge for landing one is a reason for a child to skip that rung.
    const flips = landedAll(['backflip', 'frontflip', 'flair']);
    expect(evaluateSticker(flips, sticker('upside'))).toBe(false);
    expect(earnedStickerIds(flips)).not.toContain('upside');
    // Retired rather than deleted: the seed upserts and never removes, so a
    // deleted record would stay live and unearnable in every seeded database.
    expect(sticker('upside').isLive).toBe(false);
    expect(stickersFor(['scooter']).map((s) => s.id)).not.toContain('upside');
    // The recognition it stood for survives, without naming a target.
    expect(evaluateSticker(flips, sticker('gnarly'))).toBe(true);
  });

  it('never un-earns a category sticker when the library grows (issue #78)', () => {
    const scooterFlat = ['bunny-hop', 'tic-tac', 'manual', 'fingerwhip', 'hippie-jump', 'x-up'];
    const withNoseManual = landedAll([...scooterFlat, 'nose-manual']);
    expect(evaluateSticker(withNoseManual, sticker('flat-out'))).toBe(true);

    // Staff add an eighth Flat trick from the admin portal. Under `catDone`
    // this took the sticker away from everyone who had it; under a count it
    // cannot.
    const bigger = [
      ...TRICKS,
      {
        ...TRICKS[0]!,
        id: 'staff-added-flat',
        name: 'Staff Added',
        sport: 'scooter' as const,
        cat: 'flat' as const,
      },
    ];
    const sameRider = computeStats({ byId: withNoseManual.byId, sports: ['scooter'] }, null, {
      tricks: bigger,
    });
    expect(evaluateSticker(sameRider, sticker('flat-out'))).toBe(true);
  });

  it('does not count the stair set toward Ledge Rat (issue #79)', () => {
    // Four stair sets is one stair set, four times. It is also the escalation
    // ladder an achievement in a children's product must not nudge.
    // The exact shape the old rule rewarded: two ledges and a stair set made
    // three `street` tricks, which was the whole threshold.
    const stairCounted = landedAll(['sk-50-50', 'sk-boardslide', 'sk-gap']);
    expect(evaluateSticker(stairCounted, sticker('ledge-rat'))).toBe(false);

    const ledges = landedAll(['sk-50-50', 'sk-boardslide', 'sk-noseslide', 'sk-5-0']);
    expect(evaluateSticker(ledges, sticker('ledge-rat'))).toBe(true);

    // Three of the seven qualifying tricks are difficulty 3, so a threshold of
    // three would have meant "the three easy ones".
    expect(sticker('ledge-rat').n).toBe(4);
    const three = landedAll(['sk-50-50', 'sk-boardslide', 'sk-noseslide']);
    expect(evaluateSticker(three, sticker('ledge-rat'))).toBe(false);
  });

  it('holds the naming rule the copy review produced (issue #82)', () => {
    for (const s of STICKERS) {
      // No number in a name: `n` is editable, so a name quoting it goes stale
      // the moment staff retune the record.
      expect(s.name, s.id).not.toMatch(/\d/);
      // The name is set on a fixed arc in `StickerBadge` and the font ramp
      // steps once. Past thirteen characters it runs off the curve.
      expect(s.name.length, s.id).toBeLessThanOrEqual(13);
    }

    // The four names the review singled out, pinned so they do not come back.
    const nameOf = (id: string) => sticker(id).name;
    expect(nameOf('flip-club')).not.toBe('Flip Club');
    expect(nameOf('coping-time')).not.toBe('Coping Time');
    expect(nameOf('tre-deep')).not.toBe('Tre Deep');
    expect(nameOf('flat-track')).not.toBe('Flat Tracked');
    // Factually wrong, both fixed: skate `park` is a quarter pipe, not a bowl,
    // and "Ollie Up" meant nothing.
    expect(nameOf('bowl-rider')).not.toBe('Bowl Rider');
    expect(nameOf('ollie-up')).not.toBe('Ollie Up');
    // "Both" is a two-sport word in a three-sport product.
    expect(nameOf('both-feet')).not.toBe('Both Feet');
  });

  it('keeps every sticker id stable, because ids are what riders hold', () => {
    // A `rider_stickers` row points at the record, the hook's rule map is keyed
    // by slug, and the seed matches on slug. Renaming an id un-earns a sticker
    // for everyone who has it, so the rename above moved names only.
    const ids = STICKERS.map((s) => s.id);
    for (const id of [
      'week-one',
      'month-on',
      'both-feet',
      'flip-club',
      'coping-time',
      'tre-deep',
    ]) {
      expect(ids, id).toContain(id);
    }
  });
});

describe('what a rider on the free tier can reach', () => {
  /**
   * Plan §1: achievements are never for sale. The paywall gates *tricks*, so it
   * reaches the sticker wall sideways — a sticker counting tricks a free rider
   * cannot log is bought, whatever the record says. These tests pin the free
   * tier open; they fail if a trick is regraded or a threshold raised past what
   * the free library can satisfy.
   */
  const freeRider = (sport: SportId) => {
    const landed: Record<string, StageId> = {};
    for (const trick of TRICKS) {
      if (trick.sport === sport && trick.isLive && isTrickFree(trick)) landed[trick.id] = 'every';
    }
    return computeStats({ byId: landed, sports: [sport] });
  };

  const freeIn = (sport: SportId, cat: 'flat' | 'street' | 'park') =>
    tricksInCategory(cat, sport).filter((t) => t.isLive && isTrickFree(t));

  it('lets a free rider in every sport earn the entry stickers', () => {
    for (const sport of ['scooter', 'skate', 'bmx'] as const) {
      const earned = earnedStickerIds(freeRider(sport));
      expect(earned, sport).toContain('first-land');
      expect(earned, sport).toContain('five-deep');
      // Added in T10 (issue #81). The consistency sticker must be reachable
      // without paying: every free trick can be taken to "every time".
      expect(earned, sport).toContain('every-time');
    }
  });

  it('gives skate free street content, so the branch can be entered at all', () => {
    // `sk-50-50` carries a `free: true` override for the same reason
    // `bmx-double-peg` does. Without it skate street is entirely paid and a free
    // rider sees the branch without being able to step onto it.
    expect(freeIn('skate', 'street').map((t) => t.id)).toContain('sk-50-50');
    for (const sport of ['scooter', 'skate', 'bmx'] as const) {
      expect(freeIn(sport, 'street'), sport).not.toHaveLength(0);
    }
  });

  it('keeps bowl-rider inside the free tier it was missing by one trick', () => {
    // Skate park has exactly two free tricks, so the threshold cannot exceed 2.
    expect(freeIn('skate', 'park')).toHaveLength(2);
    expect(earnedStickerIds(freeRider('skate'))).toContain('bowl-rider');
  });

  it('reaches every shared volume sticker in every sport, on the free tier', () => {
    // The owner's requirement, kept as a test rather than as an intention:
    // `ten-deep` must be earnable by a free rider who only does one sport. It
    // needs ten landed tricks, so each sport's free library has to hold at
    // least ten — a rule that no threshold tuning can fake.
    for (const sport of ['scooter', 'skate', 'bmx'] as const) {
      const stats = freeRider(sport);
      expect(stats.global.landed, sport).toBeGreaterThanOrEqual(10);
      expect(earnedStickerIds(stats), sport).toContain('ten-deep');
    }
  });

  it('puts each sport rite of passage inside the free tier', () => {
    // A milestone behind the paywall is an achievement for sale (plan §1).
    expect(earnedStickerIds(freeRider('scooter'))).toContain('whip-club');
    expect(earnedStickerIds(freeRider('skate'))).toContain('flip-club');
  });

  it('keeps the stair set out of the free tier', () => {
    // `sk-gap` is Stair Set. Freeing tricks must never quietly make it cheaper
    // to chase stair counts — see the ledge-rat issue.
    expect(freeIn('skate', 'street').map((t) => t.id)).not.toContain('sk-gap');
  });

  it('earns the free scooter stickers without a paid trick', () => {
    const earned = earnedStickerIds(freeRider('scooter'));
    expect(earned).toContain('hop-master');
    expect(earned).toContain('street-cred');
    expect(earned).toContain('grind-time');
  });
});
