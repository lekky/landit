import { describe, expect, it } from 'vitest';

import { TRICKS } from '../data/tricks';
import type { Difficulty, StageId, Trick } from '../types';
import {
  TRICK_SORTS,
  TRICK_STATUS_FILTERS,
  activeFilterCount,
  filterTricks,
  prereqTricks,
  sortTricks,
  trickMatchesSearch,
  trickMatchesStatus,
  tricksUnlockedBy,
} from './library';

const trick = (over: Partial<Trick> & Pick<Trick, 'id'>): Trick => ({
  name: over.id,
  sport: 'scooter',
  cat: 'flat',
  diff: 1 as Difficulty,
  pre: [],
  about: '',
  tips: '',
  fact: '',
  isLive: true,
  ...over,
});

const library: Trick[] = [
  trick({ id: 'bunny-hop', name: 'Bunny hop', diff: 1, about: 'The foundation under every trick' }),
  trick({ id: 'tailwhip', name: 'Tailwhip', diff: 3, cat: 'park', pre: ['bunny-hop'] }),
  trick({ id: 'barspin', name: 'Barspin', diff: 2, cat: 'street', pre: ['bunny-hop'] }),
  trick({ id: 'kickflip', name: 'Kickflip', diff: 3, sport: 'skate' }),
  trick({ id: 'retired', name: 'Retired move', diff: 1, isLive: false }),
];

const byId: Record<string, StageId> = {
  'bunny-hop': 'every',
  tailwhip: 'trying',
  barspin: 'want',
};

describe('search', () => {
  it('matches the name, the lowdown and the category label', () => {
    const [hop] = library;
    expect(trickMatchesSearch(hop!, 'bunny')).toBe(true);
    expect(trickMatchesSearch(hop!, 'foundation')).toBe(true);
    expect(trickMatchesSearch(hop!, 'flat')).toBe(true);
    expect(trickMatchesSearch(hop!, 'grind')).toBe(false);
  });

  it('ignores case and surrounding space, and an empty term matches everything', () => {
    const [hop] = library;
    expect(trickMatchesSearch(hop!, '  BUNNY  ')).toBe(true);
    expect(trickMatchesSearch(hop!, '')).toBe(true);
    expect(trickMatchesSearch(hop!, '   ')).toBe(true);
  });

  it('resolves the category label for the trick’s own sport', () => {
    // BMX calls `flat` "Flatground" (plan §7 T21), so a BMX rider searching the
    // word they are shown has to find the tricks behind it.
    const bmx = trick({ id: 'bmx-hop', sport: 'bmx', cat: 'flat' });
    expect(trickMatchesSearch(bmx, 'flatground')).toBe(true);
    const scooter = trick({ id: 'scoot-hop', sport: 'scooter', cat: 'flat' });
    expect(trickMatchesSearch(scooter, 'flatground')).toBe(false);
  });
});

describe('the my-status filter', () => {
  it('reads an untracked trick as "not tracked"', () => {
    expect(trickMatchesStatus(undefined, 'none')).toBe(true);
    expect(trickMatchesStatus(undefined, 'tracked')).toBe(false);
    expect(trickMatchesStatus('want', 'none')).toBe(false);
  });

  it('counts some, most and every as landed', () => {
    for (const stage of ['some', 'most', 'every'] as StageId[]) {
      expect(trickMatchesStatus(stage, 'landed')).toBe(true);
    }
    expect(trickMatchesStatus('trying', 'landed')).toBe(false);
    expect(trickMatchesStatus('want', 'landed')).toBe(false);
  });

  it('matches want and trying exactly', () => {
    expect(trickMatchesStatus('want', 'want')).toBe(true);
    expect(trickMatchesStatus('trying', 'trying')).toBe(true);
    expect(trickMatchesStatus('want', 'trying')).toBe(false);
  });

  it('lets everything through on "all"', () => {
    expect(trickMatchesStatus(undefined, 'all')).toBe(true);
    expect(trickMatchesStatus('every', 'all')).toBe(true);
  });
});

describe('filtering the library', () => {
  it('returns the whole live library for an empty query', () => {
    const ids = filterTricks({}, library).map((t) => t.id);
    expect(ids).toHaveLength(4);
    expect(ids).not.toContain('retired');
  });

  it('never returns a hidden trick, whatever is asked for', () => {
    expect(filterTricks({ search: 'retired' }, library)).toHaveLength(0);
    expect(filterTricks({ category: 'flat', difficulty: 1 }, library).map((t) => t.id)).toEqual([
      'bunny-hop',
    ]);
  });

  it('narrows by sport', () => {
    expect(filterTricks({ sport: 'skate' }, library).map((t) => t.id)).toEqual(['kickflip']);
    expect(filterTricks({ sport: 'scooter' }, library)).toHaveLength(3);
  });

  it('narrows by category and difficulty', () => {
    expect(filterTricks({ category: 'park' }, library).map((t) => t.id)).toEqual(['tailwhip']);
    expect(
      filterTricks({ difficulty: 3 }, library)
        .map((t) => t.id)
        .sort(),
    ).toEqual(['kickflip', 'tailwhip']);
  });

  it('narrows by the rider’s own progress', () => {
    expect(filterTricks({ status: 'landed', byId }, library).map((t) => t.id)).toEqual([
      'bunny-hop',
    ]);
    expect(filterTricks({ status: 'none', byId }, library).map((t) => t.id)).toEqual(['kickflip']);
    expect(filterTricks({ status: 'trying', byId }, library).map((t) => t.id)).toEqual([
      'tailwhip',
    ]);
  });

  it('keeps a locked trick in the list — the card draws the lock, the query does not hide it', () => {
    // Difficulty 3 is behind the paywall on Rookie, and it is still listed.
    expect(filterTricks({}, library).map((t) => t.id)).toContain('tailwhip');
  });

  it('combines every narrowing at once', () => {
    const ids = filterTricks(
      { sport: 'scooter', category: 'street', status: 'want', search: 'bar', byId },
      library,
    ).map((t) => t.id);
    expect(ids).toEqual(['barspin']);
  });
});

describe('sorting', () => {
  it('goes easiest first by default, then by name', () => {
    expect(filterTricks({ sport: 'scooter' }, library).map((t) => t.id)).toEqual([
      'bunny-hop',
      'barspin',
      'tailwhip',
    ]);
  });

  it('reverses for hardest first', () => {
    expect(sortTricks(library, 'hardest').map((t) => t.diff)).toEqual([3, 3, 2, 1, 1]);
  });

  it('sorts A–Z case-insensitively', () => {
    expect(sortTricks(library, 'az').map((t) => t.name)).toEqual([
      'Barspin',
      'Bunny hop',
      'Kickflip',
      'Retired move',
      'Tailwhip',
    ]);
  });

  it('does not mutate the list it was given', () => {
    const original = [...library];
    sortTricks(library, 'hardest');
    expect(library).toEqual(original);
  });
});

describe('the active filter count', () => {
  it('counts the narrowing filters and ignores the sort', () => {
    expect(activeFilterCount({})).toBe(0);
    expect(activeFilterCount({ sort: 'az' })).toBe(0);
    expect(activeFilterCount({ status: 'all' })).toBe(0);
    expect(activeFilterCount({ category: 'park' })).toBe(1);
    expect(activeFilterCount({ category: 'park', difficulty: 3, status: 'landed' })).toBe(3);
  });
});

describe('the prerequisite graph, read both ways', () => {
  it('lists what a trick is built on', () => {
    const tailwhip = library[1]!;
    expect(prereqTricks(tailwhip, library).map((t) => t.id)).toEqual(['bunny-hop']);
  });

  it('lists what landing a trick opens up', () => {
    expect(tricksUnlockedBy('bunny-hop', library).map((t) => t.id)).toEqual([
      'tailwhip',
      'barspin',
    ]);
    expect(tricksUnlockedBy('kickflip', library)).toEqual([]);
  });

  it('drops prerequisites that name a trick nobody can see', () => {
    const built = trick({ id: 'built-on-nothing', pre: ['retired', 'no-such-trick'] });
    expect(prereqTricks(built, library)).toEqual([]);
  });
});

describe('against the real library', () => {
  it('finds tricks by a word from their description', () => {
    expect(filterTricks({ search: 'grind' }, TRICKS).length).toBeGreaterThan(0);
  });

  it('every sort and status option is one the filter understands', () => {
    for (const option of TRICK_STATUS_FILTERS) {
      expect(() => filterTricks({ status: option.id }, TRICKS)).not.toThrow();
    }
    for (const option of TRICK_SORTS) {
      expect(filterTricks({ sort: option.id }, TRICKS)).toHaveLength(
        TRICKS.filter((t) => t.isLive).length,
      );
    }
  });
});
