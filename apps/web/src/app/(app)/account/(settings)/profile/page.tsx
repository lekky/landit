import type { LevelId, SportId, StanceId } from '@landit/core';
import type { Metadata } from 'next';

import { ROUTES } from '@/lib/routes';

import { AccountDetail } from '../../AccountDetail';
import { ProfilePanel } from '../../ProfilePanel';
import { requireAccountRider } from '../../load';

export const metadata: Metadata = {
  title: 'Your profile · Land The Trick',
  description: 'Your picture, your goal, your stance and where you are at.',
  robots: { index: false, follow: false },
};

/**
 * "Your profile" — the first row of the account list (rethink §3.9).
 *
 * The panel is T23's, unchanged in every way that matters: it still posts the
 * *whole* profile on every change, still holds an incomplete answer rather than
 * writing one, still offers "Try again" on a failure, and still fires
 * `profile_saved` once per control a write covered. What it takes now is a
 * `section`, because the sports picker that shared the panel with it is the row
 * below and has a screen of its own.
 */
export default async function AccountProfilePage() {
  const { rider } = await requireAccountRider(ROUTES.accountProfile);

  return (
    <AccountDetail title="Your profile">
      <ProfilePanel
        section="profile"
        name={rider.name}
        sports={(rider.sports ?? []) as SportId[]}
        level={(rider.level || null) as LevelId | null}
        goal={rider.goal || null}
        goalCustom={rider.goal_custom || ''}
        stance={(rider.stance || null) as StanceId | null}
        avatarKey={rider.avatar_key || null}
      />
    </AccountDetail>
  );
}
