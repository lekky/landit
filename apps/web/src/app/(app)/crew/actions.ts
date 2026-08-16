'use server';

import {
  crewNameProblem,
  formatInviteCode,
  isValidInviteCode,
  normaliseInviteCode,
} from '@landit/core';
import { createCrew, createCrewInvite, joinCrew, leaveCrew } from '@landit/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { ROUTES, signInHref } from '@/lib/routes';
import { currentRider } from '@/lib/session';

/**
 * The four writes the crew screen makes.
 *
 * None of them decides anything. Creating a crew, minting a code and redeeming
 * one are all refused server-side when they should be — by the collection
 * rules, by `hooks/85_crews.pb.js` and by `POST /api/landit/crews/join` — and
 * what these functions add is the message a rider reads when that happens. A
 * check written here that the server does not also make would be a check a
 * rider could skip by not using this screen (plan §3).
 *
 * There is deliberately **no** action that adds somebody to a crew directly,
 * and no action that searches for one. `crew_members.createRule` is `null` and
 * crews have no discovery surface (plan §6.1); an action here that worked
 * around either would be the stranger-contact surface the whole child-safety
 * position rests on not having.
 */

export interface CrewFormState {
  readonly error?: string;
}

/** PocketBase's own refusal, when it left one worth showing a rider. */
function serverMessage(error: unknown, fallback: string): string {
  const response = (error as { response?: { message?: string; data?: Record<string, unknown> } })
    ?.response;
  const message = response?.message;
  if (typeof message === 'string' && message && !/failed to create record/i.test(message)) {
    return message;
  }
  const data = response?.data ?? {};
  for (const value of Object.values(data)) {
    const inner = (value as { message?: string })?.message;
    if (typeof inner === 'string' && inner) return inner;
  }
  return fallback;
}

export async function createCrewAction(
  _state: CrewFormState | undefined,
  form: FormData,
): Promise<CrewFormState> {
  const session = await currentRider();
  if (!session) redirect(signInHref(ROUTES.crew));

  const name = String(form.get('name') ?? '');
  const problem = crewNameProblem(name);
  if (problem) return { error: problem };

  let crewId: string;
  try {
    const crew = await createCrew(session.client, name);
    crewId = crew.id;
  } catch (error) {
    return { error: serverMessage(error, 'We could not start that crew just now.') };
  }

  revalidatePath(ROUTES.crew);
  redirect(`${ROUTES.crew}?crew=${crewId}`);
}

export async function joinCrewAction(
  _state: CrewFormState | undefined,
  form: FormData,
): Promise<CrewFormState> {
  const raw = String(form.get('code') ?? '');

  const session = await currentRider();
  if (!session) {
    // Sent to sign in, and back to the invite afterwards rather than to the
    // dashboard (issue #66) — the code is in the path, so it survives.
    redirect(
      signInHref(isValidInviteCode(raw) ? `/join/${normaliseInviteCode(raw)}` : ROUTES.crew),
    );
  }

  if (!isValidInviteCode(raw)) {
    return { error: 'That code is not the right shape. They look like ABCDE-FGHJK.' };
  }

  let crewId: string;
  try {
    const result = await joinCrew(session.client, normaliseInviteCode(raw));
    crewId = result.crew;
  } catch (error) {
    return {
      error: serverMessage(error, 'That code did not work. Ask your mate for a fresh one.'),
    };
  }

  revalidatePath(ROUTES.crew);
  redirect(`${ROUTES.crew}?crew=${crewId}`);
}

export interface InviteResult {
  readonly code?: string;
  readonly error?: string;
}

/**
 * Mint an invite code, on the tap that opens the share card.
 *
 * Lazily rather than on page load, because every code minted is a live way into
 * a crew: a page that made one every time it rendered would leave a trail of
 * working codes behind a rider who never sent one.
 */
export async function mintInviteAction(crewId: string): Promise<InviteResult> {
  const session = await currentRider();
  if (!session) return { error: 'Sign in to invite a mate.' };

  try {
    const invite = await createCrewInvite(session.client, crewId);
    return { code: formatInviteCode(invite.code) };
  } catch (error) {
    return { error: serverMessage(error, 'We could not make an invite just now.') };
  }
}

/** Leaving is the rider's own row to delete — it never needs anybody's yes. */
export async function leaveCrewAction(form: FormData): Promise<void> {
  const session = await currentRider();
  if (!session) redirect(signInHref(ROUTES.crew));

  const membershipId = String(form.get('membership') ?? '');
  if (membershipId) {
    try {
      await leaveCrew(session.client, membershipId);
    } catch {
      // A membership that has already gone is the state the rider asked for.
    }
  }

  revalidatePath(ROUTES.crew);
  redirect(ROUTES.crew);
}
