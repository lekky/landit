'use client';

import styles from './admin.module.css';

/**
 * A screen's filters, with the word that says what they are.
 *
 * The other half of option A (Rachid, 2026-09-14, in chat). Every admin screen
 * used to put its filters in a wrapping row of `.pill`s immediately under the
 * row of twelve section `.pill`s, so the two were indistinguishable — the
 * complaint the redesign started from. This is deliberately a *smaller,
 * quieter* control than a pill: joined rather than free-standing, 11.5px rather
 * than 13, and introduced by a label. It should read as a setting on the
 * screen, never as somewhere to go.
 *
 * It stays **above** the panel rather than inside its header, which is where
 * the mockup drew it. Four screens keep a search box and an `+ Add` button in
 * the same region, and neither is a filter; moving only the filters inside and
 * leaving those outside would have split one toolbar across two surfaces and
 * made four screens disagree with three. One shape everywhere was worth more
 * than the extra 3px of separation.
 *
 * Buttons rather than a `<select>`: the counts are the point, and a closed
 * select hides them.
 */

export type ShowOption = {
  readonly value: string;
  readonly label: string;
  /** Printed after the label. Omit where there is nothing meaningful to count. */
  readonly count?: number;
};

export function ShowBar({
  label = 'Show',
  options,
  value,
  onChange,
}: {
  /**
   * Names what is being narrowed. Defaults to "Show"; screens with two of these
   * say which is which ("Sport", "Tutorial"), because two bars both labelled
   * "Show" would be the original confusion in miniature.
   */
  readonly label?: string;
  readonly options: readonly ShowOption[];
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <div className={styles.showBar} role="group" aria-label={label}>
      <span className={`lab ${styles.showBarLabel}`}>{label}</span>
      <div className={styles.seg}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={styles.segBtn}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
            {option.count === undefined ? null : (
              <span className={styles.segCount}>{option.count}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
