import styles from './trick.module.css';

/**
 * A reading-column heading as the 2026-09-07 pack draws it: a diamond in the
 * category colour, the title in Anton, and an ink rule taking the rest of the
 * row. T26's eleven-pixel "◆ The lowdown" label was fine for a column with
 * four sections; the trick page now has seven, and the rule is what separates
 * them.
 *
 * It lives in its own file rather than beside the page because the **locked**
 * trick page borrows it now too (2026-09-16): the two pages draw the same
 * "The lowdown" heading over the same copy, and one of them showing a slightly
 * different one would be the seam a rider notices on the way past the paywall.
 */
export function SectionHead({ color, children }: { color: string; children: string }) {
  return (
    <div className={styles.sectionHead}>
      <span className={styles.sectionDiamond} style={{ background: color }} aria-hidden="true" />
      <h2 className={`d ${styles.sectionTitle}`}>{children}</h2>
      <span className={styles.sectionRule} aria-hidden="true" />
    </div>
  );
}
