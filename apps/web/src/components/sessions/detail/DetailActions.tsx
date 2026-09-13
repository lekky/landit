'use client';

import { Icon } from '@landit/ui-web';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { DeleteSessionDialog } from '@/components/sessions/DeleteSessionDialog';
import { sessionsHref } from '@/lib/sessionRoutes';

import styles from './detail.module.css';

export interface DetailActionsProps {
  readonly sessionId: string;
  readonly editHref: Route;
  readonly spotName: string;
  /** "12 Sep", formatted on the server. */
  readonly dateLabel: string;
  /**
   * `hero` — the two paper buttons in the orange hero (1e, desktop).
   * `bar` — Edit and a trash icon on the black phone bar (2c).
   */
  readonly variant: 'hero' | 'bar';
}

/**
 * Edit and Delete, owner only (the page decides; this never renders for anybody
 * else). Delete is the shared confirm (T36), and a delete that landed goes back
 * to the list — the page it was on no longer exists.
 */
export function DetailActions({
  sessionId,
  editHref,
  spotName,
  dateLabel,
  variant,
}: DetailActionsProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className={variant === 'hero' ? styles.heroActions : styles.barActions}>
      <Link className={variant === 'hero' ? styles.heroBtn : styles.barBtn} href={editHref}>
        Edit
      </Link>
      {variant === 'hero' ? (
        <button type="button" className={styles.heroBtn} onClick={() => setConfirming(true)}>
          Delete
        </button>
      ) : (
        <button
          type="button"
          className={`${styles.barBtn} ${styles.barIcon}`}
          onClick={() => setConfirming(true)}
          aria-label="Delete this session"
        >
          <Icon name="trash" size={18} strokeWidth={2.2} />
        </button>
      )}
      {confirming ? (
        <DeleteSessionDialog
          session={{ id: sessionId, spotName, dateLabel }}
          onClose={() => setConfirming(false)}
          onDeleted={() => {
            setConfirming(false);
            router.push(sessionsHref());
          }}
        />
      ) : null}
    </div>
  );
}
