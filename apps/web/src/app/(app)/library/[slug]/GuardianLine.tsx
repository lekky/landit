import styles from './trick.module.css';

/**
 * "Worth a grown-up knowing" (T31, section E). Drawn only when the trick
 * carries `supervise` — the per-trick flag T27 added for flips, inverts and
 * committed drops — and never inferred from difficulty.
 *
 * It is a fact, not a nag, and the copy is fixed (owner, 2026-09-07): it says
 * what the trick does and where to learn it, once, in a yellow box after the
 * kit row. It does not name a parent, ask for one, or gate anything; the
 * guardian consent gate is a server-side rule (plan §3, guarantee 4) and this
 * line has nothing to do with it.
 */
export function GuardianLine() {
  return (
    <div className={styles.guardian} role="note">
      <span className={styles.guardianMark} aria-hidden="true">
        <span className={styles.guardianBang}>
          <span className={styles.guardianBangText}>!</span>
        </span>
      </span>
      <div>
        <div className={`lab ${styles.guardianLabel}`}>Worth a grown-up knowing</div>
        <p className={styles.guardianBody}>
          This one goes upside down. Learn it into foam or onto a resi ramp first, and don&apos;t
          try it alone.
        </p>
      </div>
    </div>
  );
}
