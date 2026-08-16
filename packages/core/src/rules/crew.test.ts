import { describe, expect, it } from 'vitest';

import {
  CREW_NAME_MAX_LENGTH,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  SUPERVISED_MIN_DIFF,
  crewActivityLine,
  crewNameProblem,
  crewSlug,
  formatInviteCode,
  isValidInviteCode,
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
  const trick = (id: string, diff: number): Trick =>
    ({ id, name: id, sport: 'scooter', cat: 'park', diff }) as Trick;

  it('is the difficulty the library itself flags for a foam pit', () => {
    expect(SUPERVISED_MIN_DIFF).toBe(5);
    expect(supervisedTricks([trick('a', 4), trick('b', 5)]).map((t) => t.id)).toEqual(['b']);
  });
});
