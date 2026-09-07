import { describe, expect, it } from 'vitest';

import { GLOSSARY, type GlossaryTerm } from '../data/glossary';
import { TRICKS } from '../data/tricks';
import {
  GLOSSARY_LETTERS,
  glossaryFor,
  glossaryLetter,
  glossaryMatches,
  glossarySegments,
  glossaryTerm,
  groupGlossaryByLetter,
} from './glossary';

/**
 * The matcher's rules, each pinned by the trap it exists for. Most of these
 * came out of reading the trick copy for the words the glossary research
 * listed: the false positives are the real cost of an inline link, and a test
 * that only checks the true positives would let every one of them back in.
 */

/** The slugs `glossaryMatches` found, in reading order. */
const slugsIn = (text: string, terms: readonly GlossaryTerm[] = GLOSSARY): string[] =>
  glossaryMatches(text, terms).map((m) => m.slug);

/** The exact text under each match, so a boundary bug shows as a word. */
const wordsIn = (text: string): string[] =>
  glossaryMatches(text).map((m) => text.slice(m.start, m.end));

describe('glossaryMatches', () => {
  it('finds a term as a whole word, case-insensitively, and reports its span', () => {
    const text = 'Learn it off a Kerb first.';
    const [match] = glossaryMatches(text);
    expect(match).toEqual({ start: 15, end: 19, slug: 'kerb' });
    expect(text.slice(match!.start, match!.end)).toBe('Kerb');
  });

  it('finds an alias and reports the term it belongs to', () => {
    expect(slugsIn('Try it on a curb.')).toEqual(['kerb']);
    expect(slugsIn('Pop the tail, then land bolts.')).toContain('pop');
  });

  it('does not let `hip` match "hips" — the body part, not the ramp corner', () => {
    expect(slugsIn('Pull the bars to your hips so both wheels leave the ground.')).not.toContain(
      'hip',
    );
    // The corner itself still links.
    expect(slugsIn('Air over the hip and land in the next quarter.')).toContain('hip');
  });

  it('does not let `rail` match inside "handrail", which is its own term', () => {
    expect(wordsIn('Never a handrail down a set of stairs.')).toContain('handrail');
    expect(slugsIn('Never a handrail down a set of stairs.')).not.toContain('rail');
    expect(slugsIn('A low rail close to the ground.')).toContain('rail');
  });

  it('does not let `trucks` match inside "Truck Driver", which is a trick', () => {
    expect(slugsIn('The Truck Driver is a 360 with a barspin.')).not.toContain('trucks');
    expect(slugsIn('A truck driver, brakeless.')).not.toContain('trucks');
    // The part on its own still links, in either form.
    expect(slugsIn('Land with the front truck first.')).toContain('trucks');
    expect(slugsIn('Both trucks on the ledge.')).toContain('trucks');
  });

  it('lets `deck` match every sense the word has', () => {
    expect(slugsIn('Kick the deck round a full turn.')).toContain('deck');
    expect(slugsIn('Wait on the deck of the ramp, then drop in.')).toContain('deck');
    expect(slugsIn('Flip the deck with your front foot.')).toContain('deck');
  });

  it('links each term once, at its first mention in reading order', () => {
    const text = 'Kick the deck. Catch the deck. Look at the deck.';
    const matches = glossaryMatches(text).filter((m) => m.slug === 'deck');
    expect(matches).toHaveLength(1);
    expect(matches[0]!.start).toBe(text.indexOf('deck'));
  });

  it('counts an alias and its term as one term for "first mention"', () => {
    // "whip" first, then "tailwhip" — both are Whip, and the earlier wins even
    // though "tailwhip" is the longer phrase.
    const text = 'The whip comes round; a tailwhip is the same thing.';
    const whips = glossaryMatches(text).filter((m) => m.slug === 'whip');
    expect(whips).toHaveLength(1);
    expect(text.slice(whips[0]!.start, whips[0]!.end)).toBe('whip');
  });

  it('prefers the longest phrase where two overlap', () => {
    // "flat rail" is an alias of Rail; "flat" is a term of its own.
    const text = 'Grind a flat rail before anything taller.';
    expect(wordsIn(text)).toContain('flat rail');
    expect(slugsIn(text)).not.toContain('flat');
  });

  it('never returns overlapping spans', () => {
    const text = TRICKS.map((t) => `${t.about} ${t.tips} ${t.fact}`).join(' ');
    const matches = glossaryMatches(text);
    for (let i = 1; i < matches.length; i += 1) {
      expect(matches[i]!.start).toBeGreaterThanOrEqual(matches[i - 1]!.end);
    }
  });

  it('treats a hyphen and an apostrophe as word boundaries', () => {
    expect(slugsIn("The deck's edge, off a kerb-drop.")).toEqual(
      expect.arrayContaining(['deck', 'kerb']),
    );
    // A digit is a word character, so "180s" is not the alias "180".
    expect(slugsIn('Two 180s in a row.')).not.toContain('spins');
    expect(slugsIn('A clean 180 off the bank.')).toContain('spins');
  });

  it('returns nothing for empty copy or copy with no glossary words', () => {
    expect(glossaryMatches('')).toEqual([]);
    expect(glossaryMatches('Nothing here means anything.')).toEqual([]);
  });

  it('matches against the terms it is given, not only the canonical list', () => {
    const custom: GlossaryTerm[] = [
      {
        term: 'Zorp',
        slug: 'zorp',
        aliases: ['zorping'],
        sports: ['scooter'],
        definition: 'Made up.',
        seeIn: [],
        except: ['zorp lord'],
      },
    ];
    expect(slugsIn('Zorping is zorp.', custom)).toEqual(['zorp']);
    expect(slugsIn('The Zorp Lord.', custom)).toEqual([]);
    expect(slugsIn('A kerb.', custom)).toEqual([]);
  });
});

describe('glossarySegments', () => {
  it('splits copy into plain and linked runs that rebuild the input exactly', () => {
    const text = 'Learn it off a kerb or a small drop first; the deck gets round.';
    const segments = glossarySegments(text);
    expect(segments.map((s) => s.text).join('')).toBe(text);
    expect(segments.filter((s) => s.slug).map((s) => [s.text, s.slug])).toEqual([
      ['kerb', 'kerb'],
      ['deck', 'deck'],
    ]);
    // Plain runs carry no slug at all, not an empty one.
    for (const plain of segments.filter((s) => !s.slug)) expect('slug' in plain).toBe(false);
  });

  it('returns one plain run for copy with nothing to link', () => {
    expect(glossarySegments('Nothing here.')).toEqual([{ text: 'Nothing here.' }]);
    expect(glossarySegments('')).toEqual([]);
  });
});

describe('the glossary shaped for the page', () => {
  it('looks a term up by slug', () => {
    expect(glossaryTerm('kerb')?.term).toBe('Kerb');
    expect(glossaryTerm('nope')).toBeUndefined();
  });

  it('filters to the terms a sport uses, and gives every sport at least one', () => {
    expect(glossaryFor(null)).toHaveLength(GLOSSARY.length);
    for (const sport of ['scooter', 'skate', 'bmx'] as const) {
      const terms = glossaryFor(sport);
      expect(terms.length).toBeGreaterThan(0);
      for (const term of terms) expect(term.sports).toContain(sport);
    }
    // Brake is BMX only; Ollie is not scooter.
    expect(glossaryFor('scooter').map((t) => t.slug)).not.toContain('brake');
    expect(glossaryFor('bmx').map((t) => t.slug)).toContain('brake');
  });

  it('files a term under its first letter, and digit-led ones under #', () => {
    expect(glossaryLetter({ term: 'Kerb' })).toBe('K');
    expect(glossaryLetter({ term: 'front foot' })).toBe('F');
    expect(glossaryLetter({ term: '50-50' })).toBe('#');
    expect(GLOSSARY_LETTERS[0]).toBe('#');
    expect(GLOSSARY_LETTERS).toHaveLength(27);
  });

  it('groups consecutive terms by letter, keeping their order', () => {
    const groups = groupGlossaryByLetter(GLOSSARY);
    expect(groups.map((g) => g.letter)).toEqual([...new Set(GLOSSARY.map(glossaryLetter))]);
    expect(groups.flatMap((g) => g.terms)).toEqual(GLOSSARY);
    for (const group of groups) expect(GLOSSARY_LETTERS).toContain(group.letter);
  });
});
