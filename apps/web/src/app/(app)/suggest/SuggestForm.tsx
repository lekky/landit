'use client';

import {
  CONTACT,
  SUGGESTION_DETAIL_MAX,
  SUGGESTION_TOPICS,
  type SuggestionTopicId,
} from '@landit/core';
import { Button, Panel } from '@landit/ui-web';
import Link from 'next/link';
import { useActionState, useState } from 'react';

import { ROUTES } from '@/lib/routes';
import { ANALYTICS_EVENTS, useSuccessCapture } from '@/lib/analyticsClient';

import { fileSuggestionAction, type SuggestionFormState } from './actions';

import styles from './suggest.module.css';

/**
 * The form itself.
 *
 * Deliberately the report form's shape — one screen, no steps, plain radio
 * buttons, a character count — because that shape was already right for
 * somebody on a phone, and because the two screens being siblings is the honest
 * picture: both are "tell us something", and the difference between them is
 * what happens next rather than how it is typed.
 *
 * What is **not** borrowed is the register. `/report` opens with "Something
 * here is not right" and ends by naming 999; this one is meant to be fun to
 * use. A suggestion box written in the safeguarding voice would get no
 * suggestions.
 *
 * Nothing here decides anything. Every refusal below is a copy of a rule
 * enforced in `pocketbase/hooks/97_suggestions.pb.js`, and the sentences the
 * server sends back are shown as it wrote them.
 */

export interface SuggestFormProps {
  /** Pre-selected from the link that opened this screen. */
  readonly about?: SuggestionTopicId;
  /** Where the rider came in from, for the count. A fixed id, never a URL. */
  readonly from?: string;
}

/**
 * "Send another" used to be a link to `/suggest` — the page it was already on.
 * Next treats that as a no-op soft navigation, so the action state kept its
 * `filedAs` and the thank-you panel never went away (reported 2026-09-13). A
 * fresh `key` remounts the form instead, which resets the action state and the
 * textarea together.
 */
export function SuggestForm(props: SuggestFormProps) {
  const [round, setRound] = useState(0);
  return <SuggestFormRound key={round} {...props} onAnother={() => setRound((n) => n + 1)} />;
}

function SuggestFormRound({
  about,
  from,
  onAnother,
}: SuggestFormProps & { readonly onAnother: () => void }) {
  const [result, action, pending] = useActionState<SuggestionFormState | undefined, FormData>(
    fileSuggestionAction,
    undefined,
  );
  const [detail, setDetail] = useState('');

  // The count, and nothing more. `filedAs` is the reference the rider is shown,
  // used here only to tell one filing from the next — what travels is the
  // topic, which is a fixed list, and which entry point they used. Not a word
  // of the idea itself.
  useSuccessCapture(ANALYTICS_EVENTS.suggestionFiled, result?.filedAs, {
    about: about ?? 'other',
    where: from ?? 'direct',
  });

  if (result?.filedAs) {
    return (
      <Panel className={styles.done}>
        <div className="eyebrow">Got it</div>
        <h2 className={`d ${styles.doneHead}`}>Thanks — that is with us.</h2>
        <p className={styles.doneBody}>
          A person reads every one of these. We cannot promise to build them all, but the ones that
          keep coming up are the ones that get built. Your reference is{' '}
          <strong>{result.filedAs}</strong>.
        </p>
        <p className={`cond ${styles.doneNote}`}>
          Got another? Send it — just not all at once, or we will ask you to slow down.
        </p>
        <div className={styles.doneActions}>
          <Link className="btn sm ghost" href={ROUTES.dashboard}>
            Back to riding
          </Link>
          <button type="button" className="btn sm ghost" onClick={onAnother}>
            Send another
          </button>
        </div>
      </Panel>
    );
  }

  return (
    <form action={action}>
      <Panel className={styles.block}>
        <fieldset className={styles.fieldset}>
          <legend className="lab">What is this about?</legend>
          {/*
            Pill rows (§3.10, T52), where this was a column of native radio
            dots with the label beside them.

            **It is still a radio group, and the form still submits `topic`.**
            The input is the same `<input type="radio" name="topic">` it always
            was — clipped out of sight rather than replaced, so arrow keys still
            walk the group, the label still activates it, a screen reader still
            hears "radio, 2 of 5", and `fileSuggestionAction` receives exactly
            the value it did before. What changed is what a rider sees and can
            hit: a 44px box with the design's keyline instead of a 13px dot.
          */}
          <div className={styles.choices}>
            {SUGGESTION_TOPICS.map((topic) => (
              <label key={topic.id} className={styles.choice}>
                <input
                  type="radio"
                  name="topic"
                  value={topic.id}
                  className={styles.choiceInput}
                  defaultChecked={about ? about === topic.id : topic.id === 'trick'}
                />
                <span className={`pill ${styles.choiceBox}`}>
                  <strong>{topic.label}</strong>
                  <span className={`cond ${styles.choiceBlurb}`}>{topic.blurb}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </Panel>

      <Panel className={styles.block}>
        <div className="field">
          <label htmlFor="detail">What is the idea?</label>
          <textarea
            id="detail"
            name="detail"
            rows={5}
            maxLength={SUGGESTION_DETAIL_MAX}
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            placeholder="Say it however you like. A sentence is plenty."
          />
          <span className={`cond ${styles.count}`}>
            {SUGGESTION_DETAIL_MAX - detail.length} characters left
          </span>
        </div>
      </Panel>

      {result?.problems?.length ? (
        <ul className={styles.problems}>
          {result.problems.map((problem) => (
            <li key={problem} className="err">
              {problem}
            </li>
          ))}
        </ul>
      ) : null}
      {result?.error ? <p className="err">{result.error}</p> : null}

      <div className={styles.submit}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Sending…' : 'Send it'}
        </Button>
        <span className={`cond ${styles.count}`}>
          Or email <a href={`mailto:${CONTACT.hello}`}>{CONTACT.hello}</a>. It reaches the same
          people.
        </span>
      </div>
    </form>
  );
}
