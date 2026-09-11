'use client';

import { Button } from '@landit/ui-web';
import { useActionState, useState } from 'react';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

import { signInAction, type AuthFormState } from '../actions';
import styles from '../auth.module.css';
import { useRefusalCapture } from '../useAuthForm';

/**
 * Sign in (screenshot 04's sibling: same card, two fields).
 *
 * The third field is hidden and is where the rider was going before they were
 * asked to sign in (issue #66). The server validates it again — a hidden input
 * is a value the browser can edit.
 *
 * **The email survives a refusal; the password does not** (issue #370). React
 * 19 resets a `<form action>` once the action settles, which empties every
 * uncontrolled field, so a mistyped password used to take the address with it.
 * The email is held in state and survives that. The password is deliberately
 * left uncontrolled — never held in React state, never sent back by the server
 * — so the reset clears it, which is what a rider retyping it expects anyway.
 */
export function SignInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthFormState | undefined, FormData>(
    signInAction,
    undefined,
  );
  const [email, setEmail] = useState('');

  useRefusalCapture('signin', state, ANALYTICS_EVENTS.signedIn);

  return (
    <form
      action={action}
      onSubmit={() => capture(ANALYTICS_EVENTS.signedIn, { outcome: 'attempted' })}
      className={styles.form}
    >
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" />
      </div>

      {state?.errors?.form ? <p className={styles.formError}>{state.errors.form}</p> : null}

      <Button type="submit" wide className={styles.submit} disabled={pending}>
        {pending ? 'One moment…' : 'Sign in'}
      </Button>
    </form>
  );
}
