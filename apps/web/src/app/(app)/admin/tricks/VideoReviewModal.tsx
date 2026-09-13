'use client';

import { Modal, Tag } from '@landit/ui-web';

import { VideoEmbed } from '@/components/video/VideoEmbed';
import { pbFileUrl } from '@/lib/pbFile';

import type { AdminTrickRow } from '../view';

import styles from '../admin.module.css';

/**
 * Watch a trick's tutorial without leaving the library, and approve it from
 * under the player (Rachid, 2026-09-13, in chat: "a 'view video' which shows
 * the video in a modal … and on that modal there is a 'approve and set live'").
 *
 * It replaced three row buttons — Show video, Hide video, Mark checked — none of
 * which let anybody watch the thing they were approving. Every video action now
 * lives here, next to the video, so a decision is always made with it in view.
 *
 * **It works a queue.** Approving or switching off moves on to the next video in
 * the list as it is currently filtered (the owner's choice, same day), because
 * the job this exists for is working down "Not yet checked" one after another.
 * "Skip" moves on without changing anything. The caller owns the queue; this
 * only draws the current row and says where in it we are.
 *
 * The player is `VideoEmbed`, unchanged, so the privacy rule on the trick page
 * holds here too: nothing is asked of Google until the play press, and the
 * poster is the frame our own backend stored.
 */
export function VideoReviewModal({
  row,
  chip,
  position,
  pending,
  hasNext,
  onApprove,
  onSwitchOff,
  onSkip,
  onClose,
}: {
  row: AdminTrickRow;
  chip: { label: string; color: string; title: string };
  /** "3 of 62 · Not yet checked", or empty when the row has left the filter. */
  position: string;
  pending: boolean;
  hasNext: boolean;
  onApprove: () => void;
  onSwitchOff: () => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  // Approve does something whenever the video is off or unwatched. On a video
  // that is already on and staff-checked there is nothing left to approve, so
  // the button says so rather than offering a press that writes nothing.
  const approved = !row.videoHidden && row.videoSource !== 'auto';

  /*
   * What the press will actually do, said in the label (Rachid, 2026-09-13, in
   * chat: "'approve and set live' is wrong on this card because 'not checked'
   * is live, right?" — it is).
   *
   * A rider sees a tutorial whenever `video_hidden` is false; `video_source`
   * has nothing to do with it (`library/[slug]/page.tsx` renders the panel on
   * `!video.hidden` alone). So "Not checked" means matched automatically, never
   * watched, **and on the trick page right now** — and a button offering to set
   * it live told a staff member it was off when it was not. Only a switched-off
   * video is being set live by this press; on a live one, approving is the
   * whole of it.
   */
  const approveLabel = approved
    ? 'Approved and live'
    : row.videoHidden
      ? 'Approve and set live'
      : 'Approve';

  return (
    <Modal
      title={row.name}
      onClose={onClose}
      width={720}
      footer={
        <div className={styles.reviewFoot}>
          {!row.videoHidden && (
            <button
              type="button"
              className="btn sm ghost"
              disabled={pending}
              title="Take the tutorial off the trick page. The link is kept."
              onClick={onSwitchOff}
            >
              Switch off
            </button>
          )}
          {hasNext && (
            <button type="button" className="btn sm ghost" disabled={pending} onClick={onSkip}>
              Skip
            </button>
          )}
          <button
            type="button"
            className="btn sm"
            disabled={pending || approved}
            style={{ background: approved ? undefined : 'var(--green)' }}
            onClick={onApprove}
          >
            {approveLabel}
          </button>
        </div>
      }
    >
      <div className={styles.reviewBody}>
        {/* Keyed by trick, so moving on starts the next one at its poster
            rather than carrying the last video's playing state across. */}
        <VideoEmbed
          key={row.id}
          videoId={row.videoId}
          label={`${row.videoTitle} — tutorial for ${row.name}`}
          posterSrc={pbFileUrl(row.videoThumbPath)}
        />

        <div>
          <div className="cond" style={{ fontSize: 16 }}>
            {row.videoTitle}
          </div>
          {row.videoChannel && <div className={styles.rowId}>{row.videoChannel}</div>}
        </div>

        <div className={styles.reviewState}>
          <Tag color={chip.color} style={{ fontSize: 10 }}>
            {chip.label}
          </Tag>
          <span>{chip.title}</span>
        </div>

        {position && <div className={styles.rowId}>{position}</div>}
      </div>
    </Modal>
  );
}
