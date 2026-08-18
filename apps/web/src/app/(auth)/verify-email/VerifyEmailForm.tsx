'use client';

import { Button } from '@landit/ui-web';
import Link from 'next/link';
import { useActionState } from 'react';

import { ROUTES } from '@/lib/routes';

import { confirmVerificationAction, type AuthFormState } from '../actions';
import styles from '../auth.module.css';

export function VerifyEmailForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AuthFormState | undefined, FormData>(
    confirmVerificationAction,
    undefined,
  );

  if (state?.done) {
    return (
      <div className={styles.notice}>
        <strong>That is confirmed</strong>
        Nothing else to do. <Link href={ROUTES.dashboard}>Back to riding</Link>.
      </div>
    );
  }

  if (!token) {
    return (
      <div className={styles.notice}>
        <strong>That link is not complete</strong>
        Open the link from the email itself rather than typing the address. If it has expired, the
        reminder on any screen will send you a fresh one.
      </div>
    );
  }

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="token" value={token} />

      {state?.errors?.form ? <p className={styles.formError}>{state.errors.form}</p> : null}

      <Button type="submit" wide className={styles.submit} disabled={pending}>
        {pending ? 'One moment…' : 'Confirm this email'}
      </Button>
    </form>
  );
}
