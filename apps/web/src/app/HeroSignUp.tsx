'use client';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

import { startSignUpAction } from './landingActions';
import styles from './landing.module.css';

/**
 * The hero's email field and its button.
 *
 * A plain form posting to a server action, which parks the address in a
 * short-lived cookie and redirects to `/signup` (`landingActions.ts`). No
 * `useActionState`, no client validation, no success or error state: there is
 * nothing to report back, because the outcome of pressing this is always the
 * same page. `type="email"` gives the browser its say and that is the whole of
 * the validation here.
 *
 * **Progressive enhancement is the reason it is a `<form action={...}>`.** With
 * JavaScript off, the browser posts it and the redirect still happens — the top
 * of the funnel is the last place in the product that should need a working
 * bundle. The client boundary buys one thing only: the `landing_cta` count on
 * `onSubmit`, which is fire-and-forget and cannot block or fail the submission.
 *
 * The event carries `{ target: 'signup', place: 'hero' }` and never the
 * address. The address is a form field going to our own server; it is not
 * analytics' business, and `analytics.ts` says so in as many words.
 */
export function HeroSignUp() {
  return (
    <form
      className={styles.form}
      action={startSignUpAction}
      onSubmit={() => capture(ANALYTICS_EVENTS.landingCta, { target: 'signup', place: 'hero' })}
    >
      <input
        type="email"
        name="email"
        placeholder="Email address"
        aria-label="Email address"
        autoComplete="email"
      />
      <button className="btn lg" type="submit">
        Get started — free
      </button>
    </form>
  );
}
