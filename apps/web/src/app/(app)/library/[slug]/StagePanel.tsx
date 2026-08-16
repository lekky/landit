'use client';

import { STAGE, STAGES, type StageId } from '@landit/core';
import { Panel, StagePicker } from '@landit/ui-web';
import { useState, useTransition } from 'react';

import { useToast } from '@/providers/toast';

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
 * Picking the stage you are already on clears it. That is the untrack path, and
 * it is `StagePicker`'s documented behaviour rather than something added here.
 */
export function StagePanel({
  trickId,
  slug,
  stage,
  landedLabel,
}: {
  /** The `tricks` record id — what `trick_progress` relates to. */
  trickId: string;
  slug: string;
  stage: StageId | null;
  /** "2 Apr 2026", or "2 Apr 2026 (estimated)". Formatted on the server. */
  landedLabel: string | null;
}) {
  const { toast } = useToast();
  const [current, setCurrent] = useState<StageId | null>(stage);
  const [, startTransition] = useTransition();

  const pick = (next: string | null) => {
    const value = (next as StageId | null) ?? null;
    const previous = current;
    setCurrent(value);

    startTransition(async () => {
      const result = await setStageAction({ trickId, slug, stage: value });
      if (result.ok) {
        if (value) toast(`Logged as ${STAGE[value].label.toLowerCase()}`, STAGE[value].color);
        else toast('Stopped tracking this one');
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
      {landedLabel && (
        <div className={styles.landed}>
          <div className="lab">First landed</div>
          <div className={`cond ${styles.landedDate}`}>{landedLabel}</div>
        </div>
      )}
    </Panel>
  );
}
