'use client';

import { Button } from '@landit/ui-web';
import Link from 'next/link';
import { useActionState } from 'react';

import { ROUTES } from '@/lib/routes';

import { confirmResetAction, type AuthFormState } from '../actions';
import styles from '../auth.module.css';

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AuthFormState | undefined, FormData>(
    confirmResetAction,
    undefined,
  );

  if (state?.done) {
    return (
      <div className={styles.notice}>
        <strong>That is done</strong>
        <Link href={ROUTES.signIn}>Sign in</Link> with your new password.
      </div>
    );
  }

  if (!token) {
    return (
      <div className={styles.notice}>
        <strong>That link is not complete</strong>
        Open the link from the email itself rather than typing the address, or{' '}
        <Link href={ROUTES.forgotPassword}>ask for a fresh one</Link>.
      </div>
    );
  }

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="token" value={token} />

      <div className="field">
        <label htmlFor="password">New password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
        />
        {state?.errors?.password ? <span className="err">{state.errors.password}</span> : null}
      </div>

      {state?.errors?.form ? <p className={styles.formError}>{state.errors.form}</p> : null}

      <Button type="submit" wide className={styles.submit} disabled={pending}>
        {pending ? 'One moment…' : 'Set the password'}
      </Button>
    </form>
  );
}
