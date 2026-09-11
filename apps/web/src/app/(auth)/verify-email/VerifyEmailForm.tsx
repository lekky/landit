'use client';

import { Button } from '@landit/ui-web';
import Link from 'next/link';
import { useActionState } from 'react';

import { AUTH_COPY } from '@/lib/authRefusal';
import { ROUTES } from '@/lib/routes';

import { confirmVerificationAction, type AuthFormState } from '../actions';
import styles from '../auth.module.css';
import { useRefusalCapture } from '../useAuthForm';

/**
 * Confirm an email from the emailed link.
 *
 * A dead link points at the **dashboard**, not at `/forgot-password` (issue
 * #370 suggested the latter for both token screens). A reset email is the wrong
 * fresh link to send somebody who wanted a confirmation one; what sends a new
 * confirmation is the reminder at the top of every signed-in screen
 * (`VerifyEmailBanner`), and the dashboard is where a signed-out rider lands on
 * it after signing in.
 */
export function VerifyEmailForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AuthFormState | undefined, FormData>(
    confirmVerificationAction,
    undefined,
  );

  useRefusalCapture('verify', state);

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

      {state?.errors?.form ? (
        <p className={styles.formError}>
          {state.errors.form}
          {state.refused === 'dead_link' ? (
            <>
              {' '}
              <Link href={ROUTES.dashboard} className={styles.errLink}>
                {AUTH_COPY.verifyAgain}
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      <Button type="submit" wide className={styles.submit} disabled={pending}>
        {pending ? 'One moment…' : 'Confirm this email'}
      </Button>
    </form>
  );
}
