'use server';

import { approveConsent, createServerClient, revokeConsent } from '@landit/db';

/**
 * The guardian's decision.
 *
 * Anonymous on purpose: a parent has no Land The Trick account and is never asked to
 * make one (plan §6.2). Their authority is the token in their email, and the
 * server is what checks it — these actions carry no privileges of their own and
 * hold no superuser client.
 *
 * They are also **actions, not page loads**. The link in the email opens a page
 * that asks; this runs when the guardian presses the button. A link that acted
 * on its own would be actioned by every mail scanner and link-preview bot that
 * touches the inbox, which for the approval link means a child's account
 * approved by software rather than by a parent.
 */

export interface ConsentActionState {
  readonly done?: 'granted' | 'revoked';
  readonly riderName?: string;
  readonly error?: string;
}

function message(error: unknown, fallback: string): string {
  const text = (error as { response?: { message?: string } })?.response?.message;
  return typeof text === 'string' && text ? text : fallback;
}

export async function decideConsentAction(
  _state: ConsentActionState | undefined,
  form: FormData,
): Promise<ConsentActionState> {
  const token = String(form.get('token') ?? '').trim();
  const action = String(form.get('action') ?? '');

  if (!token) return { error: 'That link is not complete.' };

  const client = createServerClient();
  try {
    if (action === 'approve') {
      const result = await approveConsent(client, token);
      return { done: 'granted', riderName: result.rider_name };
    }
    const result = await revokeConsent(client, token);
    return { done: 'revoked', riderName: result.rider_name };
  } catch (error) {
    return { error: message(error, 'That link is not valid. Ask the rider to send a fresh one.') };
  }
}
