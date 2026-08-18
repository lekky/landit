'use client';

import { CONSENT_LIMITED_ALLOWS, CONSENT_LIMITED_DENIES, type ConsentState } from '@landit/core';
import { Button, Panel } from '@landit/ui-web';
import { useActionState } from 'react';

import { askGuardianAction, type GuardianFormState } from './actions';
import styles from './account.module.css';

/**
 * What a rider waiting on a guardian sees.
 *
 * It is written to the rider, not about them: what they *can* do comes first and
 * at the same size as what they cannot, because most of Land The Trick is open to them
 * and a screen that led with the refusals would read as a punishment for being
 * young. The refusals themselves are enforced server-side (§3 guarantee 4) —
 * this panel explains them, it does not implement them.
 */

const ALLOWED_COPY: Record<(typeof CONSENT_LIMITED_ALLOWS)[number], string> = {
  sign_in: 'Sign in whenever you like',
  browse_library: 'Read the whole trick library',
  log_trick: 'Log every trick you land',
  write_notes: 'Keep your own notes',
  build_streak: 'Build your weekly streak',
  see_own_progress: 'See all of your own progress',
  edit_own_profile: 'Set up your profile',
};

const DENIED_COPY: Record<(typeof CONSENT_LIMITED_DENIES)[number], string> = {
  be_visible_to_riders: 'Be seen by other riders',
  appear_on_crew_board: 'Show up on a crew board',
  join_or_create_crew: 'Join or start a crew',
  receive_crew_invite: 'Be invited to a crew',
  submit_spot: 'Add a skatepark or spot',
  attend_event: 'Say you are going to an event',
  hold_subscription: 'Pay for anything',
};

export function GuardianPanel({ state }: { state: ConsentState }) {
  const [result, action, pending] = useActionState<GuardianFormState | undefined, FormData>(
    askGuardianAction,
    undefined,
  );

  const revoked = state === 'revoked';

  return (
    <Panel className={styles.guardian}>
      <div className="eyebrow">{revoked ? 'Approval withdrawn' : 'Waiting on a grown-up'}</div>
      <h2 className={`d ${styles.guardianHead}`}>
        {revoked
          ? 'Your grown-up changed their mind'
          : 'Almost there — a grown-up needs to say yes'}
      </h2>

      <p className={styles.guardianLede}>
        {revoked
          ? 'Everything you have logged is still here and still yours. You can ask again, or ask somebody else.'
          : 'Where you live, a parent or carer has to approve an account for a rider your age. Send them an email and they decide — it takes them one tap.'}
      </p>

      <div className={styles.lists}>
        <div>
          <div className="lab">You can already</div>
          <ul className={styles.list}>
            {CONSENT_LIMITED_ALLOWS.map((capability) => (
              <li key={capability}>{ALLOWED_COPY[capability]}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="lab">Once they say yes</div>
          <ul className={styles.list}>
            {CONSENT_LIMITED_DENIES.map((capability) => (
              <li key={capability}>{DENIED_COPY[capability]}</li>
            ))}
          </ul>
        </div>
      </div>

      {result?.sentTo ? (
        <div className={styles.sent}>
          <strong>We have written to {result.sentTo}</strong>
          {result.emailed
            ? 'The link in it is good for a week. Ask them to check junk mail if it has not turned up.'
            : 'We could not get it to them just now — that is our end, not yours. The request is recorded, so try sending it again in a few minutes.'}
        </div>
      ) : null}

      <form action={action} className={styles.guardianForm}>
        <div className="field">
          <label htmlFor="guardian_email">
            {result?.sentTo ? 'Send it again, or to somebody else' : 'A parent or carer’s email'}
          </label>
          <input
            id="guardian_email"
            name="guardian_email"
            type="email"
            placeholder="grown-up@example.com"
          />
          {result?.error ? <span className="err">{result.error}</span> : null}
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Sending…' : result?.sentTo ? 'Send again' : 'Ask them'}
        </Button>
      </form>

      <p className={`cond ${styles.guardianNote}`}>
        We only use that address to ask this question, and to let them change their mind later.
      </p>
    </Panel>
  );
}
