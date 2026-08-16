import { describe, expect, it } from 'vitest';

import { HANDLE_MAX_LENGTH, RESERVED_HANDLES } from '../data/profile';

import {
  goalLabel,
  goalsFor,
  handleCandidates,
  handleFromName,
  handleProblem,
  isValidCustomGoal,
  isValidHandle,
  normaliseHandle,
} from './profile';

describe('which goals to offer', () => {
  it('offers the shared goals whatever the rider rides', () => {
    const scooter = goalsFor(['scooter']).map((g) => g.id);
    expect(scooter).toContain('first');
    expect(scooter).toContain('all');
  });

  it('only offers a sport’s goals to riders of that sport', () => {
    expect(goalsFor(['scooter']).map((g) => g.id)).toContain('whip');
    expect(goalsFor(['scooter']).map((g) => g.id)).not.toContain('kickflip');
    expect(goalsFor(['skate']).map((g) => g.id)).toContain('kickflip');
    expect(goalsFor(['scooter', 'skate']).map((g) => g.id)).toEqual(
      expect.arrayContaining(['whip', 'kickflip']),
    );
  });
});

describe('printing the goal on the dashboard', () => {
  it('uses the picked goal’s label', () => {
    expect(goalLabel('whip')).toBe('Get a tailwhip');
  });

  it('uses what the rider wrote, trimmed', () => {
    expect(goalLabel('custom', '  Land a bri flip  ')).toBe('Land a bri flip');
  });

  it('falls back rather than printing an empty line', () => {
    expect(goalLabel('custom', '   ')).toBe('Your own goal');
    expect(goalLabel('custom', null)).toBe('Your own goal');
  });

  it('returns null when there is no goal to print', () => {
    expect(goalLabel(null)).toBeNull();
    expect(goalLabel('a-goal-that-was-removed')).toBeNull();
  });
});

describe('a written goal', () => {
  it('has to say something, and fit on the dashboard', () => {
    expect(isValidCustomGoal('Land a bri flip before the summer holidays')).toBe(true);
    expect(isValidCustomGoal('')).toBe(false);
    expect(isValidCustomGoal('   ')).toBe(false);
    expect(isValidCustomGoal('x'.repeat(60))).toBe(true);
    expect(isValidCustomGoal('x'.repeat(61))).toBe(false);
  });
});

describe('handles', () => {
  it('stores what a rider typed, lowercased and trimmed', () => {
    expect(normaliseHandle('  Nia  ')).toBe('nia');
    expect(normaliseHandle(null)).toBe('');
  });

  it('accepts the shape the migration and the hook accept', () => {
    expect(isValidHandle('miles')).toBe(true);
    expect(isValidHandle('miles_c')).toBe(true);
    expect(isValidHandle('m1')).toBe(true);
    expect(isValidHandle('MILES')).toBe(true); // normalised first
    expect(isValidHandle('m')).toBe(false); // one character
    expect(isValidHandle('_miles')).toBe(false); // leading underscore
    expect(isValidHandle('miles_')).toBe(false); // trailing underscore
    expect(isValidHandle('miles.c')).toBe(false); // full stop
    expect(isValidHandle('x'.repeat(HANDLE_MAX_LENGTH + 1))).toBe(false);
  });

  it('refuses a reserved handle', () => {
    expect(isValidHandle('admin')).toBe(false);
    expect(isValidHandle('landit')).toBe(false);
    expect(isValidHandle('Settings')).toBe(false);
    // The whole list, not just the ones this test names.
    for (const reserved of RESERVED_HANDLES) {
      if (reserved.includes('-')) continue; // `land-it` cannot be typed as a handle anyway
      expect(isValidHandle(reserved)).toBe(false);
    }
  });

  it('says why, in words a rider can act on', () => {
    expect(handleProblem('miles')).toBeNull();
    expect(handleProblem('')).toMatch(/pick a handle/i);
    expect(handleProblem('m')).toMatch(/at least/i);
    expect(handleProblem('x'.repeat(21))).toMatch(/at most/i);
    expect(handleProblem('miles!')).toMatch(/lowercase/i);
    expect(handleProblem('admin')).toMatch(/reserved/i);
  });

  it('suggests one from the name a rider gave', () => {
    expect(handleFromName('Miles')).toBe('miles');
    expect(handleFromName('Miles Carter')).toBe('milescarter');
    expect(handleFromName('Zoë Márquez')).toBe('zoemarquez');
    expect(handleFromName('鈴木')).toBe(''); // nothing the pattern admits
    expect(handleFromName('Admin')).toBe(''); // reserved, so not suggested
  });

  it('always produces candidates, even from a name that yields nothing', () => {
    expect(handleCandidates('Miles').slice(0, 3)).toEqual(['miles', 'miles2', 'miles3']);
    expect(handleCandidates('Al').slice(0, 2)).toEqual(['al', 'al2']);
    // A single character is not a handle; the candidates still are.
    expect(handleCandidates('A').every((c) => isValidHandle(c))).toBe(true);
    expect(handleCandidates('A').length).toBeGreaterThan(0);
    expect(handleCandidates('鈴木').every((c) => isValidHandle(c))).toBe(true);
    expect(handleCandidates('').length).toBeGreaterThan(0);
  });

  it('keeps a long name inside the length limit once numbered', () => {
    for (const candidate of handleCandidates('Bartholomew Fitzgerald Smythe')) {
      expect(candidate.length).toBeLessThanOrEqual(HANDLE_MAX_LENGTH);
      expect(isValidHandle(candidate)).toBe(true);
    }
  });

  it('never suggests a reserved handle', () => {
    expect(handleCandidates('Admin')).not.toContain('admin');
    expect(handleCandidates('Admin').every((c) => isValidHandle(c))).toBe(true);
  });
});
