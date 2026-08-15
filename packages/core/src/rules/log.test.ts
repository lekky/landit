import { describe, expect, it } from 'vitest';

import type { StageId, TrickLogEntry } from '../types';
import { firstLanded, landedByMonth, latestLanded, logEntriesForTrick } from './log';

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
