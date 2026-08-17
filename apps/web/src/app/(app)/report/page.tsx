import { CONTACT, isReportSubject, type ReportSubjectId } from '@landit/core';
import { Panel } from '@landit/ui-web';
import type { Metadata } from 'next';

import { currentRider } from '@/lib/session';

import { ReportForm } from './ReportForm';
import styles from './report.module.css';

export const metadata: Metadata = {
  title: 'Tell us something is wrong · Land The Trick',
  description:
    'Report a rider, a spot or anything else on Land The Trick. You do not need an account.',
};

/**
 * The reporting route (T18; plan §6.1, §6.5).
 *
 * **It works signed out**, and that is the requirement rather than a
 * convenience. The OSA's Protection of Children Codes ask for an easy reporting
 * route and a complaints procedure covering our own moderation decisions, and
 * the people most likely to need the first are exactly the ones who do not have
 * an account: a parent who has been shown a screenshot, a park owner, a teacher.
 * `reports.createRule` is open for the same reason, and everything that stops an
 * open create rule being a hole is in `pocketbase/hooks/95_reports.pb.js`.
 *
 * **It is not a message channel** (plan §6.1). A report is addressed to us, is
 * readable only by whoever filed it, and reaches no other rider by any path.
 * Nothing on this screen names or resolves the subject either: `?id=` is carried
 * through untouched and staff look it up, so pointing the form at an id you do
 * not have tells you nothing you did not already know.
 *
 * Both jobs live on one screen because they are one thing to the person using
 * it — `?appeal=<report id>` turns the same form into the complaint against what
 * we did about that report.
 */
export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ about?: string; id?: string; appeal?: string }>;
}) {
  const query = await searchParams;
  const session = await currentRider();

  const about: ReportSubjectId | undefined = isReportSubject(query.about) ? query.about : undefined;
  // Bounded, and never resolved. A record id is 15 characters; anything longer
  // is somebody using the query string as a text field.
  const subjectId = String(query.id ?? '')
    .trim()
    .slice(0, 40);
  const appealOf = String(query.appeal ?? '')
    .trim()
    .slice(0, 40);

  return (
    <div className={styles.page}>
      <span className="eyebrow">{appealOf ? 'Ask us to look again' : 'Tell us'}</span>
      <h1 className={`d ${styles.head}`}>
        {appealOf ? 'You think we got this wrong' : 'Something here is not right'}
      </h1>
      <p className={styles.lede}>
        {appealOf
          ? 'Tell us why, and somebody who has not already made a decision about it will read it again.'
          : 'Tell us what you saw and we will look at it. You do not need an account, and we will not tell anyone you did this.'}
      </p>

      <Panel flat className={styles.promise}>
        <div className="lab">What happens next</div>
        <ul className={styles.promiseList}>
          <li>A person reads it — not a queue nobody opens.</li>
          <li>We answer within one working day.</li>
          <li>
            If it is urgent and about somebody&rsquo;s safety right now, call 999. We are not an
            emergency service.
          </li>
        </ul>
      </Panel>

      <ReportForm
        signedIn={Boolean(session)}
        {...(about ? { about } : {})}
        {...(subjectId ? { subjectId } : {})}
        {...(appealOf ? { appealOf } : {})}
      />

      <p className={`cond ${styles.footNote}`}>
        Prefer email? <a href={`mailto:${CONTACT.safeguarding}`}>{CONTACT.safeguarding}</a> reaches
        the same person, with the same promise.
      </p>
    </div>
  );
}
