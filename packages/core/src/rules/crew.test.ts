import { describe, expect, it } from 'vitest';

import {
  CREW_CAPS,
  CREW_NAME_MAX_LENGTH,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  MAX_OWNED_CREWS,
  SUPERVISED_MIN_DIFF,
  crewActivityLine,
  crewCapFor,
  crewCapMessage,
  crewNameProblem,
  crewSlug,
  formatInviteCode,
  isValidInviteCode,
  needsSupervision,
  normaliseInviteCode,
  sortCrewActivity,
  supervisedTricks,
  type CrewActivityItem,
} from './crew';
import type { Trick } from '../types';

describe('crewNameProblem', () => {
  it('accepts an ordinary crew name', () => {
    expect(crewNameProblem('Ramp Rats')).toBeNull();
    expect(crewNameProblem("Nia's Crew")).toBeNull();
    expect(crewNameProblem('Bay 8 & Co.')).toBeNull();
  });

  it('refuses a name that is too short or too long', () => {
    expect(crewNameProblem(' ')).toBe('Give the crew a name');
    expect(crewNameProblem('x'.repeat(CREW_NAME_MAX_LENGTH + 1))).toMatch(/characters/);
  });

  it('refuses a newline, so a name cannot pretend to be two rows', () => {
    expect(crewNameProblem('Ramp\nRats')).toBe('Letters, numbers and spaces, please');
  });
});

describe('crewSlug', () => {
  it('slugs a name and keeps the disambiguating suffix', () => {
    expect(crewSlug('Ramp Rats', 'K3M9')).toBe('ramp-rats-k3m9');
  });

  it('still produces a slug when the name has nothing sluggable in it', () => {
    expect(crewSlug('!!!', 'K3M9')).toBe('crew-k3m9');
  });

  it('stays inside the field length', () => {
    expect(crewSlug('a'.repeat(60), 'zzzz').length).toBeLessThanOrEqual(40);
  });
});

describe('invite codes', () => {
  it('leaves out the characters people confuse when typing', () => {
    for (const ch of ['I', 'L', 'O', '0', '1']) {
      expect(INVITE_CODE_ALPHABET).not.toContain(ch);
    }
  });

  it('normalises the hyphen, the case and the whitespace a paste brings with it', () => {
    expect(normaliseInviteCode(' abcde-fghjk ')).toBe('ABCDEFGHJK');
    expect(normaliseInviteCode('«ABCDE—FGHJK»')).toBe('ABCDEFGHJK');
  });

  it('folds in surrounding prose rather than reading past it, so the length check catches it', () => {
    expect(isValidInviteCode('join code ABCDE-FGHJK')).toBe(false);
  });

  it('accepts a full-length code and refuses a short one', () => {
    expect(isValidInviteCode('abcde-fghjk')).toBe(true);
    expect(isValidInviteCode('abcde')).toBe(false);
    expect(isValidInviteCode('')).toBe(false);
  });

  it('formats a stored code in two readable halves', () => {
    expect(formatInviteCode('ABCDEFGHJK')).toBe('ABCDE-FGHJK');
    expect(formatInviteCode('ABCDEFGHJK')).toHaveLength(INVITE_CODE_LENGTH + 1);
  });
});

describe('crewActivityLine', () => {
  const base: CrewActivityItem = {
    id: '1',
    kind: 'stage',
    riderId: 'r1',
    riderName: 'Nia',
    handle: 'nia',
    at: '2026-08-16T10:00:00Z',
  };

  it('says what happened, in the product’s own words', () => {
    expect(crewActivityLine({ ...base, stage: 'some', trickName: 'Tailwhip' })).toBe(
      'landed Tailwhip',
    );
    expect(crewActivityLine({ ...base, stage: 'every', trickName: 'Kickflip' })).toBe(
      'landed Kickflip every time',
    );
    expect(crewActivityLine({ ...base, stage: 'trying', trickName: 'Tre Flip' })).toBe(
      'started learning Tre Flip',
    );
    expect(crewActivityLine({ ...base, stage: 'want', trickName: 'Bar Spin' })).toBe(
      'added Bar Spin to their list',
    );
    expect(crewActivityLine({ ...base, kind: 'sticker', stickerName: 'Ledge Rat' })).toBe(
      'earned the Ledge Rat sticker',
    );
    expect(crewActivityLine({ ...base, kind: 'session' })).toBe('logged a session');
  });

  it('says nothing about a session but that it happened', () => {
    /*
     * A session knows where a rider was and when (plan §1 D1), and its aim and
     * notes are a child's own words. None of that may reach a crew-mate, so the
     * line is fixed: anything passed alongside it is ignored rather than
     * quietly appended by a later edit to the switch above.
     */
    expect(
      crewActivityLine({
        ...base,
        kind: 'session',
        trickName: 'Tailwhip',
        stage: 'every',
        stickerName: 'Ledge Rat',
      }),
    ).toBe('logged a session');
  });
});

describe('sortCrewActivity', () => {
  const at = (id: string, iso: string): CrewActivityItem => ({
    id,
    kind: 'stage',
    riderId: 'r',
    riderName: 'R',
    handle: 'r',
    at: iso,
  });

  it('is chronological, newest first, and nothing else', () => {
    const sorted = sortCrewActivity([
      at('a', '2026-08-14T00:00:00Z'),
      at('c', '2026-08-16T00:00:00Z'),
      at('b', '2026-08-15T00:00:00Z'),
    ]);
    expect(sorted.map((i) => i.id)).toEqual(['c', 'b', 'a']);
  });

  it('breaks a tie deterministically, so two runs agree', () => {
    const same = '2026-08-16T00:00:00Z';
    expect(sortCrewActivity([at('b', same), at('a', same)]).map((i) => i.id)).toEqual(['a', 'b']);
    expect(sortCrewActivity([at('a', same), at('b', same)]).map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('does not mutate what it was given', () => {
    const input = [at('a', '2026-08-14T00:00:00Z'), at('b', '2026-08-16T00:00:00Z')];
    sortCrewActivity(input);
    expect(input.map((i) => i.id)).toEqual(['a', 'b']);
  });
});

describe('supervisedTricks', () => {
  /** A trick with no `supervise` key at all — a row from before the column. */
  const trick = (id: string, diff: number): Trick =>
    ({ id, name: id, sport: 'scooter', cat: 'park', diff }) as Trick;

  /** A trick whose flag has been answered, either way. */
  const flagged = (id: string, diff: number, supervise: boolean): Trick =>
    ({ id, name: id, sport: 'scooter', cat: 'park', diff, supervise }) as Trick;

  it('reads the flag, not the difficulty', () => {
    const list = [flagged('flat-five', 5, false), flagged('drop-in', 2, true)];
    expect(supervisedTricks(list).map((t) => t.id)).toEqual(['drop-in']);
  });

  it('lists a marked trick well below difficulty 5', () => {
    expect(needsSupervision(flagged('drop-in', 2, true))).toBe(true);
    expect(needsSupervision(flagged('bmx-drop-in', 3, true))).toBe(true);
  });

  it('drops an unmarked difficulty-5 trick once the rows carry the flag', () => {
    // A Truckdriver is a 360 with a barspin: difficulty 5 for complexity, not
    // for consequence (Rachid, 2026-09-04, in chat). Nobody marked it, so the
    // guardian is not told to stand over it.
    expect(needsSupervision(flagged('truckdriver', 5, false))).toBe(false);
    expect(supervisedTricks([flagged('truckdriver', 5, false)])).toEqual([]);
  });

  it('falls back to difficulty when the flag is absent, never to nothing', () => {
    // The failure this guards: a database whose `tricks` collection predates
    // the `supervise` column hands every rule `undefined`, and answering "no"
    // there would tell a guardian nothing needs supervising at all.
    expect(SUPERVISED_MIN_DIFF).toBe(5);
    expect(trick('b', 5).supervise).toBeUndefined();
    expect(needsSupervision(trick('a', 4))).toBe(false);
    expect(needsSupervision(trick('b', 5))).toBe(true);
    expect(supervisedTricks([trick('a', 4), trick('b', 5)]).map((t) => t.id)).toEqual(['b']);
  });

  it('mixes the two: a flagged trick and an unmigrated one both count', () => {
    const list = [flagged('drop-in', 2, true), trick('old-pro-trick', 5), trick('old-easy', 3)];
    expect(supervisedTricks(list).map((t) => t.id)).toEqual(['drop-in', 'old-pro-trick']);
  });
});

describe('how many crews a plan may create', () => {
  /*
   * The owner's numbers (Rachid, 2026-09-17, in chat: "1 for free, 3 for 3.99
   * and 10 for the top tier"), and the fail-closed floor under them.
   *
   * What the server enforces is the `plans` record, not these constants —
   * `planCrewCap` in `pocketbase/hooks/lib/landit.js` reads the column, and
   * `pocketbase/tests/crews.test.ts` reads the number back off the record
   * rather than assuming it. What is checked here is the shape of the rule: the
   * three numbers `PLANS` and the migration are seeded from, and that an absent
   * or nonsense cap reads as one rather than as none.
   */
  it('carries the three numbers the plans and the migration share', () => {
    expect(CREW_CAPS).toEqual({ rookie: 1, shredder: 3, legend: 10 });
    expect(CREW_CAPS.rookie).toBeLessThanOrEqual(MAX_OWNED_CREWS);
    expect(CREW_CAPS.shredder).toBeLessThanOrEqual(MAX_OWNED_CREWS);
  });

  it('reads a missing cap as one, never as none', () => {
    // A rider whose plan record cannot be read still runs the crew they have:
    // failing closed on a cap for *creating* means the smallest allowance, not
    // nothing at all.
    expect(crewCapFor(null)).toBe(1);
    expect(crewCapFor(undefined)).toBe(1);
    expect(crewCapFor({})).toBe(1);
    expect(crewCapFor({ crewCap: 0 })).toBe(1);
    expect(crewCapFor({ crewCap: -3 })).toBe(1);
  });

  it('takes the plan record’s number when there is one', () => {
    expect(crewCapFor({ crewCap: 3 })).toBe(3);
    expect(crewCapFor({ crewCap: 10 })).toBe(10);
  });

  it('says the refusal in words that agree with the number', () => {
    expect(crewCapMessage(1, 'Rookie')).toBe('Rookie runs 1 crew at once.');
    expect(crewCapMessage(3, 'Shredder')).toBe('Shredder runs 3 crews at once.');
  });
});
