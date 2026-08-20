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
 *
 * **The hour is not a rounded-down guess.** This screen used to say "a couple of
 * hours", which was not true under any setting the instance has ever had:
 * PocketBase 0.39's `passwordResetToken.duration` defaults to 1800 seconds, and
 * the email the rider is about to open (`pocketbase/templates/password-reset.html`)
 * promises sixty minutes. Three numbers for one link, and the rider only finds
 * out which one was real by waiting. This now says what the email says; making
 * the *server* agree is an instance setting and is issue #233.
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
        is good for an hour.
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
