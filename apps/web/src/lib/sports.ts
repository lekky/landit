import { SPORTS, SPORT_IDS, type SportId } from '@landit/core';
import type { IconName, SportLook } from '@landit/ui-web';

/**
 * Sport presentation for the web app, and the copy that has to count them.
 *
 * Land The Trick ships three sports (plan §1), and T21 is what widens `SPORT_IDS` from
 * two to three. Nothing here may hard-code a scooter/skate pair: every list and
 * every sentence that mentions the sports is generated from `SPORT_IDS`, so the
 * day BMX lands the landing page, the metadata and the sport switch all pick it
 * up without a copy sweep. Two today, three then, and neither number is written
 * down anywhere below.
 */

/** Sport records in offer order, shaped for the design system's props. */
export const SPORT_LOOKS: Readonly<Record<SportId, SportLook>> = Object.fromEntries(
  SPORT_IDS.map((id) => [
    id,
    { label: SPORTS[id].label, color: SPORTS[id].color, icon: SPORTS[id].icon as IconName },
  ]),
) as Readonly<Record<SportId, SportLook>>;

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six'] as const;

/** "two", "three" — for copy that counts the libraries. Falls back to digits. */
export function countWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/** Sentence-cases the first character, leaving the rest alone. */
export function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "scooter and skateboard", "scooter, skateboard and BMX". */
export function sportsList(ids: readonly SportId[] = SPORT_IDS): string {
  const names = ids.map((id) => lowerLabel(id));
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * A sport's label as it reads mid-sentence. Proper nouns keep their case, so
 * "BMX" survives while "Skateboard" becomes "skateboard" — a label is an
 * acronym when it has no lowercase letters in it.
 *
 * Exported since the SEO work, which needed the same rule in prose a machine
 * reads: a trick page describing itself as "a bmx trick" is the one sentence an
 * answer engine is most likely to quote back.
 */
export function lowerLabel(id: SportId): string {
  const label = SPORTS[id].label;
  return /[a-z]/.test(label) ? label.toLowerCase() : label;
}

/** "a scooter or a skateboard", "a scooter, a skateboard or a BMX". */
export function sportsWithArticles(ids: readonly SportId[] = SPORT_IDS): string {
  const names = ids.map((id) => `a ${lowerLabel(id)}`);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

/**
 * The hero's "pick what you ride" line.
 *
 * Two sports get "or both", which is the copy in the design pack and in
 * screenshot 01. Three or more cannot, so they get the open-ended version.
 */
export function sportsChoicePhrase(ids: readonly SportId[] = SPORT_IDS): string {
  const names = ids.map((id) => lowerLabel(id));
  if (names.length < 2) return sentenceCase(names[0] ?? '');
  if (names.length === 2) return sentenceCase(`${names[0]}, ${names[1]} or both`);
  return sentenceCase(
    `${names.slice(0, -1).join(', ')}, ${names[names.length - 1]} — or all of them`,
  );
}
