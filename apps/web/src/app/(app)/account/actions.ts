'use server';

import { PRIVACY, type PrivacyId } from '@landit/core';
import { requestGuardianConsent, updateProfile } from '@landit/db';
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

const PRIVACY_IDS: readonly PrivacyId[] = PRIVACY.map((p) => p.id);

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

/* -------------------------------------------------------------- privacy -- */

export interface PrivacyFormState {
  readonly error?: string;
  readonly saved?: boolean;
}

/**
 * Change who can see this rider's profile (T11).
 *
 * The setting is a *choice*, and until now there was nowhere to make it: T6's
 * account screen showed the value and the T11 profile screen enforces it, but
 * new accounts default to `private` (plan §6.4 standard 7) and a default a
 * rider cannot move is not a default, it is a rule. So the control lands here,
 * beside the rest of the account, rather than on the profile it governs.
 *
 * Nothing here grants anything. `users.updateRule` already limits the write to
 * the rider's own record, and the three-way view rules are what actually decide
 * who reads what (plan §3 guarantee 1) — this only stores which of them applies.
 */
export async function setPrivacyAction(
  _state: PrivacyFormState | undefined,
  form: FormData,
): Promise<PrivacyFormState> {
  const session = await currentRider();
  if (!session) redirect(ROUTES.signIn);

  const choice = String(form.get('privacy') ?? '');
  if (!PRIVACY_IDS.includes(choice as PrivacyId)) {
    return { error: 'Pick one of the three.' };
  }

  try {
    await updateProfile(session.client, session.rider.id, { privacy: choice as PrivacyId });
  } catch {
    return { error: 'We could not save that just now. Try again in a moment.' };
  }

  revalidatePath(ROUTES.account);
  return { saved: true };
}
