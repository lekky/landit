'use client';

import { STAGE, STAGES, type StageId } from '@landit/core';
import { StagePicker, TrickCard } from '@landit/ui-web';
import { useState, useTransition } from 'react';

import { useToast } from '@/providers/toast';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { runAction } from '@/lib/runAction';

import { setStageAction } from '../library/actions';
import { acknowledgeStickersAction } from '../stickers/actions';
import type { TrickCardView } from './view';

import styles from './home.module.css';

/**
 * One of the rider's own tricks on the dashboard, with its stage row
 * underneath (T22).
 *
 * **It draws every tracked stage now, not just `trying`** (Rachid, 2026-09-18,
 * in chat). The name is the one it was born with; what changed is the list it
 * is drawn from — "Your tricks" is all of them, learning first, so this
 * component is as likely to be showing something landed as something in
 * progress.
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
 * A locked trick gets no row. It is rare rather than impossible — a rider whose
 * plan lapsed keeps the stages they set while the trick is theirs, and a card
 * whose stage row would be refused on every tap should not draw one. The
 * refusal itself is the hook's either way (plan §3, guarantee 3); this is only
 * about not offering a tap that cannot land.
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
      // Wrapped for the same reason the trick page's picker is: a thrown
      // Server Function used to leave the optimistic stage standing with nothing
      // said, so the write was lost and the card claimed otherwise.
      const result = await runAction('trick_stage', () =>
        setStageAction({ trickId: recordId, slug: trick.slug, stage: value }),
      );
      if (result.ok) {
        // Same event as the trick page's picker, with `from` to tell the two
        // apart — bumping from the dashboard and bumping from the trick are the
        // same act, and counting them as two events would hide that.
        capture(ANALYTICS_EVENTS.trickLogged, {
          slug: trick.slug,
          stage: value ?? 'none',
          from: 'home',
        });

        /*
         * Say where it went (#190, owner's pick, 2026-09-01), and **kept after
         * the section was widened** (2026-09-18).
         *
         * The widening fixed the sharp edge the toast was written for: the
         * section is every tracked stage now, so a bump ordinarily moves the
         * card down the grid rather than out of it. It does not fix it for
         * everyone — the grid is still the first four (two on a phone), so a
         * rider with a long list can bump a trick from the front of it to a
         * position they cannot see. That is the case this sentence is still
         * for, and it costs a rider with three tricks nothing to read it.
         */
        if (value === 'trying')
          toast(`Logged as ${STAGE[value].label.toLowerCase()}`, STAGE[value].color);
        else if (value) {
          const label = STAGE[value].label;
          toast(
            `Logged as ${label.toLowerCase()} — now under ${label} in your library`,
            STAGE[value].color,
          );
        } else toast('Stopped tracking this one');

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
