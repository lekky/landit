import type { LevelId, SportId, StanceId } from '@landit/core';
import type { Metadata } from 'next';

import { ROUTES } from '@/lib/routes';

import { AccountDetail } from '../../AccountDetail';
import { ProfilePanel } from '../../ProfilePanel';
import { requireAccountRider } from '../../load';

export const metadata: Metadata = {
  title: 'What you ride · Land The Trick',
  description: 'The sports Land The Trick shows you, and how to change them.',
  robots: { index: false, follow: false },
};

/**
 * "What you ride" — the sports picker, on a screen of its own (rethink §3.9).
 *
 * It is the same `ProfilePanel` as the row above, drawn with `section="sports"`
 * rather than copied, and that is deliberate: `saveProfileAction` writes the
 * whole profile every time, so the panel has to hold the whole profile whichever
 * part of it a rider is looking at. A second component owning only the sports
 * would post a profile with the other five answers missing.
 *
 * Turning a sport off can orphan the goal that belonged to it, and the panel
 * already handles that by clearing the goal and holding the write until there
 * is a complete answer again. On this screen the goal picker is one row away
 * rather than under the sports, so the panel says which screen finishes the job
 * (`section="sports"`, `ProfilePanel`).
 */
export default async function AccountSportsPage() {
  const { rider } = await requireAccountRider(ROUTES.accountSports);

  return (
    <AccountDetail title="What you ride">
      <ProfilePanel
        section="sports"
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
