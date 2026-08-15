import { describe, expect, it } from 'vitest';

import { CHALLENGES } from '../data/challenges';
import type { Challenge } from '../types';
import {
  canLogChallenge,
  challengeProgress,
  challengeRangeLabel,
  challengeState,
  challengesFor,
  challengesOverlap,
  isDayInChallenge,
  liveChallenge,
  overlappingChallenges,
} from './challenges';

const challenge = (
  over: Partial<Challenge> & Pick<Challenge, 'id' | 'starts' | 'ends'>,
): Challenge => ({
  sport: 'scooter',
  week: 'Week 1',
  title: 'Test Week',
  blurb: '',
  goal: 3,
  reward: '',
  hue: '#000000',
  riders: '',
  verb: '',
  isLive: true,
  ...over,
});

const week = challenge({ id: 'w', starts: '2026-08-10', ends: '2026-08-16' });
const at = (iso: string, timezone = 'Europe/London') => ({ now: Date.parse(iso), timezone });

describe('challenge state is derived, never stored', () => {
  it('is upcoming before the first day', () => {
    expect(challengeState(week, at('2026-08-09T12:00:00Z'))).toBe('upcoming');
    // 23:00 UTC on the 9th is already the 10th in London, so it is live there:
    // the boundary is the rider's midnight, not UTC's.
    expect(challengeState(week, at('2026-08-09T23:00:00Z'))).toBe('live');
    expect(challengeState(week, at('2026-08-09T23:00:00Z', 'UTC'))).toBe('upcoming');
  });

  it('is live on the first day, the last day and every day between', () => {
    expect(challengeState(week, at('2026-08-10T00:01:00Z'))).toBe('live');
    expect(challengeState(week, at('2026-08-13T12:00:00Z'))).toBe('live');
    expect(challengeState(week, at('2026-08-16T22:00:00Z'))).toBe('live');
  });

  it('is past from the day after the last day', () => {
    expect(challengeState(week, at('2026-08-17T00:30:00Z'))).toBe('past');
  });

  it('ends when the rider’s Sunday ends, not the server’s', () => {
    // One instant, two answers: 13:00 UTC on the 16th is already the 17th in
    // Auckland, so their week is over while Los Angeles is still riding it.
    const instant = '2026-08-16T13:00:00Z';
    expect(challengeState(week, at(instant, 'Pacific/Auckland'))).toBe('past');
    expect(challengeState(week, at(instant, 'America/Los_Angeles'))).toBe('live');
  });

  it('answers for a single-day challenge too', () => {
    const oneDay = challenge({ id: 'one', starts: '2026-08-16', ends: '2026-08-16' });
    expect(challengeState(oneDay, at('2026-08-16T12:00:00Z'))).toBe('live');
    expect(challengeState(oneDay, at('2026-08-15T12:00:00Z'))).toBe('upcoming');
    expect(challengeState(oneDay, at('2026-08-17T12:00:00Z'))).toBe('past');
  });
});

describe('logging against a challenge', () => {
  it('is allowed only while the challenge is live', () => {
    expect(canLogChallenge(week, at('2026-08-13T12:00:00Z'))).toBe(true);
    expect(canLogChallenge(week, at('2026-08-09T12:00:00Z'))).toBe(false);
    expect(canLogChallenge(week, at('2026-08-17T12:00:00Z'))).toBe(false);
  });

  it('is refused for a challenge staff have pulled, even inside its dates', () => {
    const pulled = challenge({
      id: 'pulled',
      starts: '2026-08-10',
      ends: '2026-08-16',
      isLive: false,
    });
    expect(challengeState(pulled, at('2026-08-13T12:00:00Z'))).toBe('live');
    expect(canLogChallenge(pulled, at('2026-08-13T12:00:00Z'))).toBe(false);
  });

  it('reports progress against the goal, capped at it', () => {
    expect(challengeProgress(week, 0)).toEqual({ logged: 0, goal: 3, pct: 0, complete: false });
    expect(challengeProgress(week, 2)).toEqual({ logged: 2, goal: 3, pct: 67, complete: false });
    expect(challengeProgress(week, 3)).toEqual({ logged: 3, goal: 3, pct: 100, complete: true });
    expect(challengeProgress(week, 9)).toEqual({ logged: 3, goal: 3, pct: 100, complete: true });
  });

  it('says which days count towards it', () => {
    expect(isDayInChallenge(week, '2026-08-10')).toBe(true);
    expect(isDayInChallenge(week, '2026-08-16')).toBe(true);
    expect(isDayInChallenge(week, '2026-08-17')).toBe(false);
  });
});

describe('picking the challenge to show', () => {
  const schedule = [
    challenge({ id: 'a', starts: '2026-08-03', ends: '2026-08-09' }),
    challenge({ id: 'b', starts: '2026-08-10', ends: '2026-08-16' }),
    challenge({ id: 'c', starts: '2026-08-17', ends: '2026-08-23' }),
    challenge({ id: 'sk', sport: 'skate', starts: '2026-08-10', ends: '2026-08-16' }),
  ];

  it('lists a sport’s weeks oldest first', () => {
    expect(challengesFor('scooter', schedule).map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(challengesFor('skate', schedule).map((c) => c.id)).toEqual(['sk']);
  });

  it('leaves out challenges staff have pulled', () => {
    const withPulled = [
      ...schedule,
      challenge({ id: 'x', starts: '2026-09-01', ends: '2026-09-07', isLive: false }),
    ];
    expect(challengesFor('scooter', withPulled).map((c) => c.id)).not.toContain('x');
  });

  it('shows the one running now', () => {
    expect(liveChallenge('scooter', at('2026-08-13T12:00:00Z'), schedule)?.id).toBe('b');
  });

  it('shows the next one scheduled when nothing is running', () => {
    expect(liveChallenge('scooter', at('2026-07-01T12:00:00Z'), schedule)?.id).toBe('a');
  });

  it('falls back to the most recent finished week once the schedule runs out', () => {
    expect(liveChallenge('scooter', at('2026-12-01T12:00:00Z'), schedule)?.id).toBe('c');
  });

  it('returns null for a sport with no challenges at all', () => {
    expect(liveChallenge('skate', at('2026-08-13T12:00:00Z'), [])).toBeNull();
  });
});

describe('one live challenge per sport', () => {
  const base = challenge({ id: 'base', starts: '2026-08-10', ends: '2026-08-16' });

  it('spots an overlap at either edge and in the middle', () => {
    expect(
      challengesOverlap(base, challenge({ id: 'x', starts: '2026-08-16', ends: '2026-08-22' })),
    ).toBe(true);
    expect(
      challengesOverlap(base, challenge({ id: 'x', starts: '2026-08-04', ends: '2026-08-10' })),
    ).toBe(true);
    expect(
      challengesOverlap(base, challenge({ id: 'x', starts: '2026-08-12', ends: '2026-08-13' })),
    ).toBe(true);
  });

  it('allows two weeks that merely touch end to start', () => {
    expect(
      challengesOverlap(base, challenge({ id: 'x', starts: '2026-08-17', ends: '2026-08-23' })),
    ).toBe(false);
    expect(
      challengesOverlap(base, challenge({ id: 'x', starts: '2026-08-03', ends: '2026-08-09' })),
    ).toBe(false);
  });

  it('never reports a challenge as overlapping itself', () => {
    expect(challengesOverlap(base, base)).toBe(false);
    expect(challengesOverlap(base, { ...base })).toBe(false);
  });

  it('never sees an overlap across sports', () => {
    const skate = challenge({ id: 'sk', sport: 'skate', starts: '2026-08-10', ends: '2026-08-16' });
    expect(challengesOverlap(base, skate)).toBe(false);
  });

  it('names the collisions a hook would have to reject', () => {
    const existing = [
      challenge({ id: 'a', starts: '2026-08-03', ends: '2026-08-09' }),
      challenge({ id: 'b', starts: '2026-08-10', ends: '2026-08-16' }),
    ];
    const candidate = challenge({ id: 'new', starts: '2026-08-08', ends: '2026-08-14' });
    expect(overlappingChallenges(candidate, existing).map((c) => c.id)).toEqual(['a', 'b']);
    expect(
      overlappingChallenges(
        challenge({ id: 'new', starts: '2026-08-17', ends: '2026-08-23' }),
        existing,
      ),
    ).toEqual([]);
  });
});

describe('the date range label', () => {
  it('drops the month from the start date when the week sits inside one month', () => {
    expect(challengeRangeLabel(week)).toBe('10 to 16 Aug');
  });

  it('keeps both months when the week straddles them', () => {
    expect(
      challengeRangeLabel(challenge({ id: 'x', starts: '2026-07-27', ends: '2026-08-02' })),
    ).toBe('27 Jul to 2 Aug');
  });
});

describe('the shipped schedule', () => {
  it('runs the scooter and skate weeks in step', () => {
    const scooter = challengesFor('scooter', CHALLENGES);
    const skate = challengesFor('skate', CHALLENGES);
    expect(scooter).toHaveLength(6);
    expect(skate).toHaveLength(6);
    expect(scooter.map((c) => c.starts)).toEqual(skate.map((c) => c.starts));
  });

  it('has exactly one live week per sport on any given day', () => {
    for (const day of ['2026-07-22', '2026-08-05', '2026-08-13', '2026-08-27']) {
      const clock = at(`${day}T12:00:00Z`);
      for (const sport of ['scooter', 'skate'] as const) {
        const live = challengesFor(sport, CHALLENGES).filter(
          (c) => challengeState(c, clock) === 'live',
        );
        expect(live).toHaveLength(1);
      }
    }
  });
});
