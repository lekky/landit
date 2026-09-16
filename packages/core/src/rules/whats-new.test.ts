import { describe, expect, it } from 'vitest';

import {
  WHATS_NEW_MAX_LINES,
  unseenWhatsNew,
  whatsNewLines,
  type WhatsNewInputs,
  type WhatsNewLine,
} from './whats-new';
import type { WeeklyStreakState } from './streak';

/**
 * The derived What's new feed (rethink §3.6).
 *
 * Three things these tests are really about, and none of them is the wording:
 *
 * - **Every line is a sentence the product wrote.** `noFreeText` below asserts
 *   that what comes out is built only from the catalogue strings that went in,
 *   which is the checkable half of plan §6.1.
 * - **The order is time.** Not relevance, not kind, not "yours first".
 * - **The unseen count and the list cannot disagree**, because the count is
 *   computed from the list rather than beside it.
 *
 * The clock is passed explicitly everywhere. A rule about "within 7 days" that
 * reads the wall clock is a rule that passes on a Tuesday.
 */

/** Wednesday 16 September 2026. Monday of that week is the 14th. */
const NOW = Date.parse('2026-09-16T12:00:00.000Z');
const CLOCK = { now: NOW, timezone: 'Europe/London' } as const;

const linesOf = (lines: readonly WhatsNewLine[]): string[] => lines.map((l) => l.line);

describe('stickers earned', () => {
  it('reads as a sentence naming the sticker', () => {
    const lines = whatsNewLines(
      { stickers: [{ id: 's1', name: 'First Fifty', earnedAt: '2026-09-15T09:00:00.000Z' }] },
      CLOCK,
    );

    expect(linesOf(lines)).toEqual(['You earned the First Fifty sticker.']);
    expect(lines[0]?.kind).toBe('sticker');
    expect(lines[0]?.ahead).toBe(false);
  });

  it('drops one earned before the look-back window', () => {
    const lines = whatsNewLines(
      {
        stickers: [
          { id: 'old', name: 'Old One', earnedAt: '2026-06-01T09:00:00.000Z' },
          { id: 'new', name: 'New One', earnedAt: '2026-09-10T09:00:00.000Z' },
        ],
      },
      CLOCK,
    );

    expect(linesOf(lines)).toEqual(['You earned the New One sticker.']);
  });

  it('ignores a row whose stamp cannot be read, rather than rendering "Invalid Date"', () => {
    const lines = whatsNewLines(
      { stickers: [{ id: 's1', name: 'First Fifty', earnedAt: 'not-a-date' }] },
      CLOCK,
    );

    expect(lines).toEqual([]);
  });
});

describe('an event the rider said yes to', () => {
  const event = { id: 'corby-jam', name: 'Corby Jam' };

  it('names the weekday once it is inside the window', () => {
    const lines = whatsNewLines({ events: [{ ...event, date: '2026-09-19' }] }, CLOCK);

    expect(linesOf(lines)).toEqual(['Corby Jam is Saturday. You said you’re going.']);
    expect(lines[0]?.ahead).toBe(true);
  });

  it('says "today" and "tomorrow" rather than naming the weekday', () => {
    expect(linesOf(whatsNewLines({ events: [{ ...event, date: '2026-09-16' }] }, CLOCK))).toEqual([
      'Corby Jam is today. You said you’re going.',
    ]);
    expect(linesOf(whatsNewLines({ events: [{ ...event, date: '2026-09-17' }] }, CLOCK))).toEqual([
      'Corby Jam is tomorrow. You said you’re going.',
    ]);
  });

  it('is silent outside the seven days, on both sides', () => {
    expect(whatsNewLines({ events: [{ ...event, date: '2026-09-24' }] }, CLOCK)).toEqual([]);
    expect(whatsNewLines({ events: [{ ...event, date: '2026-09-15' }] }, CLOCK)).toEqual([]);
  });

  it('is dated to the day the line started being true, not to the event', () => {
    const [line] = whatsNewLines({ events: [{ ...event, date: '2026-09-19' }] }, CLOCK);

    // Seven days before the event, which is what makes it unseen exactly once.
    expect(line?.at).toBe('2026-09-12T00:00:00.000Z');
  });
});

describe('the live challenge’s deadline', () => {
  const challenge = { id: 'switch-week', title: 'Switch week', goal: 3 };

  it('appears inside three days, with the count', () => {
    const lines = whatsNewLines(
      { challenges: [{ ...challenge, ends: '2026-09-18', logged: 1 }] },
      CLOCK,
    );

    expect(linesOf(lines)).toEqual(['Switch week ends Friday. 1 of 3 logged.']);
  });

  it('is silent while the deadline is further off', () => {
    expect(
      whatsNewLines({ challenges: [{ ...challenge, ends: '2026-09-20', logged: 1 }] }, CLOCK),
    ).toEqual([]);
  });

  it('is silent once it has closed', () => {
    expect(
      whatsNewLines({ challenges: [{ ...challenge, ends: '2026-09-15', logged: 3 }] }, CLOCK),
    ).toEqual([]);
  });

  it('never reports more logged than the goal', () => {
    const lines = whatsNewLines(
      { challenges: [{ ...challenge, ends: '2026-09-17', logged: 9 }] },
      CLOCK,
    );

    expect(linesOf(lines)).toEqual(['Switch week ends tomorrow. 3 of 3 logged.']);
  });
});

describe('a banked week', () => {
  /**
   * The state of a rider who has just banked this week on their second ride.
   * Monday of the week containing Wednesday 16 September is the 14th.
   */
  const banked: WeeklyStreakState = {
    streak: 5,
    lastQualifyingWeek: '2026-09-14',
    weekStart: '2026-09-14',
    ridesThisWeek: 2,
    lastRide: '2026-09-16T10:00:00.000Z',
  };

  it('says which week it was', () => {
    expect(linesOf(whatsNewLines({ streak: banked }, CLOCK))).toEqual(['Week 5 banked.']);
  });

  it('is dropped once the tuple can no longer say when it banked', () => {
    // A third ride this week. The week is still banked; the moment it banked is
    // no longer in the tuple, and a line dated to the wrong day in a list sorted
    // by time is worse than no line.
    const ridden = { ...banked, ridesThisWeek: 3 };
    expect(whatsNewLines({ streak: ridden }, CLOCK)).toEqual([]);
  });

  it('is silent about a week that banked before this one', () => {
    /*
     * `weekStart` stays on the current week and only `lastQualifyingWeek` moves
     * back. That pair is not a state `logWeeklyRide` produces, and it is
     * deliberately not: winding *both* back is the realistic version and it
     * passes through a different door — `weeklyRideCount` answers 0 once the
     * week has rolled over — so it would go green against a version that had
     * forgotten to check the qualifying week at all. Verified by removing that
     * check and watching this test, and only this one, go red (LESSONS §5).
     */
    const lastWeek = { ...banked, lastQualifyingWeek: '2026-09-07' };
    expect(whatsNewLines({ streak: lastWeek }, CLOCK)).toEqual([]);
  });

  it('is silent for a rider who has never ridden', () => {
    const never: WeeklyStreakState = {
      streak: 0,
      lastQualifyingWeek: null,
      weekStart: null,
      ridesThisWeek: 0,
      lastRide: null,
    };
    expect(whatsNewLines({ streak: never }, CLOCK)).toEqual([]);
  });

  it('follows the target when the caller moves it', () => {
    const three = { ...banked, ridesThisWeek: 3 };
    expect(linesOf(whatsNewLines({ streak: three }, { ...CLOCK, target: 3 }))).toEqual([
      'Week 5 banked.',
    ]);
  });
});

describe('a rider joining one of the rider’s crews', () => {
  it('names the rider and the crew, and claims nothing about whose code it was', () => {
    const lines = whatsNewLines(
      {
        joins: [
          {
            id: 'm1',
            crewName: 'Ramp Rats',
            riderName: 'Leo',
            joinedAt: '2026-09-15T18:00:00.000Z',
          },
        ],
      },
      CLOCK,
    );

    expect(linesOf(lines)).toEqual(['Leo joined Ramp Rats.']);
    // `crew_members` does not record which invite brought a member in, so the
    // spec's "with your code" would be a guess. See `crewJoinLine`.
    expect(lines[0]?.line).not.toContain('your code');
  });
});

describe('the order is time and nothing else', () => {
  const inputs: WhatsNewInputs = {
    stickers: [
      { id: 's1', name: 'Old Sticker', earnedAt: '2026-09-10T09:00:00.000Z' },
      { id: 's2', name: 'New Sticker', earnedAt: '2026-09-16T09:00:00.000Z' },
    ],
    events: [{ id: 'e1', name: 'Corby Jam', date: '2026-09-19' }],
    joins: [
      { id: 'm1', crewName: 'Ramp Rats', riderName: 'Leo', joinedAt: '2026-09-14T09:00:00.000Z' },
    ],
  };

  it('is newest first, across every kind', () => {
    const lines = whatsNewLines(inputs, CLOCK);
    const stamps = lines.map((l) => l.at);

    expect([...stamps].sort().reverse()).toEqual(stamps);
    expect(linesOf(lines)[0]).toBe('You earned the New Sticker sticker.');
  });

  it('is stable — the same input twice gives the same order', () => {
    expect(whatsNewLines(inputs, CLOCK)).toEqual(whatsNewLines(inputs, CLOCK));
  });

  it('stops at the cap rather than rendering everything there is', () => {
    const many = Array.from({ length: WHATS_NEW_MAX_LINES + 20 }, (_, i) => ({
      id: `s${i}`,
      name: `Sticker ${i}`,
      // Spread over the last fortnight so every one is inside the window.
      earnedAt: new Date(NOW - i * 3600_000).toISOString(),
    }));

    expect(whatsNewLines({ stickers: many }, CLOCK)).toHaveLength(WHATS_NEW_MAX_LINES);
  });
});

describe('nothing a rider typed reaches a line (plan §6.1)', () => {
  /**
   * The checkable half of "every sentence is one the product wrote": whatever
   * arbitrary text goes in as a catalogue name comes out *only* as that name,
   * and nothing else in the payload carries prose.
   */
  it('renders catalogue names and no other caller-supplied text', () => {
    const lines = whatsNewLines(
      {
        stickers: [{ id: 's1', name: 'First Fifty', hue: '#ff00aa', earnedAt: NOW }],
        events: [{ id: 'e1', name: 'Corby Jam', date: '2026-09-19' }],
        challenges: [{ id: 'c1', title: 'Switch week', ends: '2026-09-17', goal: 3, logged: 1 }],
        joins: [{ id: 'm1', crewName: 'Ramp Rats', riderName: 'Leo', joinedAt: NOW }],
      },
      CLOCK,
    );

    const words = ['First Fifty', 'Corby Jam', 'Switch week', 'Ramp Rats', 'Leo'];
    for (const line of lines) {
      const stripped = words.reduce((text, word) => text.split(word).join(''), line.line);
      // What is left is the product's own sentence frame — no stray field.
      expect(stripped).toMatch(/^[A-Za-z0-9 .,’']*$/);
    }
  });

  it('never carries a rider’s handle or id on a line', () => {
    const lines = whatsNewLines(
      { joins: [{ id: 'm1', crewName: 'Ramp Rats', riderName: 'Leo', joinedAt: NOW }] },
      CLOCK,
    );

    expect(Object.keys(lines[0] ?? {}).sort()).toEqual(
      ['ahead', 'at', 'id', 'kind', 'line', 'riderName'].sort(),
    );
  });
});

describe('the unseen count', () => {
  const lines = whatsNewLines(
    {
      stickers: [
        { id: 's1', name: 'One', earnedAt: '2026-09-10T09:00:00.000Z' },
        { id: 's2', name: 'Two', earnedAt: '2026-09-15T09:00:00.000Z' },
        { id: 's3', name: 'Three', earnedAt: '2026-09-16T09:00:00.000Z' },
      ],
    },
    CLOCK,
  );

  it('counts everything for a rider who has never looked', () => {
    expect(unseenWhatsNew(lines, null)).toBe(3);
    expect(unseenWhatsNew(lines, '')).toBe(3);
  });

  it('counts only what arrived since', () => {
    expect(unseenWhatsNew(lines, '2026-09-14T00:00:00.000Z')).toBe(2);
    expect(unseenWhatsNew(lines, '2026-09-16T10:00:00.000Z')).toBe(0);
  });

  it('treats a line stamped exactly when the rider looked as seen', () => {
    // Otherwise "mark all read" leaves a badge nothing can clear.
    expect(unseenWhatsNew(lines, '2026-09-16T09:00:00.000Z')).toBe(0);
  });

  it('accepts the stamp in the shape PocketBase hands it back', () => {
    expect(unseenWhatsNew(lines, '2026-09-14 00:00:00.000Z')).toBe(2);
  });

  it('counts everything when the stamp is unreadable, rather than nothing', () => {
    expect(unseenWhatsNew(lines, 'whenever')).toBe(3);
  });
});
