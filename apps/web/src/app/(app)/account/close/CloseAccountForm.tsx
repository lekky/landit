'use client';

import { Button } from '@landit/ui-web';
import Link from 'next/link';
import { useActionState, useEffect } from 'react';

import { ANALYTICS_EVENTS, capture, useFailureCapture } from '@/lib/analyticsClient';
import { ROUTES } from '@/lib/routes';

import { deleteAccountAction, type DeleteAccountState } from './actions';
import styles from './close.module.css';

/**
 * The two confirmations, and the button that means it.
 *
 * **Two confirmations, and the password is one of them.** The server checks it
 * (`96_account.pb.js`); this is the copy that explains why it is being asked.
 *
 * The form starts open, where the panel this replaced started closed behind a
 * "Close my account" button. A rider who has followed a link off their account
 * page to a page called "Closing your account" has already pressed the thing
 * that used to open it; a second button to reveal the first is a click that
 * asks nothing.
 */
export function CloseAccountForm() {
  const [result, action, pending] = useActionState<DeleteAccountState | undefined, FormData>(
    deleteAccountAction,
    undefined,
  );

  /*
   * The page view, counted here because the page itself is a server component
   * and this is the only thing on it that reaches the browser. It is the number
   * the move to a route of its own was taken on: the control got harder to find
   * on purpose, and this is what would show it had become impossible to find.
   */
  useEffect(() => {
    capture(ANALYTICS_EVENTS.accountCloseOpened);
  }, []);

  useFailureCapture(ANALYTICS_EVENTS.accountClosed, result?.error);

  return (
    <form
      action={action}
      className={styles.form}
      onSubmit={() => capture(ANALYTICS_EVENTS.accountClosed, { outcome: 'attempted' })}
    >
      <div className="field">
        <label htmlFor="delete_password">Your password</label>
        <input id="delete_password" name="password" type="password" autoComplete="off" />
        <span className={`cond ${styles.hint}`}>
          We ask again so that somebody who picks up your phone cannot do this.
        </span>
      </div>
      <div className="field">
        <label htmlFor="delete_confirm">Type DELETE</label>
        <input id="delete_confirm" name="confirm" autoComplete="off" placeholder="DELETE" />
      </div>
      {result?.error ? <span className="err">{result.error}</span> : null}
      <div className={styles.actions}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Closing…' : 'Close my account for good'}
        </Button>
        {/*
          The way out, kept from the panel this replaced. There it closed the
          form; here it leaves the page. Either way a rider who has read the
          consequences and changed their mind should not have to find the back
          button to act on that.
        */}
        <Link className="btn ghost" href={ROUTES.account}>
          Keep my account
        </Link>
      </div>
    </form>
  );
}
