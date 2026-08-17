'use client';

import { Button } from '@landit/ui-web';
import { useActionState } from 'react';

import { requestResetAction, type AuthFormState } from '../actions';
import styles from '../auth.module.css';

/**
 * Ask for a reset link.
 *
 * The confirmation is the same whether or not the address has an account —
 * anything else is a way to find out which children have signed up.
 */
export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<AuthFormState | undefined, FormData>(
    requestResetAction,
    undefined,
  );

  if (state?.done) {
    return (
      <div className={styles.notice}>
        <strong>Check your email</strong>
        If that address has a Land The Trick account, a link to set a new password is on its way. It
        is good for a couple of hours.
      </div>
    );
  }

  return (
    <form action={action} className={styles.form}>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" placeholder="you@example.com" />
        {state?.errors?.email ? <span className="err">{state.errors.email}</span> : null}
      </div>

      <Button type="submit" wide className={styles.submit} disabled={pending}>
        {pending ? 'One moment…' : 'Send the link'}
      </Button>
    </form>
  );
}
