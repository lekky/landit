'use client';

import type { ReactNode } from 'react';

import { TAB_PANEL, TabRow } from '@/components/shell/TabRow';
import { useTabParam } from '@/components/shell/useTabParam';

/**
 * Landed · Stickers · Videos on a rider's profile (rethink §3.10, T52).
 *
 * **A client wrapper around three server-rendered panels.** Everything under
 * the row — the landed list, the sticker grid, the video wall — is built on the
 * server from reads made with the *viewer's* own client, and arrives here as
 * `ReactNode`. Nothing is fetched in the browser and nothing is decided here:
 * the profile's gate is `users.listRule` and the clips' gate is the `clips`
 * rule, exactly as before (plan §3, guarantees 1 and 2). This component chooses
 * which of three finished panels is on screen and nothing else.
 *
 * **The Videos tab is not drawn when the wall is empty**, which is the rule
 * `VideoWall` already keeps for itself: a panel — or a tab — saying "nothing
 * here" to a viewer who is not allowed to see a rider's clips is a statement
 * about a choice that rider made, and a count of what you may not see is
 * information you were not given. So the row is two tabs for most riders and
 * three for one with something to show. It is the same call §3.1 makes for the
 * sport chip at one sport and §3.6 makes for What's new at one crew: a tab that
 * can only ever be empty is not a choice.
 *
 * The answer lives in `?tab=` (`useTabParam`) rather than in `useState`, the
 * pattern Progress set: a rider who opens a mate's video, presses Back, and
 * lands on Landed has lost their place, and a profile is a screen people arrive
 * at from a link as often as from the board.
 */
export function ProfileTabs({
  landed,
  stickers,
  videos,
  hasVideos,
}: {
  readonly landed: ReactNode;
  readonly stickers: ReactNode;
  readonly videos: ReactNode;
  /** Whether the viewer is allowed anything at all on the video wall. */
  readonly hasVideos: boolean;
}) {
  const ids = hasVideos ? PROFILE_TABS : PROFILE_TABS.slice(0, 2);
  const [tab, setTab] = useTabParam(ids, 'landed');

  return (
    <>
      <TabRow
        items={ids.map((id) => ({ id, label: LABELS[id as ProfileTab] }))}
        value={tab}
        group="rider"
        label="What to show on this profile"
        onChange={setTab}
      />
      <div key={tab} role="tabpanel" aria-label={LABELS[tab as ProfileTab]} className={TAB_PANEL}>
        {tab === 'landed' ? landed : null}
        {tab === 'stickers' ? stickers : null}
        {tab === 'videos' ? videos : null}
      </div>
    </>
  );
}

/** The catalogue ids `tabs_switched` carries as `tab` under the group `rider`. */
const PROFILE_TABS = ['landed', 'stickers', 'videos'] as const;
type ProfileTab = (typeof PROFILE_TABS)[number];

const LABELS: Readonly<Record<ProfileTab, string>> = {
  landed: 'Landed',
  stickers: 'Stickers',
  videos: 'Videos',
};
