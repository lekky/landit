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

  it('splits the shipped library 29 free / 68 paid', () => {
    // Read through `Trick`: the canonical data is `as const`, so a trick with
    // no override has no `free` key in its inferred type at all.
    const library: readonly Trick[] = TRICKS;
    const free = library.filter(isTrickFree);
    expect(free).toHaveLength(29);
    expect(library.filter((t) => !isTrickFree(t))).toHaveLength(68);

    // Exactly one trick overrides difficulty, and it is named here on purpose:
    // an override is how the free tier silently grows, so a second one appearing
    // should fail this test and be argued for rather than noticed later.
    const overridden = library.filter((t) => t.free !== undefined);
    expect(overridden.map((t) => t.id)).toEqual(['bmx-double-peg']);
    expect(overridden[0]?.free).toBe(true);

    // Everything else is the Rookie and Easy tiers, nothing more.
    expect(free.every((t) => t.diff <= FREE_MAX_DIFF || t.free === true)).toBe(true);
    expect(library.every((t) => t.diff > FREE_MAX_DIFF || isTrickFree(t))).toBe(true);
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
    expect(openTricks('shredder')).toHaveLength(97);
    expect(openTricks('legend')).toHaveLength(97);
    expect(openTricks('rookie').every(isTrickFree)).toBe(true);
    expect(openTricks('rookie').length).toBeLessThan(97);
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
    // A rookie who has landed a bunny hop has *unlocked* the tailwhip and is
    // still *locked out* of it. The skill tree draws these differently.
    const tailwhip = trickById('tailwhip')!;
    expect(isTrickUnlocked(tailwhip, { 'bunny-hop': 'every' })).toBe(true);
    expect(isTrickLocked(tailwhip, 'rookie')).toBe(true);
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
    expect(tricksFor('scooter')).toHaveLength(30);
    expect(tricksFor('skate')).toHaveLength(31);
    expect(tricksFor('bmx')).toHaveLength(36);
    expect(tricksFor(null)).toHaveLength(97);
    expect(tricksFor()).toHaveLength(97);
  });

  it('scopes by category within a sport', () => {
    expect(tricksInCategory('flat', 'scooter')).toHaveLength(7);
    expect(tricksInCategory('flat', 'skate')).toHaveLength(10);
    expect(tricksInCategory('flat', 'bmx')).toHaveLength(11);
    expect(tricksInCategory('flat')).toHaveLength(28);
  });
});

describe('what to try next', () => {
  it('suggests only tricks that are unlocked, untracked and paid for', () => {
    const suggestions = suggestedNextTricks({}, 'rookie', 'scooter');
    // Nothing landed yet, so only no-prerequisite free scooter tricks qualify.
    expect(suggestions.map((t) => t.id).sort()).toEqual(['bunny-hop', 'tic-tac', 'x-up']);
  });

  it('opens up the next layer once a prerequisite is landed', () => {
    const suggestions = suggestedNextTricks({ 'bunny-hop': 'some' }, 'rookie', 'scooter');
    const suggested = suggestions.map((t) => t.id);
    expect(suggested).not.toContain('bunny-hop'); // already landed
    expect(suggested).toContain('manual'); // diff 2, prerequisite met
    expect(suggested).not.toContain('tailwhip'); // diff 3, behind the paywall
  });

  it('offers the paid rider the tricks the rookie could not have', () => {
    const suggested = suggestedNextTricks({ 'bunny-hop': 'some' }, 'shredder', 'scooter').map(
      (t) => t.id,
    );
    expect(suggested).toContain('tailwhip');
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
