'use client';

import { PRIVACY, type PrivacyId } from '@landit/core';
import { Panel } from '@landit/ui-web';
import { useActionState } from 'react';

import { setPrivacyAction, type PrivacyFormState } from './actions';

import { ANALYTICS_EVENTS, capture, useFailureCapture } from '@/lib/analyticsClient';

import styles from './account.module.css';

/**
 * "Who can see your profile" (`landit-screens-c.jsx`, screenshot 23).
 *
 * Three radio-shaped panels, and the wording is `PRIVACY`'s in `@landit/core`
 * rather than written here — that copy was swept when the default moved to
 * `private` (plan §7, LESSONS §4), and a second copy on this screen is exactly
 * the thing that would not get swept next time.
 *
 * Saving is a form post, not an onChange: a setting about who can see a child
 * changes when they say so, not when a finger lands on a list while scrolling.
 *
 * `headed` is the one thing T51 added, and it changes nothing about what the
 * panel does: on `/account/privacy` the screen's own `h1` is already these four
 * words, so the panel's label would be the same words twice, 20px apart, in two
 * sizes. It defaults to the label being drawn, so any caller that has not asked
 * gets exactly what it got before.
 */
export function PrivacyPanel({ value, headed = true }: { value: PrivacyId; headed?: boolean }) {
  const [state, save, saving] = useActionState<PrivacyFormState | undefined, FormData>(
    setPrivacyAction,
    undefined,
  );

  useFailureCapture(ANALYTICS_EVENTS.privacySet, state?.error);

  return (
    <Panel flat className={styles.privacy}>
      {headed ? <div className="lab">Who can see your profile</div> : null}
      <p className={styles.privacyLede}>
        Your tricks, stickers and streak. Never your email or your surname. New accounts start
        private.
      </p>

      <form
        action={save}
        className={styles.privacyForm}
        onSubmit={() => capture(ANALYTICS_EVENTS.privacySet, { outcome: 'attempted' })}
      >
        {PRIVACY.map((option) => (
          <label key={option.id} className={styles.privacyOption}>
            <input
              type="radio"
              name="privacy"
              value={option.id}
              defaultChecked={option.id === value}
            />
            <span>
              <span className={`cond ${styles.privacyLabel}`}>{option.label}</span>
              <span className={styles.privacyBlurb}>{option.blurb}</span>
            </span>
          </label>
        ))}

        <div className={styles.privacyActions}>
          <button type="submit" className="btn sm" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {state?.saved ? <span className={`lab ${styles.privacySaved}`}>Saved</span> : null}
          {state?.error ? <span className={styles.privacyError}>{state.error}</span> : null}
        </div>
      </form>
    </Panel>
  );
}
