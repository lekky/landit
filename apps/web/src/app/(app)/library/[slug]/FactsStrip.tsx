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
 * Under the three cells, the design's one-sentence "Why it's Spicy" (T32):
 * `Trick.hard`, the staff copy T28 added, as a row with a 2.5px ink rule
 * above it and the tier word in bold — the same word the third cell shows, so
 * the two cannot disagree. Drawn only when the sentence exists: a database
 * older than the column has none, and nothing is drawn rather than a
 * placeholder that explains its own emptiness.
 */
export function FactsStrip({
  facts,
  categoryLabel,
  sportLabel,
  hard,
}: {
  facts: TrickPositionFacts;
  /** "Flat", "Flatground" — the category as this sport names it. */
  categoryLabel: string;
  /** "scooter", "BMX" — as it reads mid-sentence. */
  sportLabel: string;
  /** `Trick.hard` — why it sits at this tier, in one or two sentences. */
  hard?: string;
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
      {hard && (
        <p className={styles.factsWhy}>
          <b>Why it&apos;s {facts.tier}:</b> {hard}
        </p>
      )}
    </div>
  );
}
