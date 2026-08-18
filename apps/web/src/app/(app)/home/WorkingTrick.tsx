'use client';

import { STAGE, STAGES, type StageId } from '@landit/core';
import { StagePicker, TrickCard } from '@landit/ui-web';
import { useState, useTransition } from 'react';

import { useToast } from '@/providers/toast';

import { setStageAction } from '../library/actions';
import { acknowledgeStickersAction } from '../stickers/actions';
import type { TrickCardView } from './view';

import styles from './home.module.css';

/**
 * One trick in "Working on it", with its stage row underneath (T22).
 *
 * **The row is a sibling of the card, not a child of it, and that is a
 * constraint rather than a preference.** `TrickCard` is itself a `<button>` —
 * the whole card opens the trick — and a button inside a button is invalid
 * markup that browsers repair by moving the inner one out. It is also unusable
 * with a keyboard or a screen reader, which on a product used by children is
 * not a detail. So the card keeps its one job and the row sits below it, inside
 * a wrapper this screen owns. Nothing in `packages/ui-web` changed.
 *
 * The write is `setStageAction` — the same server action the trick page calls,
 * with the same optimistic-then-corrected behaviour and the same refusal
 * translated into a sentence. There is no second write path and no second copy
 * of the paywall rule: the `trick_progress` hook is the authority here exactly
 * as it is there (plan §3, guarantee 3), and if it refuses, the row snaps back
 * and says why.
 *
 * A locked trick gets no row. It cannot appear in this list anyway — you cannot
 * be learning a trick you were never allowed to track — but a card whose stage
 * row would be refused on every tap should not draw one.
 */
export function WorkingTrick({ trick, onOpen }: { trick: TrickCardView; onOpen: () => void }) {
  const { toast } = useToast();
  // `StageLook.id` is a plain `string`: it is `ui-web`'s presentational type and
  // knows nothing about the stage rules. The value is a `StageId` by
  // construction — the server built this card's stage from `STAGE[...]` — so the
  // assertion is narrowing what we already handed over, not a guess about it.
  const [current, setCurrent] = useState<StageId | null>(
    (trick.stage?.id as StageId | undefined) ?? null,
  );
  const [, startTransition] = useTransition();

  const recordId = trick.recordId;
  const bumpable = Boolean(recordId) && !trick.locked;

  const pick = (next: string | null) => {
    if (!recordId) return;
    const value = (next as StageId | null) ?? null;
    const previous = current;
    setCurrent(value);

    startTransition(async () => {
      const result = await setStageAction({ trickId: recordId, slug: trick.slug, stage: value });
      if (result.ok) {
        if (value) toast(`Logged as ${STAGE[value].label.toLowerCase()}`, STAGE[value].color);
        else toast('Stopped tracking this one');

        const earned = result.earned ?? [];
        for (const sticker of earned) toast(`Sticker earned: ${sticker.name}`, sticker.hue);
        if (earned.length) void acknowledgeStickersAction(earned.map((s) => s.id));
        return;
      }
      setCurrent(previous);
      toast(result.message, 'var(--red)');
    });
  };

  return (
    <div className={styles.working}>
      <TrickCard
        name={trick.name}
        category={trick.category}
        difficulty={trick.difficulty}
        sport={trick.sport}
        stage={
          current
            ? {
                id: current,
                // The short label, matching what the server builds in
                // `toCardView` — the card footer is narrow and "Most times" is
                // already the longest thing that fits.
                label: STAGE[current].short,
                short: STAGE[current].short,
                color: STAGE[current].color,
              }
            : null
        }
        locked={trick.locked}
        onOpen={onOpen}
        {...(trick.lockTier ? { lockTier: trick.lockTier } : {})}
      />
      {bumpable && (
        <div className={styles.workingStages}>
          <StagePicker stages={STAGES} value={current} onPick={pick} compact />
        </div>
      )}
    </div>
  );
}
