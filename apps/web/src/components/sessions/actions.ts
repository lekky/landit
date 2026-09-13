'use server';

import { deleteSession, isNotFound, refusalMessage } from '@landit/db';
import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/lib/routes';
import { isRecordId, SESSIONS_PATH } from '@/lib/sessionRoutes';
import { currentRider } from '@/lib/session';

/**
 * The session writes shared by more than one screen (T36). The list, the detail
 * page and edit mode all delete; nothing else here yet.
 */

export type DeleteSessionResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

/**
 * Delete one session, **with the rider's own client**.
 *
 * The collection's delete rule is what makes it theirs to delete — an id that
 * belongs to somebody else 404s, and is reported the same as one that never
 * existed. The trick entries go with it; **the stages they moved stay**
 * (`deleteSession` in `@landit/db`, and the hook never writes a lower stage).
 *
 * Returns `{ ok }` rather than throwing, the shape every action here uses, and
 * is meant to be called through `runAction('session_delete', …)` so a thrown
 * request comes back as a refusal too (issue #433). `session_deleted` is fired
 * by the caller on `ok: true` — analytics runs in the browser.
 */
export async function deleteSessionAction(input: {
  sessionId: string;
}): Promise<DeleteSessionResult> {
  const session = await currentRider();
  if (!session) return { ok: false, message: 'Sign in to change your sessions.' };
  if (!isRecordId(input.sessionId)) {
    return { ok: false, message: 'That session is not there any more.' };
  }

  try {
    await deleteSession(session.client, input.sessionId);
  } catch (error) {
    if (isNotFound(error)) return { ok: false, message: 'That session is not there any more.' };
    return {
      ok: false,
      message: refusalMessage(error) ?? 'That session did not delete. Try again in a moment.',
    };
  }

  revalidatePath(SESSIONS_PATH);
  revalidatePath(ROUTES.progress);
  return { ok: true };
}
