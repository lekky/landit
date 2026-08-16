'use client';

import { Button } from '@landit/ui-web';
import { useActionState } from 'react';

import { signInAction, type AuthFormState } from '../actions';
import styles from '../auth.module.css';

/** Sign in (screenshot 04's sibling: same card, two fields). */
export function SignInForm() {
  const [state, action, pending] = useActionState<AuthFormState | undefined, FormData>(
    signInAction,
    undefined,
  );

  return (
    <form action={action} className={styles.form}>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" placeholder="you@example.com" />
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
