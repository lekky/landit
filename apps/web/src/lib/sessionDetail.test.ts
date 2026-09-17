import type { RideSession } from '@landit/core';
import { describe, expect, it } from 'vitest';

import {
  changeLines,
  crewChipName,
  crewStatValue,
  dayKeyDayMonth,
  detailTrickNote,
  durationWords,
  eventBlockState,
  loggedHereHeading,
  pagerPosition,
  sessionClock,
  sessionDateLabels,
  spotBlockBadge,
  trickBlockMeta,
  trickChipLabel,
  tricksStatValue,
  visibilityCardCopy,
} from './sessionDetail';

function session(over: Partial<RideSession> = {}): RideSession {
  return {
    id: 'aaaaaaaaaaaaaaa',
    userId: 'uuuuuuuuuuuuuuu',
    startedAt: '2026-09-12T13:00:00.000Z',
    durationMinutes: 120,
    sport: 'scooter',
    spotId: 'sssssssssssssss',
    feel: 'sent',
    crewIds: [],
    visibility: 'members',
    trickEntries: [],
    monthKey: '2026-09',
    graceUsed: false,
    created: '2026-09-12T15:00:00.000Z',
    ...over,
  } as RideSession;
}

describe('dates, on the rider clock', () => {
  it('writes the hero pill long and short, in the rider zone', () => {
    const labels = sessionDateLabels('2026-09-12T13:00:00.000Z', 'Europe/London');
    expect(labels.long).toBe('Saturday 12 September 2026 · 14:00');
    expect(labels.short).toBe('Sat 12 Sep 2026 · 14:00');
    expect(labels.dayMonth).toBe('12 Sep');
    expect(labels.dayMonthYear).toBe('12 Sep 2026');
  });

  it('puts a late session on the rider day, not the UTC one', () => {
    // 23:30 UTC on the 12th is 09:30 on the 13th in Sydney.
    const labels = sessionDateLabels('2026-09-12T23:30:00.000Z', 'Australia/Sydney');
    expect(labels.dayMonth).toBe('13 Sep');
    expect(sessionClock('2026-09-12T23:30:00.000Z', 'Australia/Sydney')).toBe('09:30');
  });

  it('falls back to the default zone for an empty one (LESSONS §3a)', () => {
    expect(sessionClock('2026-09-12T13:00:00.000Z', '')).toMatch(/^\d{2}:\d{2}$/);
    expect(sessionClock('not a date')).toBe('');
  });

  it('reads midnight as 00, never 24', () => {
    expect(sessionClock('2026-09-12T23:00:00.000Z', 'Europe/London')).toBe('00:00');
  });

  it('writes a first-tried day key short', () => {
    expect(dayKeyDayMonth('2026-08-05')).toBe('5 Aug');
    expect(dayKeyDayMonth(null)).toBe('');
  });
});

describe('the stat strip', () => {
  it('spells the four durations out', () => {
    expect([30, 60, 120, 180].map(durationWords)).toEqual([
      '30 minutes',
      '1 hour',
      '2 hours',
      '3 hours+',
    ]);
  });

  it('counts tricks worked and moved', () => {
    expect(tricksStatValue([])).toBe('None');
    expect(tricksStatValue([{ trickId: 'a', landed: false }])).toBe('1 worked');
    expect(
      tricksStatValue([
        { trickId: 'a', landed: true, stageFrom: 'some', stageTo: 'most' },
        { trickId: 'b', landed: false },
      ]),
    ).toBe('2 worked, 1 moved');
  });

  it('names tagged riders by first name only', () => {
    expect(crewStatValue(['Ollie Smith', 'Mia'])).toBe('Ollie, Mia');
    expect(crewStatValue([])).toBe('Nobody tagged');
    expect(crewChipName('  ')).toBe('Rider');
  });
});

describe('the visibility card', () => {
  it('says who can see it for each of the three', () => {
    expect(visibilityCardCopy('members').title).toBe('Your crew can see this');
    expect(visibilityCardCopy('private').title).toBe('Only you can see this');
    expect(visibilityCardCopy('public').body).toMatch(/profile is open/);
  });
});

describe('what this one changed', () => {
  const moved = session({
    trickEntries: [
      { trickId: 'tttttttttttttt1', landed: true, stageFrom: 'some', stageTo: 'most' },
    ],
  });
  const name = () => 'Tailwhip';

  it('gives the owner the whole list, against their diary', () => {
    const lines = changeLines(moved, [moved], name, { isOwner: true, timezone: 'Europe/London' });
    expect(lines[0]).toBe('Tailwhip: Sometimes → Most times');
    expect(lines).toContain('Counted as a ride for your weekly streak');
    expect(lines).toContain('Your first session at this spot');
  });

  it('gives anybody else the stage moves only', () => {
    const lines = changeLines(moved, null, name, { isOwner: false, timezone: 'Europe/London' });
    expect(lines).toEqual(['Tailwhip: Sometimes → Most times']);
  });

  it('gives a non-owner nothing for a session that moved nothing', () => {
    expect(changeLines(session(), null, name, { isOwner: false })).toEqual([]);
  });

  it('notes a trick row by what happened', () => {
    expect(detailTrickNote({ trickId: 'a', landed: false })).toBe('Worked on it');
    expect(detailTrickNote({ trickId: 'a', landed: true })).toBe('Landed it');
    expect(detailTrickNote({ trickId: 'a', landed: true, stageFrom: null, stageTo: 'some' })).toBe(
      'Landed it · now Sometimes',
    );
  });
});

describe('the pager', () => {
  it('says where a session sits, newest first', () => {
    expect(pagerPosition(['a', 'b', 'c'], 'a')).toEqual({ label: '1 of 3' });
    expect(pagerPosition(['a', 'b', 'c'], 'z')).toBeNull();
  });
});

describe('the blocks', () => {
  it('badges the spot block with count and time', () => {
    expect(spotBlockBadge(4, 510)).toBe('4 · 8h 30m');
    expect(spotBlockBadge(1, 30)).toBe('1 · 30m');
    expect(spotBlockBadge(2, 120)).toBe('2 · 2h');
  });

  it('marks a moved trick on its chip', () => {
    expect(trickChipLabel('Tailwhip', { trickId: 'a', landed: true, stageTo: 'most' })).toBe(
      'Tailwhip → Most times',
    );
    expect(trickChipLabel('Tailwhip', { trickId: 'a', landed: false })).toBe('Tailwhip');
  });

  it('offers the live block on the day and the past one once it is over', () => {
    expect(eventBlockState('today', 0)).toBe('live');
    expect(eventBlockState('today', 2)).toBe('live');
    expect(eventBlockState('over', 2)).toBe('past');
    // Over with nothing logged is the offer to log one, not a count of none
    // (owner, 2026-09-17): the form only volunteers an event at the spot on the
    // day, so this block is how a jam written up the next morning is attached.
    expect(eventBlockState('over', 0)).toBe('past');
    // Nothing before the day: a session cannot start in the future.
    expect(eventBlockState('upcoming', 0)).toBeNull();
    expect(eventBlockState('upcoming', 2)).toBe('past');
  });

  it('counts in words that agree with the number', () => {
    expect(loggedHereHeading(1)).toBe('You logged 1 session here');
    expect(loggedHereHeading(2)).toBe('You logged 2 sessions here');
    expect(trickBlockMeta(5, '2026-08-05')).toBe('5 sessions · first tried 5 Aug');
    expect(trickBlockMeta(1, null)).toBe('1 session');
  });
});
