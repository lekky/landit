import type { TrickPositionFacts } from '@landit/core';

import styles from './trick.module.css';

/**
 * "Where it sits" (T31, section C): three facts about the trick's place in
 * its library, as a strip of three cells.
 *
 * Counts, not an ordinal (Rachid, 2026-09-07, in chat). The design's middle
 * cell read "23 of 84 in the scooter library", which implies an order the
 * library does not have; it now says how big the library is and stops. The
 * first cell's "1 of 9" is a count too — this is one of nine on its shelf —
 * and the label says which shelf.
 *
 * The strip leaves its bottom edge clear on purpose: the design carries a
 * one-sentence "Why it's Spicy" under the three cells, and that sentence is
 * `Trick.hard`, the staff copy t28 added. Drawing it is the follow-up T31
 * names in the plan; it goes here, as a row under the cells with a 2.5px ink
 * rule above it. Until then nothing is drawn rather than a placeholder that
 * explains its own emptiness.
 */
export function FactsStrip({
  facts,
  categoryLabel,
  sportLabel,
}: {
  facts: TrickPositionFacts;
  /** "Flat", "Flatground" — the category as this sport names it. */
  categoryLabel: string;
  /** "scooter", "BMX" — as it reads mid-sentence. */
  sportLabel: string;
}) {
  return (
    <div className={styles.facts}>
      <div className={styles.factsCell}>
        <div className={`d ${styles.factsNumber}`}>1 of {facts.peers}</div>
        <div className={`lab ${styles.factsLabel}`}>
          {categoryLabel} tricks at {facts.tier} on {sportLabel}
        </div>
      </div>
      <div className={styles.factsCell}>
        <div className={`d ${styles.factsNumber}`}>{facts.inSport}</div>
        <div className={`lab ${styles.factsLabel}`}>In the {sportLabel} library</div>
      </div>
      <div className={styles.factsCell}>
        <div className={`d ${styles.factsNumber}`}>{facts.tier}</div>
        <div className={`lab ${styles.factsLabel}`}>Difficulty {facts.diff} of 5</div>
      </div>
    </div>
  );
}
