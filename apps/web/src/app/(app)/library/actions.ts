'use server';

import type { StageId } from '@landit/core';
import { clearTrickStage, isForbidden, saveTrickNote, setTrickStage } from '@landit/db';
import { revalidatePath } from 'next/cache';

import { ROUTES, trickHref } from '@/lib/routes';
import { currentRider } from '@/lib/session';

/**
 * The two writes the trick page makes.
 *
 * Neither of them checks the paywall, and that is deliberate. The
 * `trick_progress` hook refuses a paid trick to a rookie on every write path
 * including this one (plan §3, guarantee 3), so a check here would be a second,
 * weaker copy of it — and the copy that goes stale. What this file does with a
 * refusal is *translate* it: a 403 becomes a sentence a fourteen year old can
 * read, rather than a stack trace or a silent no-op.
 */

export type StageActionResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

/**
 * Set — or clear — the rider's stage on one trick.
 *
 * Clearing removes the progress row and leaves the log alone, which is
 * `clearTrickStage`'s documented behaviour: untracking a trick is not a claim
 * that it was never landed, and the rider's history is theirs to delete
 * separately (plan §3, "log semantics, reconciled").
 */
export async function setStageAction(input: {
  trickId: string;
  slug: string;
  stage: StageId | null;
}): Promise<StageActionResult> {
  const session = await currentRider();
  if (!session) return { ok: false, message: 'Sign in to keep track of this one.' };

  try {
    if (input.stage === null) {
      await clearTrickStage(session.client, session.rider.id, input.trickId);
    } else {
      await setTrickStage(session.client, {
        userId: session.rider.id,
        trickId: input.trickId,
        stage: input.stage,
      });
    }
  } catch (error) {
    if (isForbidden(error)) {
      return {
        ok: false,
        message: 'This one is on the Shredder plan, so it cannot be tracked yet.',
      };
    }
    return { ok: false, message: 'That did not save. Try again in a moment.' };
  }

  revalidatePath(trickHref(input.slug));
  revalidatePath(ROUTES.library);
  return { ok: true };
}

/** A rider's private notebook on one trick. Nobody else can ever read it (plan §6.1). */
export async function saveNoteAction(input: {
  trickId: string;
  slug: string;
  body: string;
}): Promise<StageActionResult> {
  const session = await currentRider();
  if (!session) return { ok: false, message: 'Sign in to keep notes.' };

  try {
    await saveTrickNote(session.client, {
      userId: session.rider.id,
      trickId: input.trickId,
      body: input.body,
    });
  } catch {
    return { ok: false, message: 'That note did not save. Try again in a moment.' };
  }

  revalidatePath(trickHref(input.slug));
  return { ok: true };
}
