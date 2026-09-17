'use client';

import { SESSION_VISIBILITIES, type SessionVisibilityId } from '@landit/core';
import { Panel } from '@landit/ui-web';
import { useState, useTransition, type FormEvent } from 'react';

import { runAction } from '@/lib/runAction';

import { setSessionVisibilityDefaultAction } from './actions';

import styles from './account.module.css';

type Status = { readonly kind: 'saved' } | { readonly kind: 'error'; readonly message: string };

/**
 * "Who sees new sessions" (T40; screenshots 1g and 2e of the session-tracking
 * handoff, "Settings · sessions").
 *
 * The three choices and their blurbs are `SESSION_VISIBILITIES` in
 * `@landit/core`, the same table the session form's picker reads, so the two
 * cannot describe a choice differently.
 *
 * **One deliberate difference from the design: a Save button.** The prototype
 * saves on the tap. This sits directly under "Who can see your profile", which
 * saves on a button for a stated reason — a setting about who can see a child
 * changes when they say so, not when a finger lands on it while scrolling — and
 * this is the same kind of setting. Two privacy panels one above the other that
 * save in two different ways would also be a thing to learn twice.
 *
 * No analytics event. The catalogue has none for this setting, and adding one
 * is outside T40 (plan §7, T40).
 *
 * **`headed` hides the label from the screen and not from a screen reader**
 * (T51). On `/account/sessions` the page's `h1` already says these four words,
 * so drawing them again is the same words twice — but the label is also what
 * names the radio group (`aria-labelledby`), so it is clipped rather than
 * removed. `display: none` would take the group's name away with it, and an
 * unnamed radio group is announced as three loose radios.
 */
export function SessionVisibilityPanel({
  value,
  headed = true,
}: {
  value: SessionVisibilityId;
  headed?: boolean;
}) {
  const [chosen, setChosen] = useState<SessionVisibilityId>(value);
  const [saved, setSaved] = useState<SessionVisibilityId>(value);
  const [status, setStatus] = useState<Status | null>(null);
  const [saving, startSaving] = useTransition();

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = chosen;
    setStatus(null);
    startSaving(async () => {
      const result = await runAction('session_visibility_default', () =>
        setSessionVisibilityDefaultAction({ visibility: next }),
      );
      if (result.ok) {
        setSaved(next);
        setStatus({ kind: 'saved' });
        return;
      }
      setStatus({ kind: 'error', message: result.message });
    });
  }

  return (
    <Panel className={styles.sessionVis}>
      <div className={headed ? 'lab' : styles.clipped} id="session-visibility-title">
        Who sees new sessions
      </div>

      <form
        className={styles.sessionVisForm}
        aria-labelledby="session-visibility-title"
        onSubmit={save}
      >
        <div
          className={styles.sessionVisOptions}
          role="radiogroup"
          aria-labelledby="session-visibility-title"
        >
          {SESSION_VISIBILITIES.map((option) => (
            <label key={option.id} className={styles.sessionVisOption}>
              <input
                type="radio"
                name="session_visibility_default"
                value={option.id}
                className={styles.sessionVisInput}
                checked={chosen === option.id}
                onChange={() => {
                  setChosen(option.id);
                  setStatus(null);
                }}
              />
              <span className={styles.sessionVisDot} aria-hidden="true" />
              <span>
                <span className={`cond ${styles.sessionVisLabel}`}>{option.label}</span>
                <span className={styles.sessionVisBlurb}>{option.blurb}</span>
              </span>
            </label>
          ))}
        </div>

        <p className={styles.sessionVisNote}>
          A session carries a place and a time you were there. Every one starts on this setting, and
          every one can be turned down on the day.
        </p>

        <div className={styles.sessionVisActions}>
          <button
            type="submit"
            className={`btn sm ${styles.sessionVisSave}`}
            disabled={saving || chosen === saved}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {status?.kind === 'saved' ? (
            <span className={`lab ${styles.privacySaved}`} role="status">
              Saved
            </span>
          ) : null}
          {status?.kind === 'error' ? (
            <span className={styles.privacyError} role="alert">
              {status.message}
            </span>
          ) : null}
        </div>
      </form>
    </Panel>
  );
}
