import { CONTACT, isSuggestionTopic, type SuggestionTopicId } from '@landit/core';
import { Panel } from '@landit/ui-web';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ROUTES, signInHref } from '@/lib/routes';
import { currentRider } from '@/lib/session';

import { SuggestForm } from './SuggestForm';
import styles from './suggest.module.css';

export const metadata: Metadata = {
  title: 'Tell us an idea · Land The Trick',
  description: 'A trick we are missing, something the site should do, or something that is broken.',
  alternates: { canonical: ROUTES.suggest },
};

/**
 * The suggestion box.
 *
 * **It is not `/report`, and keeping the two apart is a safety decision rather
 * than a filing one** (owner decision, 2026-09-12, in chat). `/report` is the
 * Online Safety Act route: it works signed out because it must, it is capped at
 * five an hour, and it lands in a queue staff have promised to answer within one
 * working day. Folding ideas into it would spend that cap on them — a rider who
 * sent five trick suggestions in an afternoon could not then report a child in
 * danger — and would leave a moderator reading past "please add the Bri Flip"
 * to find the thing they are looking for. So: a second collection, a second
 * hook, a second rate limit and a second staff queue, sharing only the form's
 * shape.
 *
 * Before this, an idea had two places to go and both were wrong. It could
 * arrive as a report filed under `other` against a harm reason, because that is
 * the only free-text box in the product; or it could be emailed to an address
 * in the site footer, which almost nobody scrolls to. The first is the one that
 * mattered: ideas were already landing in the safeguarding queue.
 *
 * **Signed in, unlike its sibling.** There is no legal duty here and an open
 * free-text box pointed at a small team is a spam target, so the create rule
 * asks for a session. A rider held behind the guardian-consent gate can still
 * use it: that gate exists to stop a child reaching *other riders* (plan §3
 * guarantee 4), and a suggestion reaches nobody but us.
 *
 * **Nothing a rider writes here is ever shown to another rider.** No idea
 * board, no voting, no "most requested" page — each of those renders one
 * rider's typing to another, which is the stranger-contact surface plan §6.1
 * does not have.
 */
export default async function SuggestPage({
  searchParams,
}: {
  searchParams: Promise<{ about?: string; from?: string }>;
}) {
  const query = await searchParams;
  const session = await currentRider();

  // Gated, so the sign-in carries the way back — a rider who clicked "missing a
  // trick?" from the library should land on this form, not on the dashboard
  // wondering what happened (issue #66's rule, applied to a new route).
  if (!session) redirect(signInHref(ROUTES.suggest));

  const about: SuggestionTopicId | undefined = isSuggestionTopic(query.about)
    ? query.about
    : undefined;
  // Bounded and from a closed set in practice, but read as free text: it is a
  // query parameter, it reaches an analytics property, and the catalogue rule
  // in `lib/analytics.ts` is that only facts this repo wrote may travel.
  const from = ['library', 'account-menu'].includes(String(query.from ?? ''))
    ? String(query.from)
    : undefined;

  return (
    <div className={styles.page}>
      <span className="eyebrow">Tell us</span>
      <h1 className={`d ${styles.head}`}>What should we build next?</h1>
      <p className={styles.lede}>
        A trick we have not got, something the site should do, an event we have missed, or something
        that is plainly broken. We read all of them.
      </p>

      <Panel flat className={styles.promise}>
        <div className="lab">What happens next</div>
        <ul className={styles.promiseList}>
          <li>A person reads it. There is no queue nobody opens.</li>
          <li>We cannot build everything — but the ideas that keep coming up get built.</li>
          <li>
            If something here is <strong>not safe or not right</strong>, that is a different form:{' '}
            <a href={ROUTES.report}>tell us something is wrong</a>. It goes to safeguarding and gets
            answered within one working day.
          </li>
        </ul>
      </Panel>

      <SuggestForm {...(about ? { about } : {})} {...(from ? { from } : {})} />

      <p className={`cond ${styles.footNote}`}>
        Prefer email? <a href={`mailto:${CONTACT.hello}`}>{CONTACT.hello}</a> reaches the same
        people.
      </p>
    </div>
  );
}
