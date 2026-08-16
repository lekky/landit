'use server';

import {
  readSpotSubmission,
  type SpotSubmissionDraft,
  type SpotSubmissionProblems,
} from '@landit/core';
import { isForbidden, isRateLimited, refusalMessage, submitSpot } from '@landit/db';
import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/lib/routes';
import { currentRider } from '@/lib/session';

/**
 * Putting a spot forward.
 *
 * Everything that matters here is a refusal this action does not make. It does
 * not decide that the spot is `pending` — `pocketbase/hooks/60_ownership.pb.js`
 * pins that on every write path, so a request that skipped this action would
 * land `pending` too. It does not decide how often a rider may submit —
 * `62_spots.pb.js` counts, and this file only *translates* the 429 into a
 * sentence. Validation runs here as well as in the hook, and the copy is shared
 * with the form through `@landit/core`, so the rider hears the same thing
 * whichever end caught it (plan §3: defined in `core`, enforced on the server).
 *
 * What it does own is the truthful ending: a submission that succeeded says so
 * and says what happens next, because "thanks!" followed by a spot that never
 * appears is how a rider learns not to bother.
 */
export type SubmitSpotResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      /** A sentence to show above the form. */
      readonly message?: string;
      /** Per-field messages, keyed the same way the form's state is. */
      readonly problems?: SpotSubmissionProblems;
    };

export async function submitSpotAction(draft: SpotSubmissionDraft): Promise<SubmitSpotResult> {
  const session = await currentRider();
  if (!session) return { ok: false, message: 'Sign in to put a spot forward.' };

  const read = readSpotSubmission(draft);
  if (!read.ok) return { ok: false, problems: read.problems };

  try {
    await submitSpot(session.client, {
      userId: session.rider.id,
      name: read.value.name,
      town: read.value.town,
      type: read.value.type,
      lat: read.value.lat,
      lng: read.value.lng,
      sports: read.value.sports,
      tags: read.value.tags,
    });
  } catch (error) {
    if (isRateLimited(error)) {
      return {
        ok: false,
        message:
          refusalMessage(error) ?? 'That is a few spots in a row. Give it a bit and try again.',
      };
    }
    if (isForbidden(error)) {
      return {
        ok: false,
        message:
          refusalMessage(error) ??
          'This account cannot add spots yet. If it is waiting on a guardian, that is why.',
      };
    }
    return { ok: false, message: 'That did not send. Try again in a moment.' };
  }

  revalidatePath(ROUTES.spots);
  return { ok: true };
}
