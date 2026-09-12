import { describe, expect, it } from 'vitest';

import { TRICKS } from '../data/tricks';
import type { StageId, Trick } from '../types';
import {
  FREE_MAX_DIFF,
  TRICK_CONTENT_LIMITS,
  crossSportEquivalents,
  fullPrereqChain,
  isLandedStage,
  isTrickFree,
  isTrickLanded,
  isTrickLocked,
  isTrickUnlocked,
  missingPrereqs,
  openTricks,
  planUnlocksPaidTricks,
  similarTricks,
  sportOf,
  suggestedNextTricks,
  trickById,
  trickContentProblems,
  trickPositionFacts,
  tricksFor,
  tricksInCategory,
  wordCount,
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

  it('splits the shipped library 60 free / 199 paid, twenty free per sport', () => {
    // Read through `Trick`: the canonical data is `as const`, so a trick with
    // no override has no `free` key in its inferred type at all.
    const library: readonly Trick[] = TRICKS;
    const free = library.filter(isTrickFree);
    expect(free).toHaveLength(60);
    expect(library.filter((t) => !isTrickFree(t))).toHaveLength(library.length - 60);

    /*
     * The free tier is a fixed twenty per sport: every Rookie trick, a fill of
     * Easy, four Spicy and two Gnarly, nothing at Pro (owner, 2026-09-12, in
     * chat; the reasoning is written down above `TRICKS` in
     * `../data/tricks.ts`). It doubles the ten of 2026-09-04.
     *
     * Named here on purpose, and this is the point of the test: `free` is how
     * the free tier moves silently, so a swap has to be argued for in a diff
     * rather than noticed a month later on the plans page. `../data/data.test`
     * asserts the *shape* — the per-difficulty counts and the prerequisite
     * closure that makes every one of them reachable — which is the part that
     * must hold whichever tricks fill the slots.
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
        'kickturn',
        'tail-tap',
        'pump',
        '180',
        '50-50',
        'drop-in',
        'manual',
        'quarter-pipe-air',
        'gap',
        'hippie-jump',
        'acid-drop',
        'tailwhip',
        'bar-spin',
        'nose-manual',
        'boardslide',
        '360',
        'bar-to-whip',
      ].sort(),
    );
    expect(freeIds('skate')).toEqual(
      [
        'sk-kickturn',
        'sk-tic-tac',
        'sk-fakie-roll',
        'sk-curb-drop',
        'sk-ramp-kickturn',
        'sk-pump',
        'sk-ollie',
        'sk-manual',
        'sk-drop-in',
        'sk-shuvit',
        'sk-fakie-ollie',
        'sk-curb-ollie',
        'sk-rock-to-fakie',
        'sk-powerslide',
        'sk-kickflip',
        'sk-50-50',
        'sk-axle-stall',
        'sk-indy',
        'sk-wallride',
        'sk-backside-air',
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
        'bmx-manual',
        'bmx-fakie',
        'bmx-x-up',
        'bmx-nollie',
        'bmx-180',
        'bmx-hop-on-off',
        'bmx-double-peg-stall',
        'bmx-double-peg',
        'bmx-one-hander',
        'bmx-wallride',
        'bmx-half-cab',
        'bmx-flyout-tailwhip',
        'bmx-360',
      ].sort(),
    );

    /*
     * **No difficulty-1 trick is paid**, in any sport. It was true until
     * 2026-09-04, false while the tier was ten (four slots against six Rookie
     * entries in scooter and skate), and is true again at twenty because the
     * Rookie slot is now "all of them" rather than a count. Asserted rather
     * than assumed: it is the half of the shape a staff edit could undo without
     * moving any of the counts `../data/data.test` pins.
     */
    expect(library.filter((t) => t.diff === 1 && !isTrickFree(t))).toEqual([]);

    /*
     * Every trick that was free when the tier was ten is still free at twenty.
     * A rider may already hold `trick_progress` on one, and taking a trick back
     * behind the paywall strands that progress somewhere they can see it and
     * not touch it.
     */
    const freeAtTen = [
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
    ];
    const stillFree = new Set(free.map((t) => t.id));
    for (const id of freeAtTen) expect(stillFree.has(id), `${id} was free at ten`).toBe(true);

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
    // `x-up` is still paid; `kickturn` came back into the free tier on
    // 2026-09-12, when Rookie became "every difficulty-1 trick" rather than a
    // count of four. `chairman` is the sport's other no-prerequisite trick and
    // stays paid, which is what keeps this list from being "everything easy".
    expect(suggestions.map((t) => t.id).sort()).toEqual([
      'bunny-hop',
      'fakie',
      'kickturn',
      'pump',
      'tic-tac',
    ]);
  });

  it('opens up the next layer once a prerequisite is landed', () => {
    const suggestions = suggestedNextTricks({ 'bunny-hop': 'some' }, 'rookie', 'scooter');
    const suggested = suggestions.map((t) => t.id);
    expect(suggested).not.toContain('bunny-hop'); // already landed
    expect(suggested).toContain('50-50'); // diff 2 and free, prerequisite met
    expect(suggested).toContain('tailwhip'); // diff 3 but freed — see #75
    expect(suggested).toContain('manual'); // diff 2, freed by the 12 Sep twenty
    expect(suggested).not.toContain('x-up'); // diff 2, unlocked, still paid
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

describe('cross-sport equivalents', () => {
  it('returns the same movement in the other sports, scooter then skate then BMX', () => {
    expect(crossSportEquivalents('sk-ollie').map((t) => t.id)).toEqual([
      'bunny-hop',
      'bmx-bunny-hop',
    ]);
    expect(crossSportEquivalents('bmx-bunny-hop').map((t) => t.id)).toEqual([
      'bunny-hop',
      'sk-ollie',
    ]);
  });

  it('returns nothing for a trick with no equivalent, or an id it does not know', () => {
    // A fingerwhip is a scooter trick and nothing else's.
    expect(crossSportEquivalents('fingerwhip')).toEqual([]);
    expect(crossSportEquivalents('not-a-trick')).toEqual([]);
  });

  it('reads the live rows, so a hidden equivalent drops out', () => {
    const live = TRICKS.map((t) => (t.id === 'sk-ollie' ? { ...t, isLive: false } : t));
    expect(crossSportEquivalents('bunny-hop', live).map((t) => t.id)).toEqual(['bmx-bunny-hop']);
    // And one the list does not carry at all is simply not there.
    const without = TRICKS.filter((t) => t.id !== 'bmx-bunny-hop');
    expect(crossSportEquivalents('bunny-hop', without).map((t) => t.id)).toEqual(['sk-ollie']);
  });
});

describe('trick content limits', () => {
  const ok = [
    { what: 'Leaning back.', fix: 'Shoulders forward.' },
    { what: 'Looking down.', fix: 'Eyes up.' },
    { what: 'Stiff legs.', fix: 'Bend the knees.' },
  ];
  const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

  it('counts words as runs of non-space characters', () => {
    expect(wordCount('')).toBe(0);
    expect(wordCount('   ')).toBe(0);
    expect(wordCount('one')).toBe(1);
    expect(wordCount('  two   words \n here ')).toBe(3);
  });

  it('allows nothing written yet, and three or four mistakes', () => {
    expect(trickContentProblems(undefined, undefined)).toEqual([]);
    expect(trickContentProblems([], '')).toEqual([]);
    expect(trickContentProblems(ok, 'Easy.')).toEqual([]);
    expect(trickContentProblems([...ok, ok[0]!], 'Easy.')).toEqual([]);
  });

  it('refuses one, two or five mistakes', () => {
    expect(trickContentProblems(ok.slice(0, 1), '')).toHaveLength(1);
    expect(trickContentProblems(ok.slice(0, 2), '')).toHaveLength(1);
    expect(trickContentProblems([...ok, ok[0]!, ok[1]!], '')).toHaveLength(1);
  });

  it('holds each part to its limit, and accepts the edge', () => {
    const L = TRICK_CONTENT_LIMITS;
    const at = [
      { what: `${words(L.whatMaxWords - 1)}.`, fix: words(L.fixMaxWords) },
      ...ok.slice(1),
    ];
    expect(trickContentProblems(at, words(L.hardMaxWords))).toEqual([]);

    const over = (m: (typeof ok)[number]) => trickContentProblems([m, ...ok.slice(1)], '');
    expect(over({ what: `${words(L.whatMaxWords + 1)}.`, fix: 'Fix.' })).toEqual([
      `Mistake 1: keep "what" to ${L.whatMaxWords} words.`,
    ]);
    expect(over({ what: 'No stop', fix: 'Fix.' })).toEqual([
      'Mistake 1: end "what" with a full stop.',
    ]);
    expect(over({ what: 'Short.', fix: words(L.fixMaxWords + 1) })).toEqual([
      `Mistake 1: keep the fix to ${L.fixMaxWords} words.`,
    ]);
    expect(over({ what: 'Short.', fix: '  ' })).toEqual([
      'Mistake 1 needs both the mistake and the fix.',
    ]);
    expect(trickContentProblems(ok, words(L.hardMaxWords + 1))).toEqual([
      `Keep "why it’s this tier" to ${L.hardMaxWords} words.`,
    ]);
  });

  it('reports every problem, not just the first', () => {
    const problems = trickContentProblems([{ what: 'No stop', fix: '' }, ok[1]!], words(40));
    expect(problems.length).toBeGreaterThanOrEqual(3);
  });
});

describe('the road to a trick (T31)', () => {
  // A chain, a diamond, a two-parent trick, a hidden prerequisite and a cycle.
  const library: Trick[] = [
    trick({ id: 'hop', diff: 1 }),
    trick({ id: 'whip', diff: 3, pre: ['hop'] }),
    trick({ id: 'flip', diff: 4 }),
    // Two prerequisites: the whip's chain is longer, so it is the road and the
    // flip hangs off the last step — even though the flip is listed first.
    trick({ id: 'flip-whip', diff: 5, pre: ['flip', 'whip'] }),
    // A diamond: `hop` is already on the road through `whip`, so it is not
    // repeated as an aside.
    trick({ id: 'whip-late', diff: 4, pre: ['whip', 'hop'] }),
    trick({ id: 'ghost', diff: 2, isLive: false }),
    trick({ id: 'haunted', diff: 3, pre: ['ghost', 'hop'] }),
    trick({ id: 'loop-a', diff: 2, pre: ['loop-b'] }),
    trick({ id: 'loop-b', diff: 2, pre: ['loop-a'] }),
  ];
  const road = (id: string) =>
    fullPrereqChain(trickById(id, library)!, library).map((s) => s.trick.id);

  it('runs root first and ends on the trick itself', () => {
    expect(road('whip')).toEqual(['hop', 'whip']);
    expect(road('hop')).toEqual(['hop']);
  });

  it('takes the longer chain as the road and hangs the other prerequisite off the step', () => {
    const steps = fullPrereqChain(trickById('flip-whip', library)!, library);
    expect(steps.map((s) => s.trick.id)).toEqual(['hop', 'whip', 'flip-whip']);
    expect(steps.map((s) => s.also.map((t) => t.id))).toEqual([[], [], ['flip']]);
  });

  it('does not repeat a prerequisite that is already on the road', () => {
    const steps = fullPrereqChain(trickById('whip-late', library)!, library);
    expect(steps.map((s) => s.trick.id)).toEqual(['hop', 'whip', 'whip-late']);
    expect(steps[2]?.also).toEqual([]);
  });

  it('drops hidden and unknown prerequisites the way the pills do', () => {
    expect(road('haunted')).toEqual(['hop', 'haunted']);
    const orphan = trick({ id: 'orphan', diff: 2, pre: ['nobody'] });
    expect(fullPrereqChain(orphan, [...library, orphan]).map((s) => s.trick.id)).toEqual([
      'orphan',
    ]);
  });

  it('cuts a cycle where it closes rather than following it', () => {
    expect(road('loop-a')).toEqual(['loop-b', 'loop-a']);
  });

  it('walks the real library with every road ending on its own trick', () => {
    for (const t of TRICKS) {
      const steps = fullPrereqChain(t);
      expect(steps.at(-1)?.trick.id).toBe(t.id);
      expect(new Set(steps.map((s) => s.trick.id)).size).toBe(steps.length);
    }
  });
});

describe('where a trick sits (T31)', () => {
  const library: Trick[] = [
    trick({ id: 'a', diff: 3, cat: 'park' }),
    trick({ id: 'b', diff: 3, cat: 'park' }),
    trick({ id: 'c', diff: 3, cat: 'park', isLive: false }),
    trick({ id: 'd', diff: 4, cat: 'park' }),
    trick({ id: 'e', diff: 3, cat: 'flat' }),
    trick({ id: 'f', diff: 3, cat: 'park', sport: 'skate' }),
  ];

  it('counts live peers on the same shelf, the sport, and names the tier', () => {
    expect(trickPositionFacts(trickById('a', library)!, library)).toEqual({
      peers: 2,
      inSport: 4,
      tier: 'Spicy',
      diff: 3,
    });
  });

  it('counts the trick itself even when it is hidden', () => {
    expect(trickPositionFacts(trickById('c', library)!, library).peers).toBe(3);
  });

  it('never says zero of anything', () => {
    const alone = trick({ id: 'alone', diff: 5, cat: 'air', sport: 'bmx' });
    expect(trickPositionFacts(alone, library)).toMatchObject({ peers: 1, inSport: 1 });
  });
});

describe('more like this (T31)', () => {
  const library: Trick[] = [
    trick({ id: 'me', name: 'Me', diff: 3, cat: 'park' }),
    trick({ id: 'z', name: 'Zed', diff: 3, cat: 'park' }),
    trick({ id: 'a', name: 'Ay', diff: 3, cat: 'park' }),
    trick({ id: 'up', name: 'Up', diff: 4, cat: 'park' }),
    trick({ id: 'down', name: 'Down', diff: 2, cat: 'park' }),
    trick({ id: 'far', name: 'Far', diff: 5, cat: 'park' }),
    trick({ id: 'flat', name: 'Flat', diff: 3, cat: 'flat' }),
    trick({ id: 'skate', name: 'Skate', diff: 3, cat: 'park', sport: 'skate' }),
    trick({ id: 'hidden', name: 'Aardvark', diff: 3, cat: 'park', isLive: false }),
  ];
  const me = trickById('me', library)!;

  it('keeps the sport and category, stays within one difficulty, and skips itself', () => {
    expect(similarTricks(me, library, 10).map((t) => t.id)).toEqual(['a', 'z', 'down', 'up']);
  });

  it('cuts to four by default', () => {
    expect(similarTricks(me, library)).toHaveLength(4);
    expect(similarTricks(me, library, 2).map((t) => t.id)).toEqual(['a', 'z']);
  });

  it('never suggests a hidden trick', () => {
    expect(similarTricks(me, library, 10).some((t) => t.id === 'hidden')).toBe(false);
  });
});
