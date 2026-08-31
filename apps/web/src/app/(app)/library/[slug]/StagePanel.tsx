'use client';

import { LANDED_STAGES, STAGE, STAGES, type StageId } from '@landit/core';
import { Button, ShareCard } from '@landit/ui-web';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { useToast } from '@/providers/toast';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

import { acknowledgeStickersAction } from '../../stickers/actions';
import { setStageAction } from '../actions';
import styles from './trick.module.css';

/**
 * "Can you do it?" — the five stages, as the black band under the hero.
 *
 * Until the trick-page pack (owner, 2026-08-31) this was a panel third in the
 * right-hand column, below the videos. It is the only thing on this page a
 * rider *does* — the rest is copy to read and links to follow — and the pack's
 * argument is that its place on the page should say so. So: full width, on
 * ink, immediately under the trick's name, with the award badge overhanging
 * into it from the hero.
 *
 * What it does is unchanged from T7 and T10, and deliberately so. The stage
 * moves in the UI first and is corrected if the server disagrees — the
 * optimistic value is a *display* convenience, and the server is the authority
 * on every path, since the paywall hook can refuse this write and when it does
 * the ladder snaps back and says why rather than leaving a rider looking at a
 * stage that was never stored.
 *
 * **Two things the pack changed.** Stopping now asks first: it is one tap on a
 * child's record, and the pack calls for a confirm. And a stage that crosses
 * into `some` refreshes the page, because the award badge in the hero is
 * server-rendered from `rider_stickers` and the stamp landing on it is the
 * moment the whole screen is arranged around. The refresh is what makes that
 * happen at the tap rather than at the next reload; it is asked for only when
 * the write says a sticker came back, so an ordinary stage change still costs
 * nothing.
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

const LANDED: readonly string[] = LANDED_STAGES;

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
  const router = useRouter();
  const [current, setCurrent] = useState<StageId | null>(stage);
  const [sharing, setSharing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [, startTransition] = useTransition();

  const pick = (next: StageId | null) => {
    const previous = current;
    setCurrent(next);
    setConfirming(false);

    startTransition(async () => {
      const result = await setStageAction({ trickId, slug, stage: next });
      if (result.ok) {
        // After the write, never before it: an optimistic count is a count of
        // intentions, and this one is meant to say what riders actually log.
        // The slug is a catalogue fact; nothing here identifies the rider.
        capture(ANALYTICS_EVENTS.trickLogged, { slug, stage: next ?? 'none', from: 'trick' });

        if (next) toast(`Logged as ${STAGE[next].label.toLowerCase()}`, STAGE[next].color);
        else toast('Stopped tracking this one');

        // The award happened server-side inside the write above; this only says
        // so. Announce first, acknowledge after — a sticker stamped seen on the
        // way out is one a dropped response silently swallows.
        const earned = result.earned ?? [];
        for (const sticker of earned) toast(`Sticker earned: ${sticker.name}`, sticker.hue);
        if (earned.length) {
          void acknowledgeStickersAction(earned.map((s) => s.id));
          // And the badge in the hero, which the server draws from the row the
          // hook has just written. Only on the tap that earned something.
          router.refresh();
        }
        return;
      }
      setCurrent(previous);
      toast(result.message, 'var(--red)');
    });
  };

  const index = current ? STAGES.findIndex((s) => s.id === current) : -1;
  const landed = current !== null && LANDED.includes(current);

  return (
    <div className={styles.band}>
      <div className={styles.bandHead}>
        <span className={`lab ${styles.bandTitle}`}>Can you do it?</span>
        <span className={`lab ${current ? styles.bandStatusLogged : styles.bandStatus}`}>
          {current ? `Logged · ${STAGE[current].label}` : 'Nothing logged yet'}
        </span>
      </div>

      <div className={styles.ladder} role="group" aria-label="Can you do it?">
        {STAGES.map((s, i) => {
          const now = current === s.id;
          const past = index > i;
          return (
            <button
              type="button"
              key={s.id}
              aria-pressed={now}
              /*
               * Tapping the stage you are already on does nothing — the pack is
               * explicit about it, and the way off the ladder is the confirmed
               * "Stop tracking" below rather than a tap that looks like a no-op
               * and silently untracks the trick.
               */
              disabled={now}
              className={`${styles.step}${past ? ` ${styles.stepPast}` : ''}${now ? ` ${styles.stepNow}` : ''}`}
              onClick={() => pick(s.id)}
            >
              <span className={styles.stepDot} />
              {/* The short label: "Want", not "Want to learn". Five cells share
                  one row and the pack's ladder reads across in one line. Every
                  stage in `STAGES` carries one, so there is no fallback to
                  write — TypeScript narrows one to `never` if you try. */}
              {s.short}
            </button>
          );
        })}
      </div>

      {!current && (
        <p className={`cond ${styles.bandNote}`}>
          Tap a stage to start tracking. The badge gets stamped at <b>Sometimes</b>.
        </p>
      )}

      {current && !confirming && (
        <div className={styles.bandFoot}>
          {landedLabel ? (
            <div>
              <div className={`lab ${styles.bandLabel}`}>First landed</div>
              <div className={`cond ${styles.bandDate}`}>{landedLabel}</div>
            </div>
          ) : (
            <p className={`cond ${styles.bandNoteInline}`}>
              {landed ? 'The badge is yours from here.' : 'Tap a higher stage as it comes good.'}
            </p>
          )}
          <div className={styles.bandActions}>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
              Stop tracking
            </Button>
            {landedLabel && share && (
              <Button size="sm" onClick={() => setSharing(true)}>
                Share it
              </Button>
            )}
          </div>
        </div>
      )}

      {/*
        The confirm. It clears the stage and nothing else: the first-landed date
        and the award both survive, which is the sentence a rider needs to read
        before they answer rather than after.
      */}
      {current && confirming && (
        <div className={styles.bandFoot}>
          <p className={`cond ${styles.bandNoteInline}`}>
            Stop tracking this trick? Your first-landed date and your badge are kept.
          </p>
          <div className={styles.bandActions}>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Keep tracking
            </Button>
            <Button size="sm" onClick={() => pick(null)}>
              Stop tracking
            </Button>
          </div>
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
    </div>
  );
}
