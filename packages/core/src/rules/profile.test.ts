import { describe, expect, it } from 'vitest';

import { goalLabel, goalsFor, isValidCustomGoal } from './profile';

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
