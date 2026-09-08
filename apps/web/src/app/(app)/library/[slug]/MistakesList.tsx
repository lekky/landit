import type { SportId, TrickMistake } from '@landit/core';

import { GlossaryText } from '@/components/glossary/GlossaryText';

import styles from './trick.module.css';

/**
 * "Why it isn't working" (T32, the pack's section D): the trick's common
 * mistakes, each with its fix, as numbered rows under the Tips.
 *
 * The rows are the pack's — an ink square with the number, the mistake in
 * bold, the fix in body copy after it — stacked so they share their borders.
 * The list is an `<ol>` and the drawn number is `aria-hidden`: the list numbers
 * itself for a screen reader, and the square is the same fact drawn for a
 * sighted one.
 *
 * The fix goes through `GlossaryText` and the mistake does not. The fix is a
 * sentence a rider reads, and the words in it are the words the glossary
 * explains; the mistake is a heading, and a dotted word in a heading reads as
 * emphasis rather than "this is explained".
 *
 * The content is `Trick.mistakes` (T28), and the page draws this only when
 * there is some — a database older than the column returns nothing, and
 * *absent* means "not written yet", never "there are none" (plan §7, T28).
 */
export function MistakesList({
  mistakes,
  slug,
  sport,
}: {
  mistakes: readonly TrickMistake[];
  /** The trick's slug, so a glossary link can offer the way back. */
  slug: string;
  sport: SportId;
}) {
  return (
    <ol className={styles.mistakes} aria-label="Why it isn't working">
      {mistakes.map((mistake, index) => (
        <li key={index} className={styles.mistake}>
          <span className={`d ${styles.mistakeNumber}`} aria-hidden="true">
            {index + 1}
          </span>
          <p className={styles.mistakeBody}>
            <b className={styles.mistakeWhat}>{mistake.what}</b>{' '}
            <GlossaryText text={mistake.fix} from={slug} sport={sport} />
          </p>
        </li>
      ))}
    </ol>
  );
}
