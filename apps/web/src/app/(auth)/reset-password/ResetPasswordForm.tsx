'use client';

import { Button } from '@landit/ui-web';
import Link from 'next/link';
import { useActionState } from 'react';

import { AUTH_COPY } from '@/lib/authRefusal';
import { ROUTES } from '@/lib/routes';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

import { confirmResetAction, type AuthFormState } from '../actions';
import styles from '../auth.module.css';
import { useFieldErrors, useRefusalCapture } from '../useAuthForm';

/**
 * Set a new password from the emailed link.
 *
 * A link PocketBase will not accept — expired, already used, never real — says
 * so in our words and puts the way to a fresh one beside it (issue #370). It
 * used to say "An error occurred while validating the submitted data.", which
 * is PocketBase talking to a developer, and a rider reading it had no idea the
 * link was the problem or that asking again would fix it.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AuthFormState | undefined, FormData>(
    confirmResetAction,
    undefined,
  );
  const { errorFor, edited } = useFieldErrors(state);

  useRefusalCapture('reset', state, ANALYTICS_EVENTS.passwordResetCompleted);

  const passwordError = errorFor('password');

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
    <form
      action={action}
      onSubmit={() => capture(ANALYTICS_EVENTS.passwordResetCompleted, { outcome: 'attempted' })}
      className={styles.form}
    >
      <input type="hidden" name="token" value={token} />

      <div className="field">
        <label htmlFor="password">New password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          onChange={() => edited('password')}
        />
        {passwordError ? <span className="err">{passwordError}</span> : null}
      </div>

      {state?.errors?.form ? (
        <p className={styles.formError}>
          {state.errors.form}
          {state.refused === 'dead_link' ? (
            <>
              {' '}
              <Link href={ROUTES.forgotPassword} className={styles.errLink}>
                {AUTH_COPY.resetAgain}
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      <Button type="submit" wide className={styles.submit} disabled={pending}>
        {pending ? 'One moment…' : 'Set the password'}
      </Button>
    </form>
  );
}
