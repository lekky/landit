'use client';

import { Icon, type IconName } from '@landit/ui-web';
import Link from 'next/link';

import { savedRideLine, type SavedRide } from '@/lib/sessionForm';
import { sessionHref } from '@/lib/sessionRoutes';

import { ChevronRight } from './FullForm';
import styles from './form.module.css';

export type FreshSection = 'tricks' | 'clip' | 'notes';

const PROMPTS: readonly { section: FreshSection; label: string; icon: IconName }[] = [
  { section: 'tricks', label: 'Tricks you worked on', icon: 'grid' },
  { section: 'clip', label: 'A clip', icon: 'cam' },
  { section: 'notes', label: 'Notes and the aim', icon: 'pencil' },
];

/**
 * The saved state (1d): a green confirmation naming the streak and the weekly
 * target, then — after a quick log — three optional "while it's fresh"
 * prompts, each reopening the session at that part of the full form.
 */
export function SavedState(props: {
  ride: SavedRide;
  showPrompts: boolean;
  added: boolean;
  sessionId: string;
  onOpen: (section: FreshSection) => void;
  onDone: () => void;
}) {
  return (
    <div className={styles.saved}>
      <div className={styles.savedCard} role="status">
        <div className={styles.savedHead}>
          <span className={styles.savedMark} aria-hidden="true">
            <Icon name="check" size={20} strokeWidth={4} />
          </span>
          <span className={styles.savedTitle}>
            {props.added ? 'Session updated' : 'Session logged'}
          </span>
        </div>
        <p className={styles.savedLine}>{savedRideLine(props.ride)}</p>
      </div>

      {props.showPrompts ? (
        <div className={styles.freshCard}>
          <div className={styles.freshTitle}>Anything else while it is fresh?</div>
          <div className={styles.freshList}>
            {PROMPTS.map((p) => (
              <button
                key={p.section}
                type="button"
                className={styles.freshRow}
                onClick={() => props.onOpen(p.section)}
              >
                <Icon name={p.icon} size={19} />
                <span className={styles.freshLabel}>{p.label}</span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
          <p className={styles.hint}>Or leave it. A bare session still counts.</p>
        </div>
      ) : null}

      <div className={styles.savedActions}>
        <Link href={sessionHref(props.sessionId)} className="btn ghost sm">
          View session
        </Link>
        <button type="button" className="btn sm" onClick={props.onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
