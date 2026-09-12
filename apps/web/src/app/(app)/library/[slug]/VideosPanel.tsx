'use client';

import {
  VIDEO_VISIBILITIES,
  canAddVideoLink,
  parseYouTubeVideoId,
  videoLinkCountLine,
  type VideoLink,
  type VideoLinkAllowance,
  type VideoVisibilityId,
} from '@landit/core';
import { Button } from '@landit/ui-web';
import { useState, useTransition } from 'react';

import { VideoEmbed } from '@/components/video/VideoEmbed';
import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { runAction } from '@/lib/runAction';

import tile from '@/components/video/video.module.css';
import { ROUTES } from '@/lib/routes';
import { useToast } from '@/providers/toast';

import {
  addVideoLinkAction,
  removeVideoLinkAction,
  setVideoLinkVisibilityAction,
} from '../actions';
import styles from './log.module.css';
import { Pager, pageOf } from './Pager';

/** Tiles per page on the videos tab — the handoff's count. */
const VIDEOS_PER_PAGE = 4;

/**
 * "Your videos" — since T30 the second tab of the trick page's log panel
 * (`LogPanel`), where until then it was a panel of its own (T15b; the clips
 * panel's *layout* was the reference, its behaviour is void).
 *
 * What moved is the frame: the ink head and the tab belong to `LogPanel`, and
 * the tiles are paged four at a time. What did **not** move is everything the
 * panel meant, and it is worth keeping the list, because each line is a
 * guarantee rather than a style:
 *
 * - **It says "video", never "clip".** Not a style preference:
 *   `e2e/library.spec.ts` fails if the word "clip" or "vault" appears on this
 *   page, because that copy described a hosted vault the product withdrew (plan
 *   §6.6). The regression test is correct and this tab is built to live
 *   alongside it rather than around it.
 * - **The parse runs here for UX and nowhere else for enforcement.**
 *   `parseYouTubeVideoId` is the same pure function the hook's transcription
 *   runs, so a wrong link is refused before a round trip — but the value sent is
 *   the raw paste and the id that gets stored is the one the *server* parsed
 *   (plan §3 guarantee 2).
 * - **The cap is drawn, not enforced.** The count comes from the server on every
 *   render; the form disables itself at the wall, and the hook refuses anyway.
 * - **The line under the form counts *this trick* first.** Two numbers meet on
 *   this tab and they are not the same number: the videos on the trick being
 *   looked at, and the links the rider holds everywhere, which is what the cap
 *   counts. Saying only the second made a Legend rider's empty tab read
 *   "7 video links added" (Rachid, 2026-09-11). `videoLinkCountLine` puts them
 *   in that order, in `@landit/core`, beside the allowance rules the sentence
 *   is about. It is also the **only** place the allowance is counted out: the
 *   paragraph used to end with a second " 3 left." nudge, which beside
 *   "7 of 10 … used" says the same thing twice, several sentences apart
 *   (Rachid, 2026-09-11, in chat). One fact, one place — including inside a
 *   sentence.
 * - **Nothing here announces anything to anybody.** Adding a video writes one
 *   row. No notification, no feed entry, no crew activity — plan §6.1, and the
 *   reason a rider's video reaches another rider only by that rider opening
 *   their profile.
 *
 * A rider whose plan grants nothing sees one sentence and a link to `/plans`,
 * not a pitch: issue #129 reserves what the paid tiers are worth for the owner.
 *
 * The list is the server's — `initial` is re-read after every action's
 * `revalidatePath`, so there is no local copy of it to fall out of step.
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
  const [page, setPage] = useState(0);
  const [pending, startTransition] = useTransition();

  const canAdd = canAddVideoLink(allowance, heldTotal);
  const grantsNone = !allowance.unlimited && allowance.cap === 0;

  // "2 videos on this trick. 3 of 10 video links used across all your tricks" —
  // the trick's own count leading, and the cap's count named for what it is.
  const countLine = videoLinkCountLine(allowance, {
    onThisTrick: initial.length,
    heldTotal,
  });

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
      const result = await runAction('video_add', () =>
        addVideoLinkAction({
          trickId,
          slug,
          link: pasted,
          // Private by default, always. A rider opens a video afterwards, on the
          // tile, which is one deliberate act rather than a default they were
          // handed (plan §6.4 standard 7).
          visibility: 'private',
        }),
      );
      if (result.ok) {
        // That a link was added, and for which trick. Never the URL — a
        // rider's own YouTube channel is a thing about them, not the product.
        capture(ANALYTICS_EVENTS.videoLinkAdded, { slug });
        setLink('');
        // The new video is newest, so it is on the first page.
        setPage(0);
      } else setProblem(result.message);
    });
  };

  const changeVisibility = (videoLinkId: string, visibility: VideoVisibilityId) => {
    startTransition(async () => {
      const result = await runAction('video_visibility', () =>
        setVideoLinkVisibilityAction({ videoLinkId, slug, visibility }),
      );
      if (result.ok) capture(ANALYTICS_EVENTS.videoVisibilitySet, { slug, visibility });
      if (!result.ok) toast(result.message, 'var(--red)');
    });
  };

  const remove = (videoLinkId: string) => {
    startTransition(async () => {
      const result = await runAction('video_remove', () =>
        removeVideoLinkAction({ videoLinkId, slug }),
      );
      if (result.ok) capture(ANALYTICS_EVENTS.videoLinkRemoved, { slug });
      if (!result.ok) toast(result.message, 'var(--red)');
    });
  };

  const shown = pageOf(initial, page, VIDEOS_PER_PAGE);

  return (
    <div>
      {initial.length > 0 && (
        <div className={styles.videoGrid}>
          {shown.map((video) => (
            <div key={video.id} className={tile.tile}>
              <VideoEmbed videoId={video.videoId} label={`${trickName} video`} />
              <div className={tile.tileFoot}>
                <select
                  aria-label="Who can see this video"
                  className={tile.visibility}
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
                  className={tile.remove}
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

      <Pager
        total={initial.length}
        perPage={VIDEOS_PER_PAGE}
        page={page}
        onPage={setPage}
        bare
        label="videos"
      />

      {grantsNone ? (
        <p className={styles.locked}>
          Adding a video is part of the paid plans. <a href={ROUTES.plans}>See what they cost</a>.
        </p>
      ) : (
        <>
          <div className={styles.videoForm}>
            <input
              aria-label="YouTube link"
              className={styles.videoInput}
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
              {countLine}. The video stays on YouTube — we only keep the link. New videos start
              private, and nothing you add is ever visible to someone who is not signed in.
            </p>
          ) : (
            <p className={styles.hint}>
              That is all {allowance.cap} of your video links, counting every trick. Remove one to
              add another.
            </p>
          )}
        </>
      )}
    </div>
  );
}
