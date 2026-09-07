import { GLOSSARY, type GlossaryTerm } from '../data/glossary';
import type { SportId } from '../types';

/**
 * Finding glossary words in a piece of copy, and shaping the glossary for the
 * page that lists it (plan §7, T29).
 *
 * The matcher is the part that can go wrong quietly. A glossary link that lands
 * on the wrong sense of a word — "hips" the body part sent to a ramp corner,
 * "Truck Driver" the trick sent to a skateboard part — is worse than no link,
 * because it teaches a twelve year old the wrong thing with the product's own
 * authority behind it. So every rule below is the conservative one, and the
 * traps the glossary research recorded are pinned by `glossary.test.ts`:
 *
 *  - **Whole words only.** `rail` does not match inside "handrail"; `hip` does
 *    not match "hips". A word character is a letter or a digit, so a hyphen
 *    and an apostrophe are boundaries ("kerb-drop", "deck's").
 *  - **Case-insensitive**, because copy starts sentences with these words.
 *  - **Longest match wins.** "handrail" is its own term and beats "rail";
 *    "flat rail" (an alias of Rail) beats "flat" (a term of its own).
 *  - **Exclusions are matched first and never linked.** A term's `except`
 *    phrases are found and fenced off before any term is tried, which is how
 *    "Truck Driver" keeps its "truck".
 *  - **First occurrence per term only.** Body copy that says "deck" four times
 *    links it once, at the first mention in reading order, which is what a
 *    reader who does not know the word needs and what a reader who does is not
 *    made to wade through.
 *  - **No overlap.** Two links cannot share a character.
 *
 * Pure and platform-free, so the trick page's server render, the native app
 * and the unit tests all agree about which word is a link.
 */

/** One linked run of `text`: `[start, end)` and the glossary slug it means. */
export interface GlossaryMatch {
  readonly start: number;
  readonly end: number;
  readonly slug: string;
}

/**
 * A piece of copy split into runs, in order, for a renderer: each run is
 * either plain text or a linked term. Concatenating the `text`s gives the
 * input back exactly.
 */
export interface GlossarySegment {
  readonly text: string;
  /** Absent on a plain run. */
  readonly slug?: string;
}

/** The letters the jump strip offers, in order. `#` is anything digit-led. */
export const GLOSSARY_LETTERS: readonly string[] = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

/** A term grouped under the strip's letter with the others that share it. */
export interface GlossaryLetterGroup {
  readonly letter: string;
  readonly terms: readonly GlossaryTerm[];
}

const WORD_CHAR = /[A-Za-z0-9]/;

const escapeRegExp = (phrase: string): string => phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A phrase to look for, and what finding it means: a slug, or a fence. */
interface Needle {
  readonly phrase: string;
  readonly slug: string | null;
}

/**
 * Every phrase worth searching for, longest first so the sweep below can be
 * greedy. Built per call rather than cached because `terms` is a parameter —
 * the default is the canonical list, but a caller may hand in a subset.
 */
function needles(terms: readonly GlossaryTerm[]): Needle[] {
  const out: Needle[] = [];
  for (const term of terms) {
    for (const phrase of term.except ?? []) out.push({ phrase, slug: null });
    out.push({ phrase: term.term, slug: term.slug });
    for (const phrase of term.aliases) out.push({ phrase, slug: term.slug });
  }
  return out.filter((n) => n.phrase.trim().length > 0);
}

/** Whether `[start, end)` in `text` sits on word boundaries at both ends. */
function wholeWord(text: string, start: number, end: number): boolean {
  const before = start > 0 ? text.charAt(start - 1) : '';
  const after = end < text.length ? text.charAt(end) : '';
  return !WORD_CHAR.test(before) && !WORD_CHAR.test(after);
}

/**
 * The non-overlapping glossary matches in `text`, in reading order — one per
 * term, at its first mention, longest phrase winning where phrases overlap.
 *
 * Every candidate occurrence of every phrase is collected first, then resolved
 * in one greedy sweep ordered by length and then position. Resolving over the
 * whole text rather than phrase by phrase is what makes "first occurrence"
 * mean first in *reading* order: if "tailwhip" appears after "whip", both are
 * the Whip term, and the earlier one is the link.
 */
export function glossaryMatches(
  text: string,
  terms: readonly GlossaryTerm[] = GLOSSARY,
): GlossaryMatch[] {
  if (!text) return [];

  const candidates: { start: number; end: number; slug: string | null }[] = [];
  for (const needle of needles(terms)) {
    const pattern = new RegExp(escapeRegExp(needle.phrase), 'gi');
    for (const found of text.matchAll(pattern)) {
      const start = found.index;
      const end = start + found[0].length;
      if (wholeWord(text, start, end)) candidates.push({ start, end, slug: needle.slug });
    }
  }

  // Longest first; at equal length, the earlier. Exclusions sit among the
  // candidates like any other phrase, so a longer fence beats a shorter term
  // over the same characters and then blocks it.
  candidates.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);

  const taken: { start: number; end: number }[] = [];
  const overlaps = (start: number, end: number) =>
    taken.some((range) => start < range.end && end > range.start);

  const kept: GlossaryMatch[] = [];
  for (const candidate of candidates) {
    if (overlaps(candidate.start, candidate.end)) continue;
    taken.push(candidate);
    if (candidate.slug)
      kept.push({ start: candidate.start, end: candidate.end, slug: candidate.slug });
  }

  kept.sort((a, b) => a.start - b.start);
  const seen = new Set<string>();
  return kept.filter((match) => {
    if (seen.has(match.slug)) return false;
    seen.add(match.slug);
    return true;
  });
}

/**
 * `text` as alternating plain and linked runs, for a renderer that wants to
 * wrap the links and leave the rest alone (`GlossaryText` on the web).
 */
export function glossarySegments(
  text: string,
  terms: readonly GlossaryTerm[] = GLOSSARY,
): GlossarySegment[] {
  const segments: GlossarySegment[] = [];
  let cursor = 0;
  for (const match of glossaryMatches(text, terms)) {
    if (match.start > cursor) segments.push({ text: text.slice(cursor, match.start) });
    segments.push({ text: text.slice(match.start, match.end), slug: match.slug });
    cursor = match.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}

/** The term with this slug, or `undefined`. */
export function glossaryTerm(
  slug: string,
  terms: readonly GlossaryTerm[] = GLOSSARY,
): GlossaryTerm | undefined {
  return terms.find((term) => term.slug === slug);
}

/** The terms a sport uses, or all of them. */
export function glossaryFor(
  sport: SportId | null,
  terms: readonly GlossaryTerm[] = GLOSSARY,
): GlossaryTerm[] {
  return sport ? terms.filter((term) => term.sports.includes(sport)) : [...terms];
}

/**
 * The strip letter a term files under: its first character, uppercased, or
 * `#` for anything that starts with a digit ("50-50" if it ever lands here).
 */
export function glossaryLetter(term: Pick<GlossaryTerm, 'term'>): string {
  const first = term.term.charAt(0);
  return /[0-9]/.test(first) ? '#' : first.toUpperCase();
}

/**
 * The list grouped by strip letter, in the order the terms already have.
 * Letters with no terms are absent — the strip greys those from
 * `GLOSSARY_LETTERS` by checking which are here.
 */
export function groupGlossaryByLetter(terms: readonly GlossaryTerm[]): GlossaryLetterGroup[] {
  const groups: { letter: string; terms: GlossaryTerm[] }[] = [];
  for (const term of terms) {
    const letter = glossaryLetter(term);
    const last = groups[groups.length - 1];
    if (last && last.letter === letter) last.terms.push(term);
    else groups.push({ letter, terms: [term] });
  }
  return groups;
}
