'use client';

import { useActionState, useState } from 'react';

import { resendVerificationAction, type AuthFormState } from '@/app/(auth)/actions';
import { VERIFY_DISMISSED_COOKIE, VERIFY_DISMISS_DAYS } from '@/lib/verify';

import styles from './verify.module.css';

/**
 * The reminder an unverified rider sees.
 *
 * **It gates nothing, and the copy has to earn its place without threatening.**
 * Sign-in, the library, logging a trick and the guardian-consent flow all behave
 * exactly the same whether `verified` is true or false — so the only honest
 * reason to confirm is the one this gives: a password reset goes to the address
 * on the record, and an address with a typo in it is an account nobody can get
 * back into. Anything more urgent would be inventing a consequence.
 *
 * Deliberately not the offline bar's yellow. That one reports something broken
 * now; this is a reminder about something that has not happened yet, and a
 * product that shouts equally at both teaches riders to ignore both.
 *
 * Whether it appears at all is decided on the server, from the cookie this sets
 * — see `lib/verify.ts`.
 *
 * **Not during onboarding**, which lives outside the `(app)` route group and so
 * is not wrapped by the layout that renders this. That is worth stating rather
 * than leaving as an accident of where a file sits: a rider's first four screens
 * are about picking a sport and landing a trick, and a bar asking them to go and
 * read their email is the wrong thing to put in front of that. The reminder is
 * waiting on the dashboard afterwards, which is soon enough for something
 * nothing is waiting on.
 */
export function VerifyEmailBanner({ email }: { email: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [state, action, pending] = useActionState<AuthFormState | undefined, FormData>(
    resendVerificationAction,
    undefined,
  );

  function dismiss() {
    const maxAge = VERIFY_DISMISS_DAYS * 24 * 60 * 60;
    document.cookie = `${VERIFY_DISMISSED_COOKIE}=1; max-age=${maxAge}; path=/; samesite=lax`;
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <div className={styles.banner} role="status">
      <strong>Confirm your email</strong>
      <span className={styles.why}>
        {state?.done
          ? `Sent to ${email}. Give it a minute, and check junk mail.`
          : 'If you ever lose your password, the reset goes to this address.'}
      </span>

      <div className={styles.actions}>
        {state?.done ? (
          <span className={styles.sent}>On its way</span>
        ) : (
          <form action={action}>
            <input type="hidden" name="email" value={email} />
            <button type="submit" className={styles.link} disabled={pending}>
              {pending ? 'Sending…' : 'Send it again'}
            </button>
          </form>
        )}
        <button type="button" className={styles.link} onClick={dismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
