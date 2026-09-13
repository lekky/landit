'use client';

import { Button, Modal } from '@landit/ui-web';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { useToast } from '@/providers/toast';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { runAction } from '@/lib/runAction';

import { clearTrickHistoryAction } from '../actions';
import styles from './log.module.css';

/**
 * "Clear history" — the reset, and the confirm in front of it.
 *
 * Stopping tracking keeps everything and always has: the log rows, the
 * first-landed date, the badge. That is the right default and it did not move.
 * This is the other answer, for a rider who tapped a stage by accident or was
 * messing about and wants the trick back to how it was before they touched it
 * (Rachid, 2026-09-13, in chat).
 *
 * **It lives here rather than beside "Stop tracking"** (Rachid, 2026-09-13, in
 * chat). Wiping a history is a second, heavier decision than stopping, and the
 * band is a control riders press casually; a rider decides to stop first, and
 * only then is offered the reset — in the panel where the rows they want rid of
 * are actually shown, next to the thing being deleted. So it never appears
 * while a trick is tracked, and never on a trick with no history: the page
 * renders it in one state only, and that state is what "I have tracking data I
 * did not mean to create" looks like.
 *
 * **It borrows `log.module.css` on purpose.** The note-removal confirm on this
 * same page is already the product's destructive shape — the red mark tilted
 * five degrees, the plain sentence about there being no bin, the danger button
 * on the right — and a second destructive act on one screen inventing a second
 * look would teach a rider that the two are different kinds of serious. They
 * are not. One idiom, two uses.
 */
export function ClearHistoryButton({
  trickId,
  slug,
  count,
  holdsBadge,
}: {
  /** The `tricks` record id — what `trick_log` relates to. */
  trickId: string;
  slug: string;
  /** How many log rows are about to go. Counted on the server, shown verbatim. */
  count: number;
  /** Whether the rider currently holds this trick's own badge. */
  holdsBadge: boolean;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [, startTransition] = useTransition();

  const clear = () => {
    setConfirming(false);
    startTransition(async () => {
      // `runAction`, like every other write on this page: a Server Function
      // that throws would otherwise close the modal, say nothing, and leave a
      // rider believing a destructive act had happened when it had not.
      const result = await runAction('trick_history_clear', () =>
        clearTrickHistoryAction({ trickId, slug }),
      );
      if (result.ok) {
        // After the write, never before it — the count is the server's, so it
        // is what actually went rather than what the screen expected to go.
        capture(ANALYTICS_EVENTS.trickHistoryCleared, { slug, entries: result.cleared });
        toast(
          result.cleared === 1
            ? 'History cleared — 1 entry gone'
            : `History cleared — ${result.cleared} entries gone`,
        );
        // The dates, the timeline and the award badge are all server-rendered
        // from rows that have just gone, and the sticker may have gone with
        // them. Without this the rider is looking at the history they were told
        // was deleted until something else happens to reload the page.
        router.refresh();
        return;
      }
      toast(result.message, 'var(--red)');
    });
  };

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
        Clear history
      </Button>

      {confirming && (
        <Modal
          onClose={() => setConfirming(false)}
          width={420}
          label="Clear your history with this trick?"
        >
          <div className={styles.confirm}>
            <div className={styles.confirmHead}>
              <span className={styles.confirmMark} aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  width={20}
                  height={20}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 7h16" />
                  <path d="M9 7V4h6v3" />
                  <path d="M6 7l1 13h10l1-13" />
                </svg>
              </span>
              <h3 className={`d ${styles.confirmTitle}`}>Clear your history?</h3>
            </div>
            <p className={styles.confirmCopy}>
              {count === 1
                ? 'Your one entry for this trick goes, and your first-landed date with it.'
                : `All ${count} of your entries for this trick go, and your first-landed date with them.`}
              {holdsBadge ? ' So does the badge this trick earned you.' : ''} Totals and awards that
              counted it are worked out again without it.
            </p>
            <p className={styles.confirmCopy}>
              It goes for good. There is no bin to get it back from.
            </p>
            <div className={styles.confirmActions}>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                Keep it
              </Button>
              <Button size="sm" className={styles.danger} onClick={clear}>
                Clear it all
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
