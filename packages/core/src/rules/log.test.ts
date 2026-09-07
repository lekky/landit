import { describe, expect, it } from 'vitest';

import type { StageId, TrickLogEntry } from '../types';
import { firstLanded, landedByMonth, latestLanded, logEntriesForTrick, trickHistory } from './log';

const on = (iso: string): number => Date.parse(iso);
const entry = (trick: string, stage: StageId, iso: string, estimated = false): TrickLogEntry => ({
  trick,
  stage,
  at: on(iso),
  ...(estimated ? { estimated: true } : {}),
});

describe('when a trick was first landed', () => {
  it('ignores the stages before it counted as landed', () => {
    const log = [
      entry('bunny-hop', 'want', '2026-01-05T10:00:00Z'),
      entry('bunny-hop', 'trying', '2026-02-05T10:00:00Z'),
      entry('bunny-hop', 'some', '2026-03-05T10:00:00Z'),
    ];
    expect(firstLanded(log)['bunny-hop']?.at).toBe(on('2026-03-05T10:00:00Z'));
  });

  it('keeps the first landing, not the best one', () => {
    const log = [
      entry('bunny-hop', 'some', '2026-03-05T10:00:00Z'),
      entry('bunny-hop', 'every', '2026-06-05T10:00:00Z'),
    ];
    expect(firstLanded(log)['bunny-hop']?.stage).toBe('some');
  });

  it('keeps the date even if the rider later dropped back to learning it', () => {
    // They did land it. Only deleting the rows takes that away.
    const log = [
      entry('bunny-hop', 'some', '2026-03-05T10:00:00Z'),
      entry('bunny-hop', 'trying', '2026-04-05T10:00:00Z'),
    ];
    expect(firstLanded(log)['bunny-hop']).toBeDefined();
  });

  it('does not depend on the rows arriving in order', () => {
    const inOrder = [
      entry('bunny-hop', 'some', '2026-03-05T10:00:00Z'),
      entry('bunny-hop', 'every', '2026-06-05T10:00:00Z'),
    ];
    const shuffled = [inOrder[1]!, inOrder[0]!];
    expect(firstLanded(shuffled)['bunny-hop']?.at).toBe(firstLanded(inOrder)['bunny-hop']?.at);
  });

  it('has nothing to say about a trick that was never landed', () => {
    expect(firstLanded([entry('bunny-hop', 'trying', '2026-03-05T10:00:00Z')])).toEqual({});
    expect(firstLanded([])).toEqual({});
  });
});

describe('landed over time', () => {
  const now = on('2026-08-16T12:00:00Z');
  const options = { timezone: 'Europe/London' };

  it('returns one bucket per month, oldest first, including empty ones', () => {
    const months = landedByMonth([], now, 6, options);
    expect(months).toHaveLength(6);
    expect(months.map((m) => m.key)).toEqual([
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
    ]);
    expect(months.map((m) => m.label)).toEqual(['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']);
    expect(months.every((m) => m.n === 0)).toBe(true);
  });

  it('counts each trick once, in the month it was first landed', () => {
    const log = [
      entry('bunny-hop', 'some', '2026-06-10T10:00:00Z'),
      entry('bunny-hop', 'every', '2026-08-10T10:00:00Z'),
      entry('tic-tac', 'some', '2026-08-01T10:00:00Z'),
      entry('x-up', 'most', '2026-08-02T10:00:00Z'),
    ];
    const months = landedByMonth(log, now, 6, options);
    expect(months.find((m) => m.key === '2026-06')?.n).toBe(1);
    expect(months.find((m) => m.key === '2026-08')?.n).toBe(2);
  });

  it('counts the estimated dates separately, so the chart can say so', () => {
    const log = [
      entry('bunny-hop', 'some', '2026-07-10T10:00:00Z', true),
      entry('tic-tac', 'some', '2026-07-12T10:00:00Z'),
    ];
    const july = landedByMonth(log, now, 6, options).find((m) => m.key === '2026-07');
    expect(july?.n).toBe(2);
    expect(july?.est).toBe(1);
  });

  it('drops landings older than the window rather than piling them into month one', () => {
    const log = [entry('bunny-hop', 'some', '2025-01-10T10:00:00Z')];
    expect(landedByMonth(log, now, 6, options).reduce((n, m) => n + m.n, 0)).toBe(0);
  });

  it('scopes to one sport when asked', () => {
    const log = [
      entry('bunny-hop', 'some', '2026-08-01T10:00:00Z'),
      entry('sk-ollie', 'some', '2026-08-02T10:00:00Z'),
    ];
    expect(landedByMonth(log, now, 6, { ...options, sport: 'scooter' }).at(-1)?.n).toBe(1);
    expect(landedByMonth(log, now, 6, { ...options, sport: 'skate' }).at(-1)?.n).toBe(1);
    expect(landedByMonth(log, now, 6, options).at(-1)?.n).toBe(2);
  });

  it('ignores log rows for tricks that are no longer in the library', () => {
    const log = [entry('deleted-trick', 'some', '2026-08-01T10:00:00Z')];
    expect(landedByMonth(log, now, 6, options).reduce((n, m) => n + m.n, 0)).toBe(0);
  });

  it('buckets a landing by the rider’s month, not the server’s', () => {
    // 23:30 UTC on 31 July is already August in Auckland.
    const log = [entry('bunny-hop', 'some', '2026-07-31T23:30:00Z')];
    const nz = landedByMonth(log, now, 6, { timezone: 'Pacific/Auckland' });
    const la = landedByMonth(log, now, 6, { timezone: 'America/Los_Angeles' });
    expect(nz.find((m) => m.key === '2026-08')?.n).toBe(1);
    expect(la.find((m) => m.key === '2026-07')?.n).toBe(1);
  });

  it('walks back across a year boundary', () => {
    const months = landedByMonth([], on('2026-02-10T12:00:00Z'), 6, options);
    expect(months.map((m) => m.key)).toEqual([
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });
});

describe('the latest lands', () => {
  it('lists first-landings newest first, capped', () => {
    const log = [
      entry('bunny-hop', 'some', '2026-06-01T10:00:00Z'),
      entry('tic-tac', 'some', '2026-07-01T10:00:00Z'),
      entry('x-up', 'some', '2026-08-01T10:00:00Z'),
    ];
    expect(latestLanded(log, 2).map((e) => e.trick)).toEqual(['x-up', 'tic-tac']);
  });

  it('scopes to one sport', () => {
    const log = [
      entry('bunny-hop', 'some', '2026-06-01T10:00:00Z'),
      entry('sk-ollie', 'some', '2026-08-01T10:00:00Z'),
    ];
    expect(latestLanded(log, 5, { sport: 'scooter' }).map((e) => e.trick)).toEqual(['bunny-hop']);
  });
});

describe('undoing a tracked trick', () => {
  it('names every row belonging to that trick, and only that trick', () => {
    const log = [
      entry('bunny-hop', 'trying', '2026-06-01T10:00:00Z'),
      entry('bunny-hop', 'some', '2026-07-01T10:00:00Z'),
      entry('tic-tac', 'some', '2026-07-02T10:00:00Z'),
    ];
    expect(logEntriesForTrick(log, 'bunny-hop')).toHaveLength(2);
    expect(logEntriesForTrick(log, 'tic-tac')).toHaveLength(1);
    expect(logEntriesForTrick(log, 'manual')).toEqual([]);
  });

  it('leaves no first-landed date behind once those rows are gone', () => {
    const log = [
      entry('bunny-hop', 'some', '2026-07-01T10:00:00Z'),
      entry('tic-tac', 'some', '2026-07-02T10:00:00Z'),
    ];
    const remaining = log.filter((e) => !logEntriesForTrick(log, 'bunny-hop').includes(e));
    expect(firstLanded(remaining)['bunny-hop']).toBeUndefined();
    expect(firstLanded(remaining)['tic-tac']).toBeDefined();
  });
});

describe("a rider's history with one trick (T31)", () => {
  const now = on('2026-09-07T12:00:00Z');

  it('has nothing to say before anything is logged', () => {
    expect(trickHistory([], 'tailwhip', { now })).toEqual({
      entries: [],
      summary: 'Nothing logged yet',
    });
  });

  it("lists the trick's rows oldest first, dated in the rider's zone, and marks the first landing", () => {
    const log = [
      entry('tailwhip', 'some', '2026-08-17T10:00:00Z'),
      entry('tailwhip', 'want', '2026-08-03T10:00:00Z', true),
      entry('bunny-hop', 'some', '2026-08-04T10:00:00Z'),
      entry('tailwhip', 'trying', '2026-08-05T10:00:00Z'),
      entry('tailwhip', 'most', '2026-09-02T10:00:00Z'),
    ];
    const { entries } = trickHistory(log, 'tailwhip', { now });
    expect(entries.map((e) => [e.stage, e.dateLabel, e.estimated, e.firstLanded])).toEqual([
      ['want', '3 Aug 2026', true, false],
      ['trying', '5 Aug 2026', false, false],
      ['some', '17 Aug 2026', false, true],
      ['most', '2 Sep 2026', false, false],
    ]);
  });

  it('measures learning to landed in weeks, from the first attempt rather than the bookmark', () => {
    const log = [
      entry('tailwhip', 'want', '2026-08-03T10:00:00Z'),
      entry('tailwhip', 'trying', '2026-08-05T10:00:00Z'),
      entry('tailwhip', 'some', '2026-08-19T10:00:00Z'),
    ];
    expect(trickHistory(log, 'tailwhip', { now }).summary).toBe('Learning to landed in 2 weeks');
    // Twelve days is not two weeks, and it is not one either: whole weeks only.
    const quick = [log[1]!, entry('tailwhip', 'some', '2026-08-17T10:00:00Z')];
    expect(trickHistory(quick, 'tailwhip', { now }).summary).toBe('Learning to landed in 1 week');
    const flash = [log[1]!, entry('tailwhip', 'some', '2026-08-09T10:00:00Z')];
    expect(trickHistory(flash, 'tailwhip', { now }).summary).toBe(
      'Learning to landed in under a week',
    );
  });

  it('says how long it has been since learning began, in elapsed weeks', () => {
    // 5 Aug to 7 Sep is 33 days: four whole weeks, not the five Mondays crossed.
    const log = [
      entry('tailwhip', 'want', '2026-08-03T10:00:00Z'),
      entry('tailwhip', 'trying', '2026-08-05T10:00:00Z'),
    ];
    expect(trickHistory(log, 'tailwhip', { now }).summary).toBe('Learning since 5 Aug · 4 weeks');
  });

  it("uses the stage's own words when only a bookmark exists, and does not round a day up", () => {
    const log = [entry('tailwhip', 'want', '2026-09-06T10:00:00Z')];
    expect(trickHistory(log, 'tailwhip', { now }).summary).toBe(
      'Want to learn since 6 Sep · under a week',
    );
  });

  it('has no learning to measure when the trick was logged straight in as landed', () => {
    const log = [entry('tailwhip', 'most', '2026-08-17T10:00:00Z')];
    expect(trickHistory(log, 'tailwhip', { now }).summary).toBe('Landed 17 Aug');
  });

  it("dates in the rider's timezone, not the server's", () => {
    const log = [entry('tailwhip', 'trying', '2026-08-05T23:30:00Z')];
    const label = (timezone?: string) =>
      trickHistory(log, 'tailwhip', { now, timezone }).entries[0]?.dateLabel;
    expect(label('Pacific/Auckland')).toBe('6 Aug 2026');
    expect(label()).toBe('6 Aug 2026');
    expect(label('America/Los_Angeles')).toBe('5 Aug 2026');
  });
});
