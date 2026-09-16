import { SPORTS, SPORT_IDS } from '@landit/core';
import { describe, expect, it } from 'vitest';

import {
  readScope,
  scopeOptions,
  scopeProperty,
  scopeSports,
  scopeStorageKey,
  type SportScope,
} from './sportScope';

describe('what a scope narrows the list to', () => {
  it('follows the chip, so switching the chip switches the list', () => {
    // The whole point of O1's first option: one sport choice in the product,
    // made in the top bar, and a list that answers to it.
    expect(scopeSports('chip', 'scooter')).toEqual(['scooter']);
    expect(scopeSports('chip', 'bmx')).toEqual(['bmx']);
  });

  it('narrows to a sport chosen by name whatever the chip says', () => {
    expect(scopeSports('bmx', 'scooter')).toEqual(['bmx']);
  });

  it('asks for nothing at all when the scope is every sport', () => {
    // Empty is what both query builders read as unfiltered. `SPORT_IDS` would
    // be the same list after three `:each` scans of a JSON column.
    expect(scopeSports('all', 'scooter')).toEqual([]);
  });

  it('gives the same list for "your sport" as for that sport by name', () => {
    for (const id of SPORT_IDS) {
      expect(scopeSports('chip', id)).toEqual(scopeSports(id, id));
    }
  });
});

describe('a choice read back off the device', () => {
  it('keeps a scope this build knows', () => {
    expect(readScope('all', 'chip')).toBe('all');
    expect(readScope('chip', 'all')).toBe('chip');
    expect(readScope('bmx', 'all')).toBe('bmx');
  });

  it('falls back to the screen default rather than to an empty list', () => {
    // A retired sport, an older build's value, or junk in somebody's own
    // storage. None of them may leave a rider on a screen with no spots on it
    // and nothing saying why.
    expect(readScope('unicycle', 'all')).toBe('all');
    expect(readScope('', 'chip')).toBe('chip');
    expect(readScope(null, 'all')).toBe('all');
  });

  it('keeps one key per screen', () => {
    expect(scopeStorageKey('spots')).toBe('landit.scope.spots');
    expect(scopeStorageKey('events')).toBe('landit.scope.events');
    expect(scopeStorageKey('spots')).not.toBe(scopeStorageKey('events'));
  });
});

describe('what the scope reports to analytics', () => {
  it('names the two catalogue scopes as themselves', () => {
    expect(scopeProperty('chip')).toBe('chip');
    expect(scopeProperty('all')).toBe('all');
  });

  it('never sends which other sport was chosen', () => {
    // "The sport this rider picked that is not the one they ride" is a rider
    // fact; `other` is a catalogue one. Every sport there is collapses to it,
    // so no reading of this funnel can name one.
    const values = SPORT_IDS.map((id) => scopeProperty(id as SportScope));
    expect(new Set(values)).toEqual(new Set(['other']));
  });
});

describe('the options a rider is offered', () => {
  it('opens with their own sport, named, then every sport', () => {
    const options = scopeOptions('scooter', 'Every spot');
    expect(options[0]).toEqual({ value: 'chip', label: `Your sport (${SPORTS.scooter.short})` });
    expect(options[1]).toEqual({ value: 'all', label: 'Every spot' });
  });

  it('takes the screen its own words for "all"', () => {
    // A calendar offering "Every spot" would be describing the wrong noun.
    expect(scopeOptions('scooter', 'All sports')[1]?.label).toBe('All sports');
  });

  it('lists every other sport once, and never the chip’s own a second time', () => {
    for (const chip of SPORT_IDS) {
      const options = scopeOptions(chip, 'All sports');
      expect(options).toHaveLength(SPORT_IDS.length + 1);
      const others = options.slice(2).map((option) => option.value);
      expect(others).toEqual(SPORT_IDS.filter((id) => id !== chip));
    }
  });
});
