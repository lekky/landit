import { describe, expect, it } from 'vitest';

import { GLOSSARY } from './glossary';
import { SPORT_IDS } from './sports';
import { TRICKS } from './tricks';
import { glossaryLetter, glossaryMatches } from '../rules/glossary';

/**
 * The glossary's invariants: the shape the page relies on and the promises the
 * file's own comment makes. Checked here rather than trusted, for the reason
 * `data.test.ts` gives about every other canonical list.
 */

const trickIds = new Set(TRICKS.map((t) => t.id));

describe('the glossary', () => {
  it('holds the 84 terms the 2026-09-07 research shipped', () => {
    expect(GLOSSARY).toHaveLength(84);
  });

  it('has unique slugs, each shaped like a URL fragment', () => {
    const slugs = GLOSSARY.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('is sorted A–Z by term, so the page can group without sorting', () => {
    const terms = GLOSSARY.map((t) => t.term.toLowerCase());
    const sorted = [...terms].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(terms).toEqual(sorted);
  });

  it('files every term under a letter the jump strip offers', () => {
    for (const term of GLOSSARY) expect(glossaryLetter(term)).toMatch(/^[#A-Z]$/);
  });

  it('names only tricks that exist in every seeIn', () => {
    for (const term of GLOSSARY) {
      for (const id of term.seeIn) expect(trickIds.has(id), `${term.slug} → ${id}`).toBe(true);
    }
  });

  it('gives every term at least one sport, and only real ones', () => {
    for (const term of GLOSSARY) {
      expect(term.sports.length, term.slug).toBeGreaterThan(0);
      for (const sport of term.sports) expect(SPORT_IDS).toContain(sport);
      expect(new Set(term.sports).size).toBe(term.sports.length);
    }
  });

  it('has a definition and no empty or duplicated alias', () => {
    for (const term of GLOSSARY) {
      expect(term.definition.trim().length, term.slug).toBeGreaterThan(20);
      const phrases = [term.term, ...term.aliases].map((p) => p.toLowerCase());
      expect(new Set(phrases).size, term.slug).toBe(phrases.length);
      for (const alias of term.aliases) expect(alias.trim(), term.slug).toBe(alias);
    }
  });

  it('never lets one phrase mean two terms', () => {
    // An alias shared by two terms would link to whichever sorted first, which
    // is a coin toss a rider cannot see. Every phrase belongs to one slug.
    const owner = new Map<string, string>();
    for (const term of GLOSSARY) {
      for (const phrase of [term.term, ...term.aliases]) {
        const key = phrase.toLowerCase();
        expect(owner.get(key) ?? term.slug, `"${phrase}"`).toBe(term.slug);
        owner.set(key, term.slug);
      }
    }
  });

  it('is found in the copy of the tricks it says to see it in', () => {
    // `seeIn` is the page's "See it in" link, and the claim is that the
    // trick's copy uses the word. Six of the research's links are on sense
    // rather than wording — the copy describes the thing without saying it —
    // and they are named here so the list cannot grow unnoticed. Remove one
    // when the copy catches up; add one only with the same care.
    const LINKED_ON_SENSE = [
      'drop-in → quarter-pipe-air',
      'endo → bmx-nosepick',
      'hang-up → sk-rock-n-roll',
      'kickturn → sk-fakie-roll',
      'line → bmx-hip-transfer',
      'spot → 540',
    ];
    const missing: string[] = [];
    for (const term of GLOSSARY) {
      for (const id of term.seeIn) {
        const trick = TRICKS.find((t) => t.id === id)!;
        const copy = `${trick.name} ${trick.about} ${trick.tips} ${trick.fact}`;
        if (glossaryMatches(copy, [term]).length === 0) missing.push(`${term.slug} → ${id}`);
      }
    }
    expect(missing).toEqual(LINKED_ON_SENSE);
  });

  it('never links the traps the research recorded, across the whole library', () => {
    // The unit cases in `../rules/glossary.test.ts` pin each trap on a
    // sentence. This runs the matcher over every trick's copy and asserts the
    // wrong senses are absent, so a new alias that reintroduces one fails here
    // before it reaches a page.
    const wrong: string[] = [];
    for (const trick of TRICKS) {
      for (const field of [trick.about, trick.tips, trick.fact]) {
        for (const match of glossaryMatches(field)) {
          const around = field.slice(Math.max(0, match.start - 12), match.end + 12).toLowerCase();
          const word = field.slice(match.start, match.end).toLowerCase();
          if (match.slug === 'hip' && /hips|from the hip/.test(around)) wrong.push(around);
          if (match.slug === 'trucks' && /truck driver/.test(around)) wrong.push(around);
          if (match.slug === 'rail' && /handrail/.test(word)) wrong.push(around);
          if (match.slug === 'stairs' && word === 'set') wrong.push(around);
          if (match.slug === 'park' && /car park/.test(around)) wrong.push(around);
          if (match.slug === 'run' && /run-up|runs out|\blap\b/.test(around)) wrong.push(around);
        }
      }
    }
    expect(wrong).toEqual([]);
  });
});
