'use client';

import {
  VIDEO_VISIBILITIES,
  canAddVideoLink,
  parseYouTubeVideoId,
  videoLinksRemaining,
  type VideoLink,
  type VideoLinkAllowance,
  type VideoVisibilityId,
} from '@landit/core';
import { Button, Panel } from '@landit/ui-web';
import { useState, useTransition } from 'react';

import { VideoEmbed } from '@/components/video/VideoEmbed';
import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

import styles from '@/components/video/video.module.css';
import { ROUTES } from '@/lib/routes';
import { useToast } from '@/providers/toast';

import {
  addVideoLinkAction,
  removeVideoLinkAction,
  setVideoLinkVisibilityAction,
} from '../actions';

/**
 * "Your videos" on the trick page — the surface that replaces the clips panel
 * (T15b; the clips panel's *layout* is the reference, its behaviour is void).
 *
 * The rider pastes a YouTube link, picks who can see it, and can remove it. Four
 * things about this component are deliberate:
 *
 * - **It says "video", never "clip".** Not a style preference:
 *   `e2e/library.spec.ts` fails if the word "clip" or "vault" appears on this
 *   page, because that copy described a hosted vault the product withdrew (plan
 *   §6.6). The regression test is correct and this panel is built to live
 *   alongside it rather than around it.
 * - **The parse runs here for UX and nowhere else for enforcement.**
 *   `parseYouTubeVideoId` is the same pure function the hook's transcription
 *   runs, so a wrong link is refused before a round trip — but the value sent is
 *   the raw paste and the id that gets stored is the one the *server* parsed
 *   (plan §3 guarantee 2).
 * - **The cap is drawn, not enforced.** The count comes from the server on every
 *   render; the form disables itself at the wall, and the hook refuses anyway.
 * - **Nothing here announces anything to anybody.** Adding a video writes one
 *   row. No notification, no feed entry, no crew activity — plan §6.1, and the
 *   reason a rider's video reaches another rider only by that rider opening
 *   their profile.
 *
 * A rider whose plan grants nothing sees one sentence and a link to `/plans`,
 * not a pitch: issue #129 reserves what the paid tiers are worth for the owner.
 */
export function VideosPanel({
  trickId,
  slug,
  trickName,
  initial,
  allowance,
  heldTotal,
}: {
  trickId: string;
  slug: string;
  /** For the play button's accessible name — "Play Tailwhip". */
  trickName: string;
  /** This rider's videos on this trick, newest first, from the server. */
  initial: readonly VideoLink[];
  allowance: VideoLinkAllowance;
  /** Links this rider holds **across all tricks** — what the cap counts. */
  heldTotal: number;
}) {
  const { toast } = useToast();
  const [link, setLink] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const remaining = videoLinksRemaining(allowance, heldTotal);
  const canAdd = canAddVideoLink(allowance, heldTotal);
  const grantsNone = !allowance.unlimited && allowance.cap === 0;

  const countLine = allowance.unlimited
    ? `${heldTotal} added`
    : `${heldTotal} of ${allowance.cap} used`;

  const submit = () => {
    const pasted = link.trim();
    if (!pasted) return;
    // Client-side, for the round trip a rider does not have to wait for. The
    // hook parses again and its answer is the one that counts.
    if (!parseYouTubeVideoId(pasted)) {
      setProblem(
        'That does not look like a YouTube link. Copy the address from the video — youtube.com/watch, youtu.be or a Shorts link.',
      );
      return;
    }
    setProblem(null);
    startTransition(async () => {
      const result = await addVideoLinkAction({
        trickId,
        slug,
        link: pasted,
        // Private by default, always. A rider opens a video afterwards, on the
        // tile, which is one deliberate act rather than a default they were
        // handed (plan §6.4 standard 7).
        visibility: 'private',
      });
      if (result.ok) {
        // That a link was added, and for which trick. Never the URL — a
        // rider's own YouTube channel is a thing about them, not the product.
        capture(ANALYTICS_EVENTS.videoLinkAdded, { slug });
        setLink('');
      } else setProblem(result.message);
    });
  };

  const changeVisibility = (videoLinkId: string, visibility: VideoVisibilityId) => {
    startTransition(async () => {
      const result = await setVideoLinkVisibilityAction({ videoLinkId, slug, visibility });
      if (result.ok) capture(ANALYTICS_EVENTS.videoVisibilitySet, { slug, visibility });
      if (!result.ok) toast(result.message, 'var(--red)');
    });
  };

  const remove = (videoLinkId: string) => {
    startTransition(async () => {
      const result = await removeVideoLinkAction({ videoLinkId, slug });
      if (result.ok) capture(ANALYTICS_EVENTS.videoLinkRemoved, { slug });
      if (!result.ok) toast(result.message, 'var(--red)');
    });
  };

  return (
    <Panel flat className={styles.panel}>
      <div className={styles.head}>
        <div className="lab">Your videos</div>
        {!grantsNone && <span className={styles.count}>{countLine}</span>}
      </div>

      {initial.length > 0 && (
        <div className={styles.grid}>
          {initial.map((video) => (
            <div key={video.id} className={styles.tile}>
              <VideoEmbed videoId={video.videoId} label={`${trickName} video`} />
              <div className={styles.tileFoot}>
                <select
                  aria-label="Who can see this video"
                  className={styles.visibility}
                  value={video.visibility}
                  disabled={pending}
                  onChange={(event) =>
                    changeVisibility(video.id, event.target.value as VideoVisibilityId)
                  }
                >
                  {VIDEO_VISIBILITIES.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={styles.remove}
                  disabled={pending}
                  onClick={() => remove(video.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {grantsNone ? (
        <p className={styles.locked}>
          Adding a video is part of the paid plans. <a href={ROUTES.plans}>See what they cost</a>.
        </p>
      ) : (
        <>
          <div className={styles.form}>
            <input
              aria-label="YouTube link"
              className={styles.input}
              type="url"
              inputMode="url"
              placeholder="Paste a YouTube link"
              value={link}
              disabled={pending || !canAdd}
              onChange={(event) => setLink(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submit();
                }
              }}
            />
            <Button size="sm" variant="ink" disabled={pending || !canAdd} onClick={submit}>
              Add
            </Button>
          </div>

          {problem ? (
            <p className={styles.problem}>{problem}</p>
          ) : canAdd ? (
            <p className={styles.hint}>
              The video stays on YouTube — we only keep the link. New videos start private, and
              nothing you add is ever visible to someone who is not signed in.
              {remaining !== null && remaining <= 3 && ` ${remaining} left.`}
            </p>
          ) : (
            <p className={styles.hint}>
              That is all {allowance.cap} of your video links. Remove one to add another.
            </p>
          )}
        </>
      )}
    </Panel>
  );
}
