import { SPORT_IDS, type SportId } from '@landit/core';
import { describe, expect, it } from 'vitest';

import { sportFilterProperty, toggleSport } from './sportFilter';

describe('choosing sports in the filter row', () => {
  it('adds a sport that was not chosen and removes one that was', () => {
    expect(toggleSport([], 'skate')).toEqual(['skate']);
    expect(toggleSport(['skate'], 'skate')).toEqual([]);
  });

  it('keeps the chosen sports in SPORT_IDS order, whatever order they were pressed', () => {
    // The spots screen keys its fetch cache on this list, so "BMX then scooter"
    // and "scooter then BMX" have to be the same query rather than two.
    expect(toggleSport(['bmx'], 'scooter')).toEqual(['scooter', 'bmx']);
    expect(toggleSport(['scooter'], 'bmx')).toEqual(['scooter', 'bmx']);
  });

  it('lands back on every sport when the last chosen one is pressed off', () => {
    // Empty is "every sport", so un-pressing your only pill widens the list
    // rather than emptying the screen.
    expect(toggleSport(['bmx'], 'bmx')).toEqual([]);
  });

  it('never invents a sport the product does not have', () => {
    const everything = SPORT_IDS.reduce<readonly SportId[]>(
      (chosen, id) => toggleSport(chosen, id),
      [],
    );
    expect(everything).toEqual([...SPORT_IDS]);
  });
});

describe('what the filter reports to analytics', () => {
  it('calls nothing chosen and everything chosen the same thing', () => {
    // One state on screen must be one value in the funnel.
    expect(sportFilterProperty([])).toBe('all');
    expect(sportFilterProperty([...SPORT_IDS])).toBe('all');
  });

  it('joins a real narrowing with a plus, in SPORT_IDS order', () => {
    expect(sportFilterProperty(['bmx'])).toBe('bmx');
    expect(sportFilterProperty(['scooter', 'bmx'])).toBe('scooter+bmx');
  });

  it('sends nothing a rider could have typed', () => {
    for (const id of SPORT_IDS) expect(sportFilterProperty([id])).toBe(id);
  });
});
