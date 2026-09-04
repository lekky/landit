import { describe, expect, it } from 'vitest';

import { TRICKS } from '../data/tricks';
import type { StageId, Trick } from '../types';
import {
  FREE_MAX_DIFF,
  isLandedStage,
  isTrickFree,
  isTrickLanded,
  isTrickLocked,
  isTrickUnlocked,
  missingPrereqs,
  openTricks,
  planUnlocksPaidTricks,
  sportOf,
  suggestedNextTricks,
  trickById,
  tricksFor,
  tricksInCategory,
} from './tricks';

const trick = (over: Partial<Trick> & Pick<Trick, 'id' | 'diff'>): Trick => ({
  name: over.id,
  sport: 'scooter',
  cat: 'flat',
  pre: [],
  about: '',
  tips: '',
  fact: '',
  isLive: true,
  ...over,
});

describe('landed stages', () => {
  it('counts some, most and every as landed', () => {
    expect(isLandedStage('some')).toBe(true);
    expect(isLandedStage('most')).toBe(true);
    expect(isLandedStage('every')).toBe(true);
  });

  it('does not count wanting it or learning it as landing it', () => {
    expect(isLandedStage('want')).toBe(false);
    expect(isLandedStage('trying')).toBe(false);
  });

  it('treats an untracked trick as not landed', () => {
    expect(isLandedStage(null)).toBe(false);
    expect(isLandedStage(undefined)).toBe(false);
    expect(isTrickLanded({}, 'bunny-hop')).toBe(false);
    expect(isTrickLanded({ 'bunny-hop': 'trying' }, 'bunny-hop')).toBe(false);
    expect(isTrickLanded({ 'bunny-hop': 'some' }, 'bunny-hop')).toBe(true);
  });
});

describe('the free / paid split', () => {
  it('is free at difficulty 1 and 2, paid from 3 up', () => {
    expect(FREE_MAX_DIFF).toBe(2);
    expect(isTrickFree(trick({ id: 'a', diff: 1 }))).toBe(true);
    expect(isTrickFree(trick({ id: 'b', diff: 2 }))).toBe(true);
    expect(isTrickFree(trick({ id: 'c', diff: 3 }))).toBe(false);
    expect(isTrickFree(trick({ id: 'd', diff: 5 }))).toBe(false);
  });

  it('lets the staff override win in both directions', () => {
    // A hard trick pulled into the free tier...
    expect(isTrickFree(trick({ id: 'gift', diff: 5, free: true }))).toBe(true);
    // ...and an easy one pushed out of it.
    expect(isTrickFree(trick({ id: 'held-back', diff: 1, free: false }))).toBe(false);
  });

  it('falls back to difficulty only when there is no override', () => {
    const noOverride = trick({ id: 'plain', diff: 2 });
    expect(noOverride.free).toBeUndefined();
    expect(isTrickFree(noOverride)).toBe(true);
  });

  it('splits the shipped library 30 free / 229 paid, ten free per sport', () => {
    // Read through `Trick`: the canonical data is `as const`, so a trick with
    // no override has no `free` key in its inferred type at all.
    const library: readonly Trick[] = TRICKS;
    const free = library.filter(isTrickFree);
    expect(free).toHaveLength(30);
    expect(library.filter((t) => !isTrickFree(t))).toHaveLength(library.length - 30);

    /*
     * The free tier is a fixed ten per sport, spread 4 Rookie / 3 Easy / 2
     * Spicy / 1 Gnarly and nothing at Pro (owner, 2026-09-04, in chat; the
     * reasoning is written down above `TRICKS` in `../data/tricks.ts`).
     *
     * Named here on purpose, and this is the point of the test: `free` is how
     * the free tier moves silently, so a swap has to be argued for in a diff
     * rather than noticed a month later on the plans page. `../data/data.test`
     * asserts the *shape* — the 4/3/2/1 counts and the prerequisite closure
     * that makes every one of them reachable — which is the part that must
     * hold whichever tricks fill the slots.
     */
    const freeIds = (sport: 'scooter' | 'skate' | 'bmx') =>
      free
        .filter((t) => t.sport === sport)
        .map((t) => t.id)
        .sort();

    expect(freeIds('scooter')).toEqual(
      [
        'bunny-hop',
        'tic-tac',
        'fakie',
        'pump',
        '180',
        '50-50',
        'drop-in',
        'tailwhip',
        'bar-spin',
        '360',
      ].sort(),
    );
    expect(freeIds('skate')).toEqual(
      [
        'sk-kickturn',
        'sk-tic-tac',
        'sk-fakie-roll',
        'sk-pump',
        'sk-ollie',
        'sk-manual',
        'sk-drop-in',
        'sk-kickflip',
        'sk-50-50',
        'sk-wallride',
      ].sort(),
    );
    expect(freeIds('bmx')).toEqual(
      [
        'bmx-wheelie',
        'bmx-pump',
        'bmx-track-stand',
        'bmx-curb-drop',
        'bmx-bunny-hop',
        'bmx-drop-in',
        'bmx-air',
        'bmx-double-peg',
        'bmx-one-hander',
        'bmx-flyout-tailwhip',
      ].sort(),
    );

    /*
     * "No difficulty-1 trick is ever paid" was true until 2026-09-04 and is
     * not any more: scooter and skate each have six Rookie entries and only
     * four free slots, so two of each are paid. Recorded as an assertion
     * rather than deleted, because it is a decision and not an accident — a
     * session that thinks it is a bug should read the note in `../data/tricks`
     * before changing it.
     */
    const paidRookie = library.filter((t) => t.diff === 1 && !isTrickFree(t)).map((t) => t.id);
    expect(paidRookie.sort()).toEqual(
      ['kickturn', 'tail-tap', 'sk-curb-drop', 'sk-ramp-kickturn'].sort(),
    );

    // The overrides are what implement all of the above, in both directions:
    // pulling a Spicy or Gnarly trick into the free tier, and pushing an easy
    // one out of it. Difficulty alone decides nothing here any more.
    const overridden = library.filter((t) => t.free !== undefined);
    expect(overridden.filter((t) => t.free === true).length).toBeGreaterThan(0);
    expect(overridden.filter((t) => t.free === false).length).toBeGreaterThan(0);
    for (const trick of overridden) expect(isTrickFree(trick), trick.id).toBe(trick.free);

    // Anything free above the difficulty cut-off got there by an override, and
    // anything easy that is not free was pushed out by one. Nothing is free or
    // paid by accident.
    expect(free.every((t) => t.diff <= FREE_MAX_DIFF || t.free === true)).toBe(true);
    expect(
      library
        .filter((t) => t.diff <= FREE_MAX_DIFF && !isTrickFree(t))
        .every((t) => t.free === false),
    ).toBe(true);
  });
});

describe('the paywall', () => {
  const paid = trick({ id: 'tailwhip', diff: 3 });
  const gratis = trick({ id: 'bunny-hop', diff: 1 });

  it('locks paid tricks for a rookie rider only', () => {
    expect(isTrickLocked(paid, 'rookie')).toBe(true);
    expect(isTrickLocked(paid, 'shredder')).toBe(false);
    expect(isTrickLocked(paid, 'legend')).toBe(false);
  });

  it('never locks a free trick, whatever the plan', () => {
    expect(isTrickLocked(gratis, 'rookie')).toBe(false);
    expect(isTrickLocked(gratis, 'shredder')).toBe(false);
  });

  it('reads "does this plan unlock the paid tiers" off the plan record', () => {
    expect(planUnlocksPaidTricks('rookie')).toBe(false);
    expect(planUnlocksPaidTricks('shredder')).toBe(true);
    expect(planUnlocksPaidTricks('legend')).toBe(true);
  });

  it('opens the whole library to a paid rider and the free tier to a rookie', () => {
    // Counted off `TRICKS`, not a literal: the library grew from 97 to 259 in
    // T27 and every literal count in this file went stale in the same commit.
    expect(openTricks('shredder')).toHaveLength(TRICKS.length);
    expect(openTricks('legend')).toHaveLength(TRICKS.length);
    expect(openTricks('rookie').every(isTrickFree)).toBe(true);
    expect(openTricks('rookie').length).toBeLessThan(TRICKS.length);
  });

  it('respects a staff override at the paywall too', () => {
    const freed = trick({ id: 'freebie', diff: 5, free: true });
    expect(isTrickLocked(freed, 'rookie')).toBe(false);
  });
});

describe('prerequisite unlocks', () => {
  const byId = (entries: Record<string, StageId>): Record<string, StageId> => entries;

  it('unlocks a trick with no prerequisites, always', () => {
    expect(isTrickUnlocked(trick({ id: 'bunny-hop', diff: 1 }), {})).toBe(true);
  });

  it('needs every prerequisite landed, not just one', () => {
    const combo = trick({ id: 'whip-to-bar', diff: 5, pre: ['tailwhip', 'bar-spin'] });
    expect(isTrickUnlocked(combo, byId({ tailwhip: 'every' }))).toBe(false);
    expect(isTrickUnlocked(combo, byId({ tailwhip: 'every', 'bar-spin': 'some' }))).toBe(true);
  });

  it('does not accept "learning it" as a landed prerequisite', () => {
    const manual = trick({ id: 'manual', diff: 2, pre: ['bunny-hop'] });
    expect(isTrickUnlocked(manual, byId({ 'bunny-hop': 'trying' }))).toBe(false);
    expect(isTrickUnlocked(manual, byId({ 'bunny-hop': 'some' }))).toBe(true);
  });

  it('names the prerequisites still missing', () => {
    const combo = trick({ id: 'whip-to-bar', diff: 5, pre: ['tailwhip', 'bar-spin'] });
    expect(missingPrereqs(combo, byId({ tailwhip: 'most' }))).toEqual(['bar-spin']);
    expect(missingPrereqs(combo, byId({ tailwhip: 'most', 'bar-spin': 'every' }))).toEqual([]);
  });

  it('reads the shipped graph: a manual needs a bunny hop', () => {
    const manual = trickById('manual');
    expect(manual?.pre).toEqual(['bunny-hop']);
    expect(isTrickUnlocked(manual!, {})).toBe(false);
    expect(isTrickUnlocked(manual!, { 'bunny-hop': 'some' })).toBe(true);
  });

  it('keeps the paywall and the prerequisite lock independent', () => {
    // A rookie who has landed a bunny hop has *unlocked* the bar spin and is
    // still *locked out* of it. The skill tree draws these differently.
    //
    // Written with the tailwhip, then the bar spin, and both of those are free
    // now (#75, then the 2026-09-04 free-tier reshape). The no-footer is the
    // same shape — difficulty 3, park, bunny hop prerequisite — and still paid.
    const noFooter = trickById('no-footer')!;
    expect(isTrickUnlocked(noFooter, { 'bunny-hop': 'every' })).toBe(true);
    expect(isTrickLocked(noFooter, 'rookie')).toBe(true);
  });
});

describe('lookups and scoping', () => {
  it('finds a trick by id and reports its sport', () => {
    expect(trickById('sk-kickflip')?.name).toBe('Kickflip');
    expect(sportOf('sk-kickflip')).toBe('skate');
    expect(sportOf('tailwhip')).toBe('scooter');
  });

  it('returns undefined for an id that is not in the library', () => {
    expect(trickById('nope')).toBeUndefined();
    expect(sportOf('nope')).toBeUndefined();
  });

  it('scopes by sport, and treats no sport as everything', () => {
    for (const sport of ['scooter', 'skate', 'bmx'] as const) {
      expect(tricksFor(sport), sport).toHaveLength(TRICKS.filter((t) => t.sport === sport).length);
      expect(tricksFor(sport).length, sport).toBeGreaterThan(0);
    }
    expect(tricksFor(null)).toHaveLength(TRICKS.length);
    expect(tricksFor()).toHaveLength(TRICKS.length);
  });

  it('scopes by category within a sport', () => {
    const flat = TRICKS.filter((t) => t.cat === 'flat');
    for (const sport of ['scooter', 'skate', 'bmx'] as const) {
      expect(tricksInCategory('flat', sport), sport).toHaveLength(
        flat.filter((t) => t.sport === sport).length,
      );
    }
    expect(tricksInCategory('flat')).toHaveLength(flat.length);
    expect(tricksInCategory('flat').length).toBeGreaterThan(0);
  });
});

describe('what to try next', () => {
  it('suggests only tricks that are unlocked, untracked and paid for', () => {
    const suggestions = suggestedNextTricks({}, 'rookie', 'scooter');
    // Nothing landed yet, so only no-prerequisite free scooter tricks qualify.
    // `x-up` used to be here and is paid since the 2026-09-04 free-tier shape.
    expect(suggestions.map((t) => t.id).sort()).toEqual(['bunny-hop', 'fakie', 'pump', 'tic-tac']);
  });

  it('opens up the next layer once a prerequisite is landed', () => {
    const suggestions = suggestedNextTricks({ 'bunny-hop': 'some' }, 'rookie', 'scooter');
    const suggested = suggestions.map((t) => t.id);
    expect(suggested).not.toContain('bunny-hop'); // already landed
    expect(suggested).toContain('50-50'); // diff 2 and free, prerequisite met
    expect(suggested).toContain('tailwhip'); // diff 3 but freed — see #75
    expect(suggested).not.toContain('manual'); // diff 2 but paid since 4 Sep
    expect(suggested).not.toContain('no-footer'); // diff 3, behind the paywall
  });

  it('offers the paid rider the tricks the rookie could not have', () => {
    const suggested = suggestedNextTricks({ 'bunny-hop': 'some' }, 'shredder', 'scooter').map(
      (t) => t.id,
    );
    // Was the tailwhip, then the bar spin; both are free now and so proved
    // nothing about the paid tier. The no-footer is the same shape and paid.
    expect(suggested).toContain('no-footer');
  });

  it('ignores hidden tricks', () => {
    const library = [
      trick({ id: 'visible', diff: 1 }),
      trick({ id: 'hidden', diff: 1, isLive: false }),
    ];
    expect(suggestedNextTricks({}, 'rookie', 'scooter', library).map((t) => t.id)).toEqual([
      'visible',
    ]);
  });
});
