import styles from '@/components/sessions/detail/loading.module.css';

/**
 * The instant state while a session is read: the hero's shape in its own
 * orange, and the stat strip as an empty band, so the page arrives where the
 * rider was already looking. No words that could turn out to be wrong.
 */
export default function Loading() {
  return (
    <div className={styles.page} aria-busy="true" aria-label="Loading the session">
      <div className={styles.card}>
        <div className={styles.hero}>
          <span className={styles.pill} />
          <span className={styles.title} />
        </div>
        <div className={styles.strip} />
      </div>
    </div>
  );
}
