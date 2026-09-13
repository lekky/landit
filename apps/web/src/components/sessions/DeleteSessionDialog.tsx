'use client';

import { Button, Icon, Modal } from '@landit/ui-web';
import { useState, useTransition } from 'react';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { runAction } from '@/lib/runAction';
import { deleteSessionCopy } from '@/lib/sessionDelete';

import { deleteSessionAction } from './actions';
import styles from './deleteSessionDialog.module.css';

export interface DeleteSessionDialogProps {
  /** The session being deleted. Render the dialog only while there is one. */
  readonly session: {
    readonly id: string;
    /** The spot's name, as the screen already shows it. */
    readonly spotName: string;
    /** "12 Sep", formatted on the server (LESSONS §3a). */
    readonly dateLabel: string;
  };
  /** Close without deleting: Keep it, Esc, the scrim, or the title bar. */
  readonly onClose: () => void;
  /**
   * Called after the server has deleted it and `session_deleted` has fired.
   * The list removes the row; the detail and edit pages navigate to the list.
   */
  readonly onDeleted: (sessionId: string) => void;
}

/**
 * The delete-a-session confirm (T36), shared by the list (T37), the detail page
 * (T39) and edit mode (T38) so the promise it makes is worded once.
 *
 * It names the session, says it comes off the rider's month and the spot, and
 * says **tricks moved up stay where they are** — the one-way stage rule
 * (plan §1 D6). The shared `Modal` gives it Esc, the scrim and focus handling.
 *
 * The write goes through `runAction`, so a request that never reaches the
 * server is reported here rather than lost (issue #433), and the dialog stays
 * open with the reason under the buttons. `session_deleted` fires only after
 * the server said yes, with no properties.
 */
export function DeleteSessionDialog({ session, onClose, onDeleted }: DeleteSessionDialogProps) {
  const copy = deleteSessionCopy(session);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await runAction('session_delete', () =>
        deleteSessionAction({ sessionId: session.id }),
      );
      if (result.ok) {
        capture(ANALYTICS_EVENTS.sessionDeleted);
        onDeleted(session.id);
        return;
      }
      setError(result.message);
    });
  };

  // A delete in flight is not interrupted by a stray Esc or tap on the scrim.
  const requestClose = () => {
    if (!pending) onClose();
  };

  return (
    <Modal onClose={onClose} onRequestClose={requestClose} width={460} label={copy.title}>
      <div className={styles.body}>
        <div className={styles.head}>
          <span className={styles.mark} aria-hidden="true">
            <Icon name="trash" size={20} strokeWidth={2.4} />
          </span>
          <h2 className={`d ${styles.title}`}>{copy.title}</h2>
        </div>
        <p className={styles.copy}>
          {copy.lead} {copy.body} <b>{copy.keeps}</b>
          {copy.keepsTail}
        </p>
        <div className={styles.actions}>
          <Button size="sm" variant="ghost" onClick={requestClose} disabled={pending}>
            {copy.cancel}
          </Button>
          <Button size="sm" className={styles.danger} onClick={confirm} disabled={pending}>
            {pending ? copy.working : copy.confirm}
          </Button>
        </div>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
