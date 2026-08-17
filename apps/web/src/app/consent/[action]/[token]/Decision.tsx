'use client';

import { CONTACT } from '@landit/core';
import type { ConsentLinkPreview } from '@landit/db';
import { Button, Panel } from '@landit/ui-web';
import { useActionState } from 'react';

import { decideConsentAction, type ConsentActionState } from '../../actions';
import styles from '../../consent.module.css';

/**
 * The confirm step a guardian sees before anything happens.
 *
 * The button is the decision, not the link — see `../../actions.ts`.
 */
export function Decision({
  token,
  action,
  preview,
}: {
  token: string;
  action: 'approve' | 'revoke';
  preview: ConsentLinkPreview;
}) {
  const [state, submit, pending] = useActionState<ConsentActionState | undefined, FormData>(
    decideConsentAction,
    undefined,
  );

  const name = state?.riderName ?? preview.rider_name;

  if (state?.done === 'granted') {
    return (
      <Panel className={styles.card}>
        <div className="eyebrow">Approved</div>
        <h1 className={`d ${styles.head}`}>Thank you</h1>
        <div className={styles.body}>
          <p>
            {name}&rsquo;s account is a full one now. Their profile still starts private, and they
            choose whether that ever changes.
          </p>
          <p>
            Keep this email. The other link in it takes your approval back whenever you like, and it
            never expires.
          </p>
        </div>
      </Panel>
    );
  }

  if (state?.done === 'revoked') {
    return (
      <Panel className={styles.card}>
        <div className="eyebrow">Withdrawn</div>
        <h1 className={`d ${styles.head}`}>That is done</h1>
        <div className={styles.body}>
          <p>
            {name} is back to an account only they can see. Nothing they have logged has been
            deleted — their tricks, notes and streak are all still theirs.
          </p>
          <p>
            If you change your mind, they can send you a fresh request from their account. Anything
            you would like removed altogether: {CONTACT.safeguarding}.
          </p>
        </div>
      </Panel>
    );
  }

  const approving = action === 'approve';
  const alreadyDone = approving ? preview.granted : preview.revoked;

  return (
    <Panel className={styles.card}>
      <div className="eyebrow">{approving ? 'A request from a rider' : 'Withdrawing approval'}</div>
      <h1 className={`d ${styles.head}`}>
        {approving ? `${name} needs your OK` : `Take back your OK for ${name}?`}
      </h1>

      <div className={styles.body}>
        {approving ? (
          <>
            <p>
              Land It is a trick tracker for scooter, skateboard and BMX riders. {name} has made an
              account and given us your email as their parent or carer. Because of their age, we
              need your say-so before it is a normal account.
            </p>
            <div className={styles.lists}>
              <div>
                <div className="lab">They can already</div>
                <ul className={styles.list}>
                  <li>Read the trick library</li>
                  <li>Log the tricks they are learning</li>
                  <li>Keep private notes</li>
                  <li>Build a weekly streak</li>
                </ul>
              </div>
              <div>
                <div className="lab">Only if you say yes</div>
                <ul className={styles.list}>
                  <li>Be visible to other riders</li>
                  <li>Join a crew they are invited to</li>
                  <li>Add a spot or attend an event</li>
                  <li>Hold a paid plan</li>
                </ul>
              </div>
            </div>
            <p>
              There is no messaging between riders on Land It, no public feed, and crews are
              invite-only. Their profile stays private unless they change it themselves.
            </p>
          </>
        ) : (
          <p>
            {name} goes back to an account only they can see: no crew, not visible to other riders.
            Nothing they have logged is deleted, and they can ask you again later.
          </p>
        )}
      </div>

      {approving && preview.expired && !preview.granted ? (
        <p className={styles.error}>
          This link has run out. {name} can send a fresh one from their account.
        </p>
      ) : null}

      {alreadyDone ? (
        <p className={`cond ${styles.secondary}`} style={{ marginTop: 16 }}>
          You have already {approving ? 'approved' : 'withdrawn'} this. Pressing it again changes
          nothing.
        </p>
      ) : null}

      {state?.error ? <p className={styles.error}>{state.error}</p> : null}

      <form action={submit} className={styles.actions}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="action" value={action} />
        <Button type="submit" variant={approving ? 'primary' : 'ink'} disabled={pending}>
          {pending
            ? 'One moment…'
            : approving
              ? `Yes, approve ${name}’s account`
              : 'Yes, withdraw it'}
        </Button>
        <span className={`cond ${styles.secondary}`}>
          {approving
            ? 'Doing nothing is also an answer — the account stays as it is.'
            : 'Close this page to leave things as they are.'}
        </span>
      </form>
    </Panel>
  );
}
