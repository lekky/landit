'use client';

import {
  CONTACT,
  REPORT_DETAIL_MAX,
  REPORT_REASONS,
  REPORT_SUBJECTS,
  type ReportSubjectId,
} from '@landit/core';
import { Button, Panel } from '@landit/ui-web';
import Link from 'next/link';
import { useActionState, useState } from 'react';

import { ROUTES } from '@/lib/routes';

import { fileReportAction, type ReportFormState } from './actions';
import { ANALYTICS_EVENTS, useSuccessCapture } from '@/lib/analyticsClient';

import styles from './report.module.css';

/**
 * The form itself.
 *
 * Written for the person least able to use it: somebody upset, possibly young,
 * possibly not signed in and possibly on a phone they borrowed. So — one screen,
 * no steps, plain radio buttons rather than a select, and the reasons in the
 * order somebody in trouble would look for them.
 *
 * **The video option is present and disabled**, not hidden. `subject_type` has a
 * `clip` value in the schema and there is no video surface at all right now —
 * the clip vault was removed on 2026-08-17 and the YouTube-link replacement is
 * not built. A screen that pretended the option did not exist would be the same
 * softening the safeguarding page had to make before this task; the honest
 * version is to show it and say why. See the issue T18 filed.
 *
 * Nothing here decides anything. Every refusal below is a copy of a rule
 * enforced in `pocketbase/hooks/95_reports.pb.js`, and the sentences the server
 * sends back are shown as it wrote them.
 */

export interface ReportFormProps {
  readonly signedIn: boolean;
  /** Pre-selected from the link that opened this screen. */
  readonly about?: ReportSubjectId;
  readonly subjectId?: string;
  /** The report being appealed, when this is a complaint about our own decision. */
  readonly appealOf?: string;
}

export function ReportForm({ signedIn, about, subjectId, appealOf }: ReportFormProps) {
  const [result, action, pending] = useActionState<ReportFormState | undefined, FormData>(
    fileReportAction,
    undefined,
  );
  const [detail, setDetail] = useState('');
  const isAppeal = Boolean(appealOf);

  // Safeguarding's own count, and nothing more. `filedAs` is the reference the
  // rider is shown, used here only to tell one filing from the next — what
  // travels is the subject type, which is a fixed list, and whether it was an
  // appeal. Not a word of what was reported, and not who it was about.
  useSuccessCapture(ANALYTICS_EVENTS.reportFiled, result?.filedAs, {
    about: about ?? 'other',
    appeal: isAppeal,
    signed_in: signedIn,
  });

  if (result?.filedAs) {
    return (
      <Panel className={styles.done}>
        <div className="eyebrow">{result.wasAppeal ? 'Appeal received' : 'Report received'}</div>
        <h2 className={`d ${styles.doneHead}`}>Thank you. A person will read this.</h2>
        <p className={styles.doneBody}>
          We answer within one working day. If you need to add anything, email{' '}
          <a href={`mailto:${CONTACT.safeguarding}`}>{CONTACT.safeguarding}</a> and quote{' '}
          <strong>{result.filedAs}</strong>.
        </p>
        {!isAppeal ? (
          <p className={`cond ${styles.doneNote}`}>
            Keep that reference. If you think we get it wrong, it is what you use to ask us to look
            again.
          </p>
        ) : null}
        <Link className="btn sm ghost" href={ROUTES.home}>
          Back to Land The Trick
        </Link>
      </Panel>
    );
  }

  return (
    <form action={action}>
      {appealOf ? <input type="hidden" name="complaint_of" value={appealOf} /> : null}
      {subjectId ? <input type="hidden" name="subject_id" value={subjectId} /> : null}

      <Panel className={styles.block}>
        <fieldset className={styles.fieldset}>
          <legend className="lab">What is this about?</legend>
          {isAppeal ? (
            <>
              <input type="hidden" name="subject_type" value={about ?? 'other'} />
              <p className={styles.appealNote}>
                This is an appeal against report <strong>{appealOf}</strong>. It goes to the same
                place and gets read again, by a person, with what you write below in front of them.
              </p>
            </>
          ) : (
            <div className={styles.choices}>
              {/*
                Every subject is available. Video was the one exception until
                `t15b-video-links` landed on 2026-08-17 — T18 built this form the
                same morning the clip vault was removed, so it disabled the video
                radio and said why. Riders can now link a YouTube video, which
                makes a disabled video option a report nobody can file about
                content that exists: the exact outcome T18's comment said it was
                avoiding. `styles.choiceOff` is left in the stylesheet for the
                next subject that ships ahead of its surface.
              */}
              {REPORT_SUBJECTS.map((subject) => (
                <label key={subject.id} className={styles.choice}>
                  <input
                    type="radio"
                    name="subject_type"
                    value={subject.id}
                    defaultChecked={about ? about === subject.id : subject.id === 'profile'}
                  />
                  <span>
                    <strong>{subject.label}</strong>
                    <span className={`cond ${styles.choiceBlurb}`}>{subject.blurb}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      </Panel>

      <Panel className={styles.block}>
        <fieldset className={styles.fieldset}>
          <legend className="lab">Why?</legend>
          <div className={styles.reasons}>
            {REPORT_REASONS.map((reason) => (
              <label key={reason.id} className={styles.choice}>
                <input type="radio" name="reason" value={reason.id} />
                <span>{reason.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </Panel>

      <Panel className={styles.block}>
        <div className="field">
          <label htmlFor="detail">
            {isAppeal ? 'Why do you think we got it wrong?' : 'What happened?'}
          </label>
          <textarea
            id="detail"
            name="detail"
            rows={6}
            maxLength={REPORT_DETAIL_MAX}
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            placeholder={
              isAppeal
                ? 'Tell us what we missed.'
                : 'Say it however you like. Where you saw it, and what it was.'
            }
          />
          <span className={`cond ${styles.count}`}>
            {REPORT_DETAIL_MAX - detail.length} characters left
          </span>
        </div>

        {!signedIn ? (
          <div className="field">
            <label htmlFor="reporter_email">Your email</label>
            <input
              id="reporter_email"
              name="reporter_email"
              type="email"
              placeholder="you@example.com"
            />
            <span className={`cond ${styles.count}`}>
              So we can tell you what we did. We use it for that and nothing else — no account, no
              list.
            </span>
          </div>
        ) : null}
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
          {pending ? 'Sending…' : isAppeal ? 'Ask us to look again' : 'Send this to a person'}
        </Button>
        <span className={`cond ${styles.count}`}>
          Or email <a href={`mailto:${CONTACT.safeguarding}`}>{CONTACT.safeguarding}</a>. It reaches
          the same person.
        </span>
      </div>
    </form>
  );
}
