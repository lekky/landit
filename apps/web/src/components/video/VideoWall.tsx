import { VIDEO_VISIBILITIES, type VideoLink } from '@landit/core';
import { Panel } from '@landit/ui-web';

import { VideoEmbed } from './VideoEmbed';
import styles from './video.module.css';

/**
 * A rider's videos on their profile — **exactly what the viewer is allowed to
 * see, and nothing about what they are not.**
 *
 * A server component, and it does no filtering at all. The rows it is handed
 * came from `listVideoLinks`, which is the `clips` list rule's answer: every row
 * to the owner, the `members` rows to a signed-in consented rider whose subject
 * has a `public` or `members` profile, and nothing to a signed-out visitor (plan
 * §3 guarantee 2). There is no `if (visibility === …)` here on purpose — the
 * same reason the profile page has no `if (privacy === 'private')` in it. A
 * component that decided this would be a second copy of the rule, and the copy
 * that goes stale.
 *
 * It follows that this panel **renders nothing when there is nothing** rather
 * than saying "this rider has private videos". A count of what you may not see
 * is information about somebody who chose not to give it to you.
 *
 * Editing lives on the trick page, where the video was added. Here a rider sees
 * who can see each of their own, which is the fact the profile is the right place
 * to state — the trick page is where it is changed.
 */
export function VideoWall({
  videos,
  isSelf,
  firstName,
}: {
  videos: readonly VideoLink[];
  isSelf: boolean;
  /** "Ellie", for the empty-ish heading. Never a surname (plan §6.4). */
  firstName: string;
}) {
  if (videos.length === 0) return null;

  const labelFor = (id: string) =>
    VIDEO_VISIBILITIES.find((option) => option.id === id)?.label ?? 'Only me';

  return (
    <Panel className={styles.panel}>
      <div className={styles.head}>
        <span className="lab">{isSelf ? 'Your videos' : `${firstName}’s videos`}</span>
        <span className={styles.count}>
          {isSelf ? 'Change these on the trick' : 'On YouTube, not here'}
        </span>
      </div>
      <div className={styles.profileGrid}>
        {videos.map((video) => (
          <div key={video.id} className={styles.tile}>
            <VideoEmbed videoId={video.videoId} label={`${firstName}’s video`} />
            {isSelf && <div className={styles.seenBy}>{labelFor(video.visibility)}</div>}
          </div>
        ))}
      </div>
    </Panel>
  );
}
