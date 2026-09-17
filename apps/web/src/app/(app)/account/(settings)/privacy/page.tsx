import type { PrivacyId } from '@landit/core';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ROUTES, riderHref } from '@/lib/routes';

import { AccountDetail } from '../../AccountDetail';
import { PrivacyPanel } from '../../PrivacyPanel';
import { requireAccountRider } from '../../load';

import styles from '../../account.module.css';

export const metadata: Metadata = {
  title: 'Who can see your profile · Land The Trick',
  description: 'Who can see your tricks, stickers and streak.',
  robots: { index: false, follow: false },
};

/**
 * "Who can see your profile" — T11's control, on a screen of its own.
 *
 * The panel is unchanged: the three options are `PRIVACY`'s words in
 * `@landit/core`, the choice saves on a button rather than on the tap (a
 * setting about who can see a child changes when they say so), and what it
 * stores is only *which* of the three API rules applies — the rules themselves
 * are what decide who reads what (plan §3 guarantee 1).
 *
 * The link to the rider's own public profile lands here rather than staying in
 * the "Your profile, and who it is for" panel it used to share with a crew link
 * and a coach link. This is the screen where a rider decides what strangers
 * see, and "here is what they see" is the only thing on the old panel that was
 * about that question. The other two are the Crew cell in the bar and the
 * "Coach / parent view" row in the list.
 */
export default async function AccountPrivacyPage() {
  const { rider } = await requireAccountRider(ROUTES.accountPrivacy);

  return (
    <AccountDetail title="Who can see your profile">
      <PrivacyPanel value={(rider.privacy || 'private') as PrivacyId} headed={false} />

      {rider.handle ? (
        <div className={`panel flat ${styles.aside}`}>
          <div className="lab">What it looks like</div>
          <div className={styles.asideLinks} style={{ marginTop: 10 }}>
            <Link className="btn sm ghost" href={riderHref(rider.handle)}>
              View your public profile
            </Link>
          </div>
        </div>
      ) : null}
    </AccountDetail>
  );
}
