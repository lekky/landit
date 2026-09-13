'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { runAction } from '@/lib/runAction';

import { makeSessionPrivateAction } from './actions';
import styles from './detail.module.css';

/**
 * The visibility card's one action. Not optimistic: the card's words come from
 * the server's answer (a refresh), so there is no moment where it says "only
 * you" about a session that is still shared.
 */
export function MakePrivateButton({ sessionId }: { readonly sessionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const press = () => {
    setError(null);
    startTransition(async () => {
      const result = await runAction('session_visibility', () =>
        makeSessionPrivateAction({ sessionId }),
      );
      if (result.ok) {
        router.refresh();
        return;
      }
      setError(result.message);
    });
  };

  return (
    <>
      <button type="button" className={styles.smallBtn} onClick={press} disabled={pending}>
        {pending ? 'Saving…' : 'Make it private'}
      </button>
      {error ? (
        <p className={styles.actionError} role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
