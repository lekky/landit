import { describe, expect, it } from 'vitest';

import { AWARDS } from '../data/awards';
import { STICKERS } from '../data/stickers';
import { TRICKS } from '../data/tricks';
import type { RiderSnapshot, SportId, SportStats, StageId, Sticker } from '../types';
import { computeStats } from './stats';
import { isTrickFree } from './tricks';
import {
  KIND_RULES,
  earnedStickerIds,
  evaluateSticker,
  newlyEarnedStickerIds,
  resolveStickerRule,
  stickerCondition,
  stickerScope,
  stickersFor,
} from './stickers';

const byId = (entries: Record<string, StageId>): Record<string, StageId> => entries;

const statsFor = (over: Partial<RiderSnapshot> = {}) =>
  computeStats({ byId: {}, sports: ['scooter', 'skate', 'bmx'], ...over });

const sticker = (id: string): Sticker => {
  const found = STICKERS.find((s) => s.id === id);
  if (!found) throw new Error(`No sticker ${id}`);
  return found;
};

/** A combined scope with the server-only award stats injected. */
const serverScope = (over: Partial<SportStats> = {}): SportStats => ({
  ...statsFor().global,
  ...over,
});

describe('which stickers are on the wall', () => {
  it('always shows the shared ones', () => {
    const shown = stickersFor(['scooter']).map((s) => s.id);
    expect(shown).toContain('first-land');
    expect(shown).toContain('rolling-deep');
    expect(shown).toContain('hot-streak');
  });

  it('hides sport awards for a sport the rider does not ride', () => {
    const scooterOnly = stickersFor(['scooter']).map((s) => s.id);
    expect(scooterOnly).toContain('tailwhip');
    expect(scooterOnly).not.toContain('sk-kickflip');
    expect(scooterOnly).not.toContain('bmx-bunny-hop');

    const both = stickersFor(['scooter', 'skate']).map((s) => s.id);
    expect(both).toContain('sk-kickflip');
  });

  it('hides a sticker staff have taken off the wall', () => {
    const hidden: Sticker[] = [{ ...sticker('first-land'), isLive: false }];
    expect(stickersFor(['scooter'], hidden)).toEqual([]);
  });

  it('never shows a retired legacy sticker or the dormant promoter award', () => {
    const shown = stickersFor(['scooter', 'skate', 'bmx']).map((s) => s.id);
    for (const id of ['five-deep', 'gnarly', 'both-feet', 'upside', 'ledge-rat', 'promoter']) {
      expect(shown, id).not.toContain(id);
    }
  });
});

describe('sticker scoping', () => {
  it('judges a trick award against its own sport alone', () => {
    const stats = statsFor({ byId: byId({ 'bunny-hop': 'every' }) });
    expect(stickerScope(stats, sticker('tailwhip')).sport).toBe('scooter');
    expect(stickerScope(stats, sticker('sk-kickflip')).sport).toBe('skate');
  });

  it('judges a shared award against the combined stats', () => {
    const stats = statsFor({ byId: byId({ 'bunny-hop': 'every' }) });
    expect(stickerScope(stats, sticker('first-land')).sport).toBeNull();
  });

  it('counts a shared milestone across every sport', () => {
    const stats = statsFor({
      byId: byId({ 'bunny-hop': 'some', 'tic-tac': 'some', 'sk-ollie': 'some' }),
    });
    expect(evaluateSticker(stats, sticker('first-land'))).toBe(true);
    // Rolling Deep needs ten landed anywhere; three is not ten.
    expect(evaluateSticker(stats, sticker('rolling-deep'))).toBe(false);
  });
});

describe('thresholds come off the record, not the code', () => {
  const tenLanded = statsFor({
    byId: byId(
      Object.fromEntries(
        [
          'bunny-hop',
          'tic-tac',
          'x-up',
          'manual',
          'fingerwhip',
          'hippie-jump',
          'nose-manual',
          '180',
          '50-50',
          'gap',
        ].map((id) => [id, 'some' as const]),
      ),
    ),
  });

  it('earns Rolling Deep at the shipped threshold of ten', () => {
    expect(sticker('rolling-deep').n).toBe(10);
    expect(evaluateSticker(tenLanded, sticker('rolling-deep'))).toBe(true);
    expect(evaluateSticker(tenLanded, sticker('stacked'))).toBe(false);
  });

  it('moves with the threshold when staff retune it', () => {
    const easier: Sticker = { ...sticker('stacked'), n: 3 };
    expect(evaluateSticker(tenLanded, easier)).toBe(true);

    const harder: Sticker = { ...sticker('rolling-deep'), n: 50 };
    expect(evaluateSticker(tenLanded, harder)).toBe(false);
  });

  it('falls back to the kind’s shipped bar when a record carries no threshold', () => {
    // `first-land` ships without `n` — its kind's default is one, so the
    // condition copy stays clean ("Land your first trick", not "1 …").
    expect(sticker('first-land').n).toBeUndefined();
    expect(evaluateSticker(tenLanded, sticker('first-land'))).toBe(true);
  });

  it('stays locked when a no-default kind loses its threshold, rather than firing', () => {
    // Failing closed matters: a sticker is the one thing that must be earned.
    // `streak` has no unit default — clearing `n` locks it.
    const broken: Sticker = { ...sticker('hot-streak'), n: undefined };
    expect(evaluateSticker(statsFor({ streak: 99 }), broken)).toBe(false);
  });

  it('reads the threshold into the condition copy', () => {
    expect(stickerCondition(sticker('rolling-deep'))).toBe('10 tricks landed');
    expect(stickerCondition(sticker('first-land'))).toBe('Land your first trick');
    expect(stickerCondition({ ...sticker('rolling-deep'), n: 12 })).toBe('12 tricks landed');
  });
});

describe('the shipped rules', () => {
  it('a trick award needs the trick landed, not merely tracked', () => {
    expect(
      evaluateSticker(statsFor({ byId: byId({ tailwhip: 'want' }) }), sticker('tailwhip')),
    ).toBe(false);
    expect(
      evaluateSticker(statsFor({ byId: byId({ tailwhip: 'trying' }) }), sticker('tailwhip')),
    ).toBe(false);
    expect(
      evaluateSticker(statsFor({ byId: byId({ tailwhip: 'some' }) }), sticker('tailwhip')),
    ).toBe(true);
  });

  it('a trick award never fires for a different trick, or a different sport’s twin', () => {
    // Three libraries share names (Manual, Bunny Hop, Backflip); each award is
    // keyed to its own trick slug, so landing the BMX one earns the BMX badge.
    const stats = statsFor({ byId: byId({ 'bmx-backflip': 'some' }) });
    expect(evaluateSticker(stats, sticker('bmx-backflip'))).toBe(true);
    expect(evaluateSticker(stats, sticker('backflip'))).toBe(false);
  });

  it('On Lock needs one trick at every time; Dialled needs that on a Pro trick', () => {
    const easyMastered = statsFor({ byId: byId({ 'bunny-hop': 'every' }) });
    expect(evaluateSticker(easyMastered, sticker('on-lock'))).toBe(true);
    expect(evaluateSticker(easyMastered, sticker('dialled'))).toBe(false);

    const hardLanded = statsFor({ byId: byId({ backflip: 'some' }) });
    expect(evaluateSticker(hardLanded, sticker('dialled'))).toBe(false);

    const hardMastered = statsFor({ byId: byId({ backflip: 'every' }) });
    expect(evaluateSticker(hardMastered, sticker('dialled'))).toBe(true);
  });

  it('the single-sport count awards need one sport at the bar, never a cross-sport sum', () => {
    // Four street tricks on scooter plus three on skate is seven street tricks
    // and no Street King: the award asks one sport to carry the whole count.
    const split = statsFor({
      byId: byId({
        '180': 'some',
        '50-50': 'some',
        gap: 'some',
        icepick: 'some',
        'sk-50-50': 'some',
        'sk-boardslide': 'some',
        'sk-noseslide': 'some',
      }),
    });
    expect(split.global.catCount.street).toBe(7);
    expect(evaluateSticker(split, sticker('street-king'))).toBe(false);

    const oneSport = statsFor({
      byId: byId(
        Object.fromEntries(
          ['180', '50-50', 'gap', 'icepick', 'feeble', 'smith', '180-grind-out'].map((id) => [
            id,
            'some' as const,
          ]),
        ),
      ),
    });
    expect(evaluateSticker(oneSport, sticker('street-king'))).toBe(true);
  });

  it('The Full Run reads the largest single-sport landed count', () => {
    const record: Sticker = { ...sticker('the-full-run'), n: 3 };
    const spread = statsFor({
      byId: byId({ 'bunny-hop': 'some', 'sk-ollie': 'some', 'bmx-wheelie': 'some' }),
    });
    expect(evaluateSticker(spread, record)).toBe(false);

    const oneSport = statsFor({
      byId: byId({ 'bunny-hop': 'some', 'tic-tac': 'some', 'x-up': 'some' }),
    });
    expect(evaluateSticker(oneSport, record)).toBe(true);
  });

  it('the streak awards count weeks, not days (issue #10)', () => {
    expect(evaluateSticker(statsFor({ streak: 3 }), sticker('hot-streak'))).toBe(false);
    expect(evaluateSticker(statsFor({ streak: 4 }), sticker('hot-streak'))).toBe(true);
    expect(evaluateSticker(statsFor({ streak: 51 }), sticker('year-round'))).toBe(false);
    expect(evaluateSticker(statsFor({ streak: 52 }), sticker('year-round'))).toBe(true);
  });

  it('no streak award name states a unit or a number the rule can change under it', () => {
    for (const id of ['hot-streak', 'all-season', 'rain-or-shine', 'year-round']) {
      const name = sticker(id).name;
      expect(name, id).not.toMatch(/day|week|month|\d/i);
      expect(stickerCondition(sticker(id)), id).toContain('weeks in a row');
    }
  });

  it('First Clip, First Challenge and Crewed Up read their own counters', () => {
    expect(evaluateSticker(statsFor({ clips: 1 }), sticker('first-clip'))).toBe(true);
    expect(evaluateSticker(statsFor({ clips: 0 }), sticker('first-clip'))).toBe(false);
    expect(evaluateSticker(statsFor({ crew: true }), sticker('crewed-up'))).toBe(true);
    expect(evaluateSticker(statsFor({ crew: false }), sticker('crewed-up'))).toBe(false);
  });

  it('Triple Threat needs a landed trick on all three sports', () => {
    const two = statsFor({ byId: byId({ 'bunny-hop': 'some', 'sk-ollie': 'some' }) });
    expect(evaluateSticker(two, sticker('triple-threat'))).toBe(false);

    const three = statsFor({
      byId: byId({ 'bunny-hop': 'some', 'sk-ollie': 'some', 'bmx-wheelie': 'some' }),
    });
    expect(evaluateSticker(three, sticker('triple-threat'))).toBe(true);
  });

  it('All Terrain needs every category landed in one sport, not across sports', () => {
    const oneSport = statsFor({
      byId: byId({
        'bunny-hop': 'some', // flat
        '180': 'some', // street
        tailwhip: 'some', // park
        'whip-to-bar': 'some', // hybrid
        superman: 'some', // air
      }),
    });
    expect(evaluateSticker(oneSport, sticker('all-terrain'))).toBe(true);

    const spread = statsFor({
      byId: byId({
        'bunny-hop': 'some', // scooter flat
        'sk-boardslide': 'some', // skate street
        'bmx-drop-in': 'some', // bmx park
        'sk-varial-flip': 'some', // skate hybrid
        superman: 'some', // scooter air
      }),
    });
    expect(evaluateSticker(spread, sticker('all-terrain'))).toBe(false);
  });

  it('the server-only kinds under-promise on the client and read server stats when given', () => {
    // The client's stats never carry these fields, so the client answer is
    // always "not yet" — it can never show an award the server would refuse.
    const stats = statsFor();
    for (const id of [
      'on-the-map',
      'showed-up',
      'ring-leader',
      'suited-up',
      'year-one',
      'day-one',
      'keeping-it-real',
      'supporter',
    ]) {
      expect(evaluateSticker(stats, sticker(id)), id).toBe(false);
    }

    // Given the stats the hook computes, the same rules answer properly.
    expect(
      KIND_RULES['spots-approved'](serverScope({ spotsApproved: 1 }), sticker('on-the-map')),
    ).toBe(true);
    expect(
      KIND_RULES['events-going'](serverScope({ eventsGoing: 5 }), sticker('scene-regular')),
    ).toBe(true);
    expect(
      KIND_RULES['crew-owned'](serverScope({ crewOwnedSize: 5 }), sticker('ring-leader')),
    ).toBe(true);
    expect(
      KIND_RULES['crew-owned'](serverScope({ crewOwnedSize: 4 }), sticker('ring-leader')),
    ).toBe(false);
    expect(
      KIND_RULES['profile-complete'](serverScope({ profileComplete: true }), sticker('suited-up')),
    ).toBe(true);
    expect(
      KIND_RULES['account-age'](serverScope({ accountAgeDays: 365 }), sticker('year-one')),
    ).toBe(true);
    expect(
      KIND_RULES['account-age'](serverScope({ accountAgeDays: 364 }), sticker('year-one')),
    ).toBe(false);
    expect(KIND_RULES.founder(serverScope({ isFounder: true }), sticker('day-one'))).toBe(true);
    expect(
      KIND_RULES['stage-drop'](serverScope({ stageDropped: true }), sticker('keeping-it-real')),
    ).toBe(true);
    expect(KIND_RULES.supporter(serverScope({ planPaid: true }), sticker('supporter'))).toBe(true);
  });

  it('Comeback is never earned from stats — the hook grants it at the moment of the ride', () => {
    expect(KIND_RULES.comeback(serverScope({ streak: 99 }), sticker('comeback'))).toBe(false);
  });

  it('never un-earns a single-sport count award when the library grows (issue #78)', () => {
    const scooterFlat = [
      'bunny-hop',
      'tic-tac',
      'manual',
      'fingerwhip',
      'hippie-jump',
      'x-up',
      'nose-manual',
    ];
    const snapshot = {
      byId: Object.fromEntries(scooterFlat.map((id) => [id, 'some' as StageId])),
      sports: ['scooter' as const],
    };
    expect(evaluateSticker(computeStats(snapshot, null), sticker('flat-out'))).toBe(true);

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
    expect(
      evaluateSticker(computeStats(snapshot, null, { tricks: bigger }), sticker('flat-out')),
    ).toBe(true);
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
    expect(earned).toContain('on-lock');
    expect(earned).toContain('crewed-up');
    expect(earned).toContain('bunny-hop');
    expect(earned).toContain('sk-ollie');
    // Canonical order, so the wall never reshuffles itself.
    const order: string[] = STICKERS.map((s) => s.id);
    expect(earned).toEqual([...earned].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
  });

  it('leaves out a sport award for a sport the rider dropped', () => {
    const stats = computeStats({ byId: byId({ 'sk-ollie': 'every' }), sports: ['scooter'] });
    expect(earnedStickerIds(stats)).not.toContain('sk-ollie');
  });

  it('announces only what is new, so a sticker is never re-announced', () => {
    const stats = statsFor({ byId: byId({ 'bunny-hop': 'every' }) });
    const all = earnedStickerIds(stats);
    expect(newlyEarnedStickerIds(stats, [])).toEqual(all);
    expect(newlyEarnedStickerIds(stats, all)).toEqual([]);
    expect(newlyEarnedStickerIds(stats, ['first-land'])).not.toContain('first-land');
  });

  it('never earns a sticker that resolves no rule', () => {
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
    expect(resolveStickerRule(invented)).toBeUndefined();
    expect(evaluateSticker(stats, invented)).toBe(false);
    expect(earnedStickerIds(stats, [invented])).toEqual([]);
    // Promoter ships exactly this way on purpose: record present, no rule,
    // until rider event submissions exist.
    expect(resolveStickerRule(sticker('promoter'))).toBeUndefined();
  });
});

/**
 * The sticker decisions, as tests rather than as intentions — T10's audit
 * carried forward through T24's award era. Every one encodes a decision
 * recorded in `docs/implementation-plan.md`; they exist because a copy or
 * threshold decision that is not asserted gets quietly reverted by the next
 * session that finds it odd (LESSONS §3a).
 */
describe('the sticker decisions', () => {
  it('keeps upside retired: no nameless inversion dare, in any sport (issue #77)', () => {
    // T24 nuance, decided with the award manifest (owner, 2026-08-30): each
    // trick in the library now carries an award — including `backflip`, whose
    // own coaching copy is the coached foam-pit path. What stays banned is
    // what `upside` was: a badge naming inversions as a *category* dare,
    // detached from the library's progression. Its rule is `() => false`, so
    // even the record going live again cannot award it.
    const flips = statsFor({
      byId: byId({ backflip: 'some', frontflip: 'some', flair: 'some' }),
    });
    expect(evaluateSticker(flips, sticker('upside'))).toBe(false);
    expect(earnedStickerIds(flips)).not.toContain('upside');
    expect(sticker('upside').isLive).toBe(false);
  });

  it('holds the naming rule where it still applies (issues #10 and #82)', () => {
    const all: readonly Sticker[] = STICKERS;
    for (const s of all) {
      // No number in a *threshold-carrying* name: `n` is editable, so a name
      // quoting it goes stale the moment staff retune the record. A trick
      // award's number ("The 360") names the trick, not a threshold.
      if (s.n !== undefined) expect(s.name, s.id).not.toMatch(/\d/);
      // The 13-character arc limit binds only records that render the drawn
      // badge — those without printed art.
      if (!s.img) expect(s.name.length, s.id).toBeLessThanOrEqual(13);
    }
  });

  it('keeps every live award pointed at a real trick', () => {
    // Widened from the `as const` union so the optional fields are a question
    // about values, not literal types — the same move `data.test.ts` makes.
    const allAwards: readonly Sticker[] = AWARDS;
    const trickIds = new Set<string>(TRICKS.map((t) => t.id));
    for (const s of allAwards) {
      if (s.kind !== 'trick') continue;
      expect(Boolean(s.trick && trickIds.has(s.trick)), s.id).toBe(true);
      // The award sits on the same sport tab as its trick.
      expect(s.sport, s.id).toBe(TRICKS.find((t) => t.id === s.trick)?.sport);
    }
  });
});

describe('what a rider on the free tier can reach', () => {
  /**
   * Plan §1: achievements are never for sale — held for the entry and volume
   * awards, and *scoped* by the owner for the award era (2026-08-30, recorded
   * in plan §6.7): the completion awards, the clip awards and `supporter` sit
   * behind paid features on purpose. These tests pin both halves: the free
   * floor stays open, and the paid ceiling is a decision, not an accident.
   */
  const freeRider = (sport: SportId) => {
    const landed: Record<string, StageId> = {};
    for (const trick of TRICKS) {
      if (trick.sport === sport && trick.isLive && isTrickFree(trick)) landed[trick.id] = 'every';
    }
    return computeStats({ byId: landed, sports: [sport] });
  };

  it('lets a free rider in every sport earn the entry awards', () => {
    for (const sport of ['scooter', 'skate', 'bmx'] as const) {
      const earned = earnedStickerIds(freeRider(sport));
      expect(earned, sport).toContain('first-land');
      expect(earned, sport).toContain('on-lock');
      // Ten free tricks per sport is the floor the owner set for `ten-deep`;
      // `rolling-deep` inherits it unchanged.
      expect(earned, sport).toContain('rolling-deep');
    }
  });

  it('puts each sport’s rite of passage inside the free tier', () => {
    // A milestone behind the paywall is an achievement for sale (plan §1).
    expect(earnedStickerIds(freeRider('scooter'))).toContain('tailwhip');
    expect(earnedStickerIds(freeRider('skate'))).toContain('sk-kickflip');
    expect(earnedStickerIds(freeRider('bmx'))).toContain('bmx-double-peg');
  });

  it('keeps the paid ceiling deliberate: completion awards are out of free reach', () => {
    // The paywall gates difficulty ≥ 3, so no free library can carry a whole
    // category to its completion bar. The owner accepted exactly this
    // (2026-08-30); if a regrade ever brings one inside the free tier, this
    // test asks whether that was meant.
    for (const sport of ['scooter', 'skate', 'bmx'] as const) {
      const earned = earnedStickerIds(freeRider(sport));
      expect(earned, sport).not.toContain('street-king');
      expect(earned, sport).not.toContain('the-full-run');
    }
  });
});
