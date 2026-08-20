'use client';

import { STAGE, STAGES, type StageId } from '@landit/core';
import { Button, Panel, ShareCard, StagePicker } from '@landit/ui-web';
import { useState, useTransition } from 'react';

import { useToast } from '@/providers/toast';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

import { acknowledgeStickersAction } from '../../stickers/actions';
import { setStageAction } from '../actions';
import styles from './trick.module.css';

/**
 * "Can you do it?" — the five-stage picker, and what the rider has already told
 * us (screenshot 09).
 *
 * The stage moves in the UI first and is corrected if the server disagrees.
 * That is worth being explicit about: the optimistic value is a *display*
 * convenience, and the server is the authority on every path — the paywall hook
 * can refuse this write, and when it does the picker snaps back and says why
 * rather than leaving a rider looking at a stage that was never stored.
 *
 * Picking the stage you are already on clears it — that is `StagePicker`'s
 * documented behaviour rather than something added here. It is also the whole
 * problem the "Stop tracking this trick" button solves: a rider sitting on
 * *Learning* who taps *Learning* is expecting nothing to happen, so the one
 * gesture that untracks a trick was the one nothing on screen suggested. The
 * button is a second door onto the same `pick(null)` call, not a second path —
 * there is still one write, one refusal and one toast.
 *
 * It sits **below** the five-cell row rather than inside it because stopping is
 * an action and the five are states; putting it in the row would make six cells
 * where the design specifies five, and would change a component every stage row
 * in the app renders through.
 *
 * **Two things T10 added.** The "Share it" button screenshot 09 shows beside the
 * first-landed date, which T7 deliberately left out so one `ShareCard` would
 * serve both this page and the sticker wall (issue #51); and the sticker toast,
 * which is the visible end of the award flow — the hook awards on the write,
 * this announces what came back, and acknowledging it is what stops it being
 * announced twice (plan §3, `rider_stickers.seen_at`).
 */

/** Everything the share card shows for this trick. Built on the server. */
export interface TrickShareView {
  readonly name: string;
  readonly categoryLabel: string;
  readonly sportLabel: string;
  readonly difficulty: number;
  readonly hue: string;
  readonly headline: string;
  readonly meta: string;
  readonly dateLabel: string;
  readonly caption: string;
}

export function StagePanel({
  trickId,
  slug,
  stage,
  landedLabel,
  share,
}: {
  /** The `tricks` record id — what `trick_progress` relates to. */
  trickId: string;
  slug: string;
  stage: StageId | null;
  /** "2 Apr 2026", or "2 Apr 2026 (estimated)". Formatted on the server. */
  landedLabel: string | null;
  /** Absent for a signed-out visitor, who has nothing to share. */
  share: TrickShareView | null;
}) {
  const { toast } = useToast();
  const [current, setCurrent] = useState<StageId | null>(stage);
  const [sharing, setSharing] = useState(false);
  const [, startTransition] = useTransition();

  const pick = (next: string | null) => {
    const value = (next as StageId | null) ?? null;
    const previous = current;
    setCurrent(value);

    startTransition(async () => {
      const result = await setStageAction({ trickId, slug, stage: value });
      if (result.ok) {
        // After the write, never before it: an optimistic count is a count of
        // intentions, and this one is meant to say what riders actually log.
        // The slug is a catalogue fact; nothing here identifies the rider.
        capture(ANALYTICS_EVENTS.trickLogged, { slug, stage: value ?? 'none', from: 'trick' });

        if (value) toast(`Logged as ${STAGE[value].label.toLowerCase()}`, STAGE[value].color);
        else toast('Stopped tracking this one');

        // The award happened server-side inside the write above; this only says
        // so. Announce first, acknowledge after — a sticker stamped seen on the
        // way out is one a dropped response silently swallows.
        const earned = result.earned ?? [];
        for (const sticker of earned) toast(`Sticker earned: ${sticker.name}`, sticker.hue);
        if (earned.length) void acknowledgeStickersAction(earned.map((s) => s.id));
        return;
      }
      setCurrent(previous);
      toast(result.message, 'var(--red)');
    });
  };

  const look = current ? STAGE[current] : null;

  return (
    <Panel flat className={styles.stagePanel}>
      <div className="lab">Can you do it?</div>
      <div className={styles.stages}>
        <StagePicker stages={STAGES} value={current} onPick={pick} compact />
      </div>
      {look && (
        <p className={`cond ${styles.stageNote}`}>
          Logged as <b style={{ color: look.color }}>{look.label}</b>.{' '}
          {look.id === 'every'
            ? "That's it locked in."
            : 'Tap a higher stage when it gets more consistent.'}
        </p>
      )}
      {current && (
        <div className={styles.untrack}>
          <span className={styles.untrackWhy}>
            Takes it off your list. Your first-landed date is kept.
          </span>
          <Button size="sm" variant="ghost" onClick={() => pick(null)}>
            Stop tracking this trick
          </Button>
        </div>
      )}
      {landedLabel && (
        <div className={styles.landed}>
          <div>
            <div className="lab">First landed</div>
            <div className={`cond ${styles.landedDate}`}>{landedLabel}</div>
          </div>
          {share && (
            <Button size="sm" onClick={() => setSharing(true)}>
              Share it
            </Button>
          )}
        </div>
      )}

      {sharing && share && (
        <ShareCard
          kind="trick"
          trick={{
            name: share.name,
            categoryLabel: share.categoryLabel,
            sportLabel: share.sportLabel,
            difficulty: share.difficulty,
            hue: share.hue,
          }}
          headline={share.headline}
          meta={share.meta}
          dateLabel={share.dateLabel}
          caption={share.caption}
          onCopied={(ok) =>
            ok
              ? toast('Caption copied', 'var(--sky)')
              : toast('Could not copy that — select it and copy by hand.', 'var(--red)')
          }
          onClose={() => setSharing(false)}
        />
      )}
    </Panel>
  );
}
