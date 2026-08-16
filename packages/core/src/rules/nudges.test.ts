import { describe, expect, it } from 'vitest';

import {
  NUDGE_QUIET_FROM_HOUR,
  NUDGE_QUIET_UNTIL_HOUR,
  canNudge,
  isQuietHours,
  riderHour,
} from './nudges';

/**
 * Plan §6.4, Standard 13: nothing is sent to a rider between 21:00 and 07:00 in
 * **their** time. The audience is children; the whole point of the rule is the
 * hours they are asleep.
 *
 * This is the kind of decision that survives only if a test fails when someone
 * relaxes it, so the numbers are asserted directly and so is the wrap around
 * midnight — the bug an "hour >= 21 && hour < 7" would ship silently.
 */

const at = (iso: string, timezone: string) => ({ now: Date.parse(iso), timezone });

describe('the quiet window (plan §6.4, Standard 13)', () => {
  it('runs from 21:00 to 07:00', () => {
    expect(NUDGE_QUIET_FROM_HOUR).toBe(21);
    expect(NUDGE_QUIET_UNTIL_HOUR).toBe(7);
  });

  it.each([
    ['20:59', false],
    ['21:00', true],
    ['23:59', true],
    ['00:00', true],
    ['03:00', true],
    ['06:59', true],
    ['07:00', false],
    ['12:00', false],
  ])('at %s local, quiet is %s', (time, quiet) => {
    const clock = at(`2026-08-16T${time}:00Z`, 'UTC');
    expect(isQuietHours(clock)).toBe(quiet);
    expect(canNudge(clock)).toBe(!quiet);
  });

  it('wraps midnight rather than treating the window as a range', () => {
    // The naive `>= 21 && < 7` reads false for every hour there is. Midnight is
    // the hour that catches it.
    expect(isQuietHours(at('2026-08-17T00:30:00Z', 'UTC'))).toBe(true);
  });
});

describe('the window belongs to the rider, not the server', () => {
  it('is quiet for a rider whose night it is, and open for one whose day it is', () => {
    // One instant. 22:00 in London, 09:00 the next morning in Auckland.
    const instant = '2026-08-16T21:00:00Z';
    expect(riderHour(at(instant, 'Europe/London'))).toBe(22);
    expect(riderHour(at(instant, 'Pacific/Auckland'))).toBe(9);

    expect(canNudge(at(instant, 'Europe/London'))).toBe(false);
    expect(canNudge(at(instant, 'Pacific/Auckland'))).toBe(true);
  });

  it('reads midnight as hour 0, not hour 24', () => {
    expect(riderHour(at('2026-08-16T00:10:00Z', 'UTC'))).toBe(0);
  });

  it('falls back to the default timezone rather than to UTC by accident', () => {
    // 23:30 UTC in high summer is 00:30 in London — a different day and,
    // crucially here, quiet rather than open.
    expect(isQuietHours({ now: Date.parse('2026-06-16T23:30:00Z') })).toBe(true);
  });

  it('refuses an unresolvable timezone instead of guessing it is fine to send', () => {
    expect(() => canNudge(at('2026-08-16T12:00:00Z', 'Not/AZone'))).toThrow();
  });
});
