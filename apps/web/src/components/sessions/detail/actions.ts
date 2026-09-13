'use server';

import { isNotFound, refusalMessage, setSessionVisibility } from '@landit/db';
import { revalidatePath } from 'next/cache';

import { isRecordId, SESSIONS_PATH, sessionHref } from '@/lib/sessionRoutes';
import { currentRider } from '@/lib/session';

export type MakePrivateResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

/**
 * "Make it private" on the session detail page (T39), **with the rider's own
 * client** — the collection's update rule is what makes the session theirs to
 * change, so an id that belongs to somebody else answers 404 and is reported
 * the same as one that is not there.
 *
 * Only ever *down* to private. The picker that can open a session up is the
 * form's (T38), where the rider sees the ceiling their profile sets; a button
 * that widened who can see a place and a time in one press would be the wrong
 * shape for that decision.
 *
 * Called through `runAction('session_visibility', …)`, so a thrown request comes
 * back as a refusal (issue #433). No analytics event: there is none defined for
 * this in the catalogue, and T39 was not to add one (see the T39 plan entry).
 */
export async function makeSessionPrivateAction(input: {
  sessionId: string;
}): Promise<MakePrivateResult> {
  const session = await currentRider();
  if (!session) return { ok: false, message: 'Sign in to change your sessions.' };
  if (!isRecordId(input.sessionId)) {
    return { ok: false, message: 'That session is not there any more.' };
  }

  try {
    await setSessionVisibility(session.client, input.sessionId, 'private');
  } catch (error) {
    if (isNotFound(error)) return { ok: false, message: 'That session is not there any more.' };
    return {
      ok: false,
      message: refusalMessage(error) ?? 'That did not save. Try again in a moment.',
    };
  }

  revalidatePath(sessionHref(input.sessionId));
  revalidatePath(SESSIONS_PATH);
  return { ok: true };
}
