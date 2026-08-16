'use server';

import { setInsightsOptIn } from '@landit/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { ROUTES } from '@/lib/routes';
import { currentRider } from '@/lib/session';

/**
 * Switching progress insights on and off.
 *
 * The insights panel is profiling (plan §6.4, standard 12), so this is a
 * consent, not a setting — which is why it has its own action rather than
 * riding along in a profile form, and why the whole thing works without
 * JavaScript: it is a form POST, and the answer is stored on the rider's
 * record.
 *
 * The action does not decide whether the rider may switch it on. It writes with
 * the rider's own token and the hook refuses an unentitled write with a 403
 * (plan §3 — the client is never the enforcement). A refusal here is reported
 * as a refusal rather than swallowed.
 */

export interface InsightsFormState {
  readonly error?: string;
}

export async function setInsightsAction(
  optedIn: boolean,
  _state: InsightsFormState | undefined,
  _form: FormData,
): Promise<InsightsFormState> {
  const session = await currentRider();
  if (!session) redirect(ROUTES.signIn);

  try {
    await setInsightsOptIn(session.client, session.rider.id, optedIn);
    revalidatePath(ROUTES.progress);
    return {};
  } catch (error) {
    const message = (error as { response?: { message?: string } })?.response?.message;
    return {
      error:
        message ||
        (optedIn
          ? 'We could not turn insights on just now. Try again in a moment.'
          : 'We could not turn insights off just now. Try again in a moment.'),
    };
  }
}
