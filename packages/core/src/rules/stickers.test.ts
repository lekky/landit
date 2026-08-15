import { describe, expect, it } from 'vitest';

import { STICKERS } from '../data/stickers';
import type { RiderSnapshot, StageId, Sticker } from '../types';
import { computeStats } from './stats';
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
    // is a scooter sticker.
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

  it('Upside Down accepts any scooter flip trick', () => {
    expect(evaluateSticker(statsFor({ byId: byId({ backflip: 'some' }) }), sticker('upside'))).toBe(
      true,
    );
    expect(evaluateSticker(statsFor({ byId: byId({ flair: 'every' }) }), sticker('upside'))).toBe(
      true,
    );
  });

  it('Gnarly needs a landed difficulty-5 trick', () => {
    expect(
      evaluateSticker(statsFor({ byId: byId({ backflip: 'trying' }) }), sticker('gnarly')),
    ).toBe(false);
    expect(evaluateSticker(statsFor({ byId: byId({ backflip: 'some' }) }), sticker('gnarly'))).toBe(
      true,
    );
  });

  it('Both Feet needs something landed on each sport', () => {
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

  it('the streak stickers read the streak, at 7 and 30 days', () => {
    expect(evaluateSticker(statsFor({ streak: 6 }), sticker('week-one'))).toBe(false);
    expect(evaluateSticker(statsFor({ streak: 7 }), sticker('week-one'))).toBe(true);
    expect(evaluateSticker(statsFor({ streak: 29 }), sticker('month-on'))).toBe(false);
    expect(evaluateSticker(statsFor({ streak: 30 }), sticker('month-on'))).toBe(true);
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
