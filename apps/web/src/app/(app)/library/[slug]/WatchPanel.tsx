'use client';

import type { Trick, TrickVideo } from '@landit/core';
import Link from 'next/link';

import { VideoEmbed } from '@/components/video/VideoEmbed';
import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

import styles from './trick.module.css';

/**
 * "Watch it" — the staff-picked tutorial for this trick (T34).
 *
 * **Why the panel exists.** The trick page tells a rider what the trick is,
 * what usually goes wrong, why it sits at its tier and what comes before it,
 * and never once shows them the trick. Children learn tricks by watching them.
 *
 * **Why it leads the left column rather than the hero.** Prominence was the
 * owner's instruction (2026-09-12, in chat), and the hero is the most prominent
 * place on the page — but T26 and T26a made that band award-led on purpose,
 * with the badge as the thing a rider came to want. This is the most prominent
 * slot that leaves that decision alone, and below 820px the grid is one column,
 * so it is the first thing under the stage ladder anyway.
 *
 * **Why there is no empty state.** The page renders this only when the trick
 * has a video, and most tricks do not — measured at roughly four in five across
 * the library, and far worse on scooter (plan §7 T34). No placeholder, no
 * "coming soon", and **never another sport's video**, however close
 * `CROSS_SPORT` says the movement is: a rider on a trick with no video should
 * not be able to tell that other tricks have one. The cross-sport panel still
 * links the *trick*, which is a different thing from playing its video here.
 *
 * **Why it is a client component.** `VideoEmbed` is one — it holds the
 * click-to-play state that keeps Google out of the page load — and the press
 * is also the only moment at which a video can honestly be counted as watched.
 *
 * Signed out too (owner, 2026-09-12, in chat): this is staff content on a
 * public, indexed page, and a visitor who arrived from a search for "how to
 * abubaca" should get the answer they came for.
 */
export function WatchPanel({ trick, video }: { trick: Trick; video: TrickVideo }) {
  return (
    <div className={styles.watch}>
      <VideoEmbed
        videoId={video.id}
        label={`how to ${trick.name}`}
        onPlay={() =>
          capture(ANALYTICS_EVENTS.trickVideoPlayed, {
            trick: trick.id,
            sport: trick.sport,
            tier: trick.diff,
          })
        }
      />

      <div className={styles.watchFoot}>
        <div className={styles.watchTitleBox}>
          {/*
            The title and the channel are shown because they are *stored*, not
            fetched — see `TrickVideo`. Asking YouTube what a video is called
            would be the page-load request to Google that the poster above
            exists to avoid.
          */}
          <div className={styles.watchTitle}>{video.title}</div>
          <div className={`cond ${styles.watchBy}`}>
            {video.channel ? `${video.channel} · on YouTube` : 'On YouTube'}
          </div>
        </div>

        {/*
          Somebody else's video on a page built for children, so there is a way
          to say so. `about=clip` is the report form's existing video subject
          and `id` is the trick it was found on — the same pair a rider's own
          video link should carry, which issue #153 is still open about.
        */}
        <Link
          className={`cond ${styles.watchReport}`}
          href={{ pathname: '/report', query: { about: 'clip', id: trick.id } }}
          onClick={() => capture(ANALYTICS_EVENTS.trickVideoReported, { trick: trick.id })}
        >
          Something wrong?
        </Link>
      </div>

      <p className={styles.watchNote}>Nothing loads from YouTube until you press play.</p>
    </div>
  );
}
