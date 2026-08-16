'use server';

import { requestGuardianConsent } from '@landit/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { ROUTES } from '@/lib/routes';
import { currentRider } from '@/lib/session';

/**
 * Asking a guardian, from the rider's side.
 *
 * All this does is pass the address to `/api/landit/consent/request`, where the
 * server mints the links, stores only their hashes and sends the email. The
 * rider is never handed a token — if this action could see one, the child could
 * approve their own account, and the guarantee would be theatre.
 */

export interface GuardianFormState {
  readonly error?: string;
  readonly sentTo?: string;
  /** Whether the email actually went out. False until SMTP is configured. */
  readonly emailed?: boolean;
}

export async function askGuardianAction(
  _state: GuardianFormState | undefined,
  form: FormData,
): Promise<GuardianFormState> {
  const session = await currentRider();
  if (!session) redirect(ROUTES.signIn);

  const email = String(form.get('guardian_email') ?? '')
    .trim()
    .toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "That email doesn't look right" };
  }

  try {
    const result = await requestGuardianConsent(session.client, email);
    revalidatePath(ROUTES.account);
    return { sentTo: result.guardian_email, emailed: result.emailed };
  } catch (error) {
    const message = (error as { response?: { message?: string } })?.response?.message;
    return { error: message || 'We could not send that just now. Try again in a moment.' };
  }
}
