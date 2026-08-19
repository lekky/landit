import { describe, expect, it } from 'vitest';

import { CHALLENGES } from '../data/challenges';
import { SPORT_IDS } from '../data/sports';
import type { Challenge } from '../types';
import { stickerRule } from './stickers';
import { addDays, compareDayKeys } from './time';
import {
  canLogChallenge,
  challengeProgress,
  challengeRangeLabel,
  challengeRewardSticker,
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
  // `SPORT_IDS`, never a literal pair (plan §7). The two-sport version of these
  // assertions passed happily while BMX had no challenges at all and the
  // `challenger` sticker was unearnable for a BMX-only rider (issue #80).
  it('runs every sport’s slots in step', () => {
    const perSport = SPORT_IDS.map((sport) => challengesFor(sport, CHALLENGES));
    const first = perSport[0]?.map((c) => c.starts) ?? [];
    // Not a literal count. It was six, because the pack transcribed six, and
    // asserting six is asserting the schedule never grows — which is how it
    // acquired an expiry date in the first place.
    expect(first.length).toBeGreaterThanOrEqual(6);
    for (const sport of perSport) expect(sport.map((c) => c.starts)).toEqual(first);
  });

  it('leaves no sport without a challenge to run', () => {
    for (const sport of SPORT_IDS) {
      expect(challengesFor(sport, CHALLENGES).length).toBeGreaterThan(0);
    }
  });

  /*
   * The three assertions below are what stop the schedule acquiring an expiry
   * date again. The shipped set ran weeks 30-35 and stopped on 2026-08-30 —
   * eleven days after the site went live — and nothing was red about that,
   * because "does it end?" was never asked. Past its last Sunday `liveChallenge`
   * falls back to the most recent finished slot and every sport shows a dead
   * card, permanently, to real riders.
   *
   * None of them assumes a cadence. The shipped six run weekly, everything from
   * 2026-08-31 runs fortnightly, and what has to be true of both is that the
   * slots meet exactly: no gap, no overlap, no sport left behind.
   */
  it('runs each sport’s slots back to back, with no day off in between', () => {
    for (const sport of SPORT_IDS) {
      const slots = challengesFor(sport, CHALLENGES);
      for (let i = 1; i < slots.length; i += 1) {
        const previous = slots[i - 1];
        const next = slots[i];
        if (!previous || !next) throw new Error('unreachable');
        // The day after one slot ends is the day the next one opens. Not "no
        // overlap" — that is `challengesOverlap`'s job, and a gap passes it
        // happily while still showing a rider a dead card.
        expect(addDays(previous.ends, 1), `${previous.id} into ${next.id}`).toBe(next.starts);
      }
    }
  });

  it('has exactly one live challenge per sport on every day it covers', () => {
    // Every day the schedule claims, not a hand-picked four: a sampled date
    // list only ever proves the dates somebody thought to type, and the four it
    // sampled were all inside weeks that happened to be fine.
    for (const sport of SPORT_IDS) {
      const slots = challengesFor(sport, CHALLENGES);
      const last = slots[slots.length - 1];
      if (!slots[0] || !last) throw new Error('unreachable');

      for (let day = slots[0].starts; compareDayKeys(day, last.ends) <= 0; day = addDays(day, 1)) {
        const clock = at(`${day}T12:00:00Z`, 'UTC');
        const live = slots.filter((c) => challengeState(c, clock) === 'live');
        expect(live.length, `${sport} on ${day}`).toBe(1);
      }
    }
  });

  it('carries every sport to the end of 2026', () => {
    for (const sport of SPORT_IDS) {
      const slots = challengesFor(sport, CHALLENGES);
      const last = slots[slots.length - 1];
      // A string compare, not `toBeGreaterThanOrEqual` — that matcher takes
      // numbers, and day keys sort correctly as text by construction.
      expect(compareDayKeys(last?.ends ?? '', '2026-12-31') >= 0, sport).toBe(true);
    }
  });
});

describe('the reward a challenge promises', () => {
  // Issue #76: all twelve shipped challenges named a sticker that did not
  // exist, so the screen promised a reward the award flow could never grant.
  it('names a sticker that exists, is live, and has a rule behind it', () => {
    for (const challenge of CHALLENGES) {
      const sticker = challengeRewardSticker(challenge);
      expect(sticker, `${challenge.id} promises "${challenge.reward}"`).not.toBeNull();
      expect(sticker?.isLive).toBe(true);
      expect(stickerRule(sticker?.id ?? '')).toBeTypeOf('function');
    }
  });

  it('reads a reward with or without the trailing word "sticker"', () => {
    expect(challengeRewardSticker({ reward: 'Challenger' })?.id).toBe('challenger');
    expect(challengeRewardSticker({ reward: 'Challenger sticker' })?.id).toBe('challenger');
    expect(challengeRewardSticker({ reward: 'challenger STICKER' })?.id).toBe('challenger');
  });

  it('resolves to null rather than guessing when the name is not a sticker', () => {
    expect(challengeRewardSticker({ reward: 'Long Roller sticker' })).toBeNull();
    expect(challengeRewardSticker({ reward: '' })).toBeNull();
  });
});
