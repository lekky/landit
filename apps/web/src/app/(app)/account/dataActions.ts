'use server';

import { deleteAccount, refusalMessage } from '@landit/db';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ROUTES } from '@/lib/routes';
import { SESSION_COOKIE, currentRider } from '@/lib/session';

/**
 * Ending an account (T18; plan §6.5).
 *
 * **A separate file from `actions.ts`** so the two panels this screen has grown
 * are not one rebase conflict, and because these are a different kind of thing:
 * `actions.ts` edits a profile, this ends one.
 *
 * **Nothing here decides anything.** `POST /api/landit/account/delete` re-checks
 * the password on the server and does the erasure; `pocketbase/hooks/lib/
 * erasure.js` is what "deletion" means (anonymise-and-retain — owner decision,
 * Rachid, 2026-08-17, in chat). This action collects two inputs and clears the
 * cookie afterwards, which is tidiness rather than security: the server has
 * already invalidated every token the account held.
 *
 * The export is not here at all. It is a download, so it is a route handler —
 * `apps/web/src/app/api/account/export/route.ts` says why.
 */

export interface DeleteAccountState {
  readonly error?: string;
}

export async function deleteAccountAction(
  _state: DeleteAccountState | undefined,
  form: FormData,
): Promise<DeleteAccountState> {
  const session = await currentRider();
  if (!session) redirect(ROUTES.signIn);

  const password = String(form.get('password') ?? '');
  const confirm = String(form.get('confirm') ?? '').trim();

  if (!password) return { error: 'Type your password to confirm.' };
  if (confirm.toUpperCase() !== 'DELETE') return { error: 'Type DELETE in the box to confirm.' };

  try {
    await deleteAccount(session.client, { password, confirm });
  } catch (error) {
    return {
      error: refusalMessage(error) ?? 'We could not do that just now. Try again in a moment.',
    };
  }

  (await cookies()).delete(SESSION_COOKIE);
  redirect(ROUTES.home);
}
