import { CONTACT } from '@landit/core';
import { Panel } from '@landit/ui-web';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ROUTES, legalHref, signInHref } from '@/lib/routes';
import { currentRider } from '@/lib/session';

import { CloseAccountForm } from './CloseAccountForm';
import styles from './close.module.css';

export const metadata: Metadata = {
  title: 'Closing your account · Land The Trick',
  description: 'What happens when you close your Land The Trick account, and how to do it.',
  robots: { index: false, follow: false },
};

/**
 * Closing an account (T18; plan §6.5), on a page of its own.
 *
 * **Why it is not on `/account` any more** (2026-09-12, owner in chat). It was
 * a panel there, sitting between the profile editor and the sign-out row, and
 * every rider who came to change their stance scrolled past two paragraphs
 * about erasure being irreversible. Ending an account is rare and deliberate;
 * it belongs somewhere a rider goes on purpose. The download stayed behind —
 * taking a copy of your own tricks is an ordinary thing to want.
 *
 * **Hidden is not the same as gone, and the difference is the whole design.**
 * UK GDPR wants erasure reachable. `/account` links here in the same panel that
 * offers the download, the privacy policy says where it is, and
 * `account_close_opened` counts arrivals so we can tell a door nobody wants
 * from a door nobody can find.
 *
 * **The screen says what deletion actually does, before it does it.** Erasure
 * here is anonymise-and-retain (owner decision, Rachid, 2026-08-17): the
 * rider's own records go, the safeguarding trail stays under a pseudonym.
 * Somebody pressing this button is entitled to know that, in a sentence,
 * without reading the privacy policy — a consent obtained by only mentioning
 * the half that sounds better is not one. The copy is the panel's, moved
 * unchanged: it was not the words that were too loud, it was where they were.
 */
export default async function CloseAccountPage() {
  const session = await currentRider();
  if (!session) redirect(signInHref(ROUTES.accountClose));
  if (!session.rider.onboarded) redirect(ROUTES.onboarding);

  return (
    <div className={styles.page}>
      <Link className={`cond ${styles.back}`} href={ROUTES.account}>
        ← Your account
      </Link>
      <span className="eyebrow">Your account</span>
      <h1 className={`d ${styles.head}`}>Closing your account</h1>

      <Panel flat className={styles.panel}>
        <p className={styles.copy}>
          Your name, your handle, your email and everything you have logged are wiped, and the
          account stops working. Some records have to stay: if anything was ever reported to us by
          you or about you, and the note of any permission a grown-up gave, those are kept with your
          name replaced by a code that means nothing on its own. We keep them because a service that
          can be made to forget a safeguarding report is not a safe one.
        </p>
        <p className={styles.copy}>
          It cannot be undone, and we cannot get it back for you afterwards.{' '}
          {/*
            The download is on `/account`, and this is the one link that has to
            take a rider back to it: the sentence tells them to do a thing that
            is no longer on the same screen, and a sentence like that without a
            way to act on it is worse than the panel this replaced.
          */}
          <Link href={ROUTES.account}>Download your data</Link> first if you want to keep it.
        </p>

        <CloseAccountForm />
      </Panel>

      <p className={`cond ${styles.footnote}`}>
        Questions about any of this: <a href={`mailto:${CONTACT.privacy}`}>{CONTACT.privacy}</a>.
        What we keep, and for how long, is in the{' '}
        <Link href={legalHref('privacy')}>privacy policy</Link>.
      </p>
    </div>
  );
}
