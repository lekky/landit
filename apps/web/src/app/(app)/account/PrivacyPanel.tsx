'use client';

import { PRIVACY, type PrivacyId } from '@landit/core';
import { Panel } from '@landit/ui-web';
import { useActionState } from 'react';

import { setPrivacyAction, type PrivacyFormState } from './actions';

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
 */
export function PrivacyPanel({ value }: { value: PrivacyId }) {
  const [state, save, saving] = useActionState<PrivacyFormState | undefined, FormData>(
    setPrivacyAction,
    undefined,
  );

  return (
    <Panel flat className={styles.privacy}>
      <div className="lab">Who can see your profile</div>
      <p className={styles.privacyLede}>
        Your tricks, stickers and streak. Never your email, your clips or your surname. New accounts
        start private.
      </p>

      <form action={save} className={styles.privacyForm}>
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
