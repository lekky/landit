'use server';

import {
  CUSTOM_GOAL_ID,
  PRIVACY,
  SESSION_VISIBILITY_IDS,
  SPORT_IDS,
  profileChoiceProblem,
  type LevelId,
  type PrivacyId,
  type SessionVisibilityId,
  type SportId,
  type StanceId,
} from '@landit/core';
import { requestGuardianConsent, setSessionVisibilityDefault, updateProfile } from '@landit/db';
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

/* ------------------------------------------------ who sees new sessions -- */

export type SessionVisibilityDefaultResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

/**
 * Change who sees this rider's **new** sessions (T40; D2, Rachid, 2026-09-13,
 * in chat). It pre-sets the picker on the session form and nothing else: a
 * session already logged keeps the visibility it was saved with.
 *
 * Nothing here grants anything, for the reason `setPrivacyAction` gives. The
 * write is the rider's own client, so `users.updateRule` limits it to their own
 * record, and the session read rules still cap every session at the profile's
 * own visibility — choosing Public here cannot make a private profile's
 * sessions public.
 *
 * Returns `{ ok }` rather than throwing, and is called through
 * `runAction('session_visibility_default', …)` so a thrown request comes back
 * as a refusal too (issue #433).
 */
export async function setSessionVisibilityDefaultAction(input: {
  visibility: string;
}): Promise<SessionVisibilityDefaultResult> {
  const session = await currentRider();
  if (!session) return { ok: false, message: 'Sign in to change your settings.' };

  if (!(SESSION_VISIBILITY_IDS as readonly string[]).includes(input.visibility)) {
    return { ok: false, message: 'Pick one of the three.' };
  }

  try {
    await setSessionVisibilityDefault(
      session.client,
      session.rider.id,
      input.visibility as SessionVisibilityId,
    );
  } catch {
    return { ok: false, message: 'We could not save that just now. Try again in a moment.' };
  }

  revalidatePath(ROUTES.account);
  return { ok: true };
}

/* -------------------------------------------------------------- profile -- */

export interface ProfileFormState {
  readonly error?: string;
  readonly saved?: boolean;
}

/**
 * Change what you ride, where you are at, the goal, your stance and your
 * picture (T23).
 *
 * The gap this closes: onboarding asked all five questions once and no screen
 * ever asked again, so a rider who took up BMX in the meantime, or picked a
 * level on their first evening and outgrew it, had a profile they could read
 * and not touch — the same defect the privacy control above was built to fix,
 * across five more fields (issue #96).
 *
 * Every value is checked against the canonical list by `profileChoiceProblem`
 * in `@landit/core`, which is the same function onboarding calls. Nothing here
 * grants anything: the write goes through the rider's own client, so the
 * `users` update rule decides it, and the guard hook still refuses `plan`,
 * `role`, `consent_state` and the streak whatever this form posts.
 *
 * Turning a sport off is not a delete. `sports` decides which libraries,
 * stickers and challenges a rider is *shown*; their `trick_progress` rows are
 * untouched and come straight back if they turn it on again.
 */
export async function saveProfileAction(
  _state: ProfileFormState | undefined,
  form: FormData,
): Promise<ProfileFormState> {
  const session = await currentRider();
  if (!session) redirect(ROUTES.signIn);

  const sports = form.getAll('sports').map(String);
  const level = String(form.get('level') ?? '');
  const goal = String(form.get('goal') ?? '');
  const goalCustom = String(form.get('goal_custom') ?? '');
  const stance = String(form.get('stance') ?? '');
  const avatarKey = String(form.get('avatar_key') ?? '');

  const problem = profileChoiceProblem({ sports, level, goal, goalCustom, stance, avatarKey });
  if (problem) return { error: problem };

  try {
    await updateProfile(session.client, session.rider.id, {
      sports: sports.filter((sport): sport is SportId =>
        (SPORT_IDS as readonly string[]).includes(sport),
      ),
      level: level as LevelId,
      goal,
      // A written goal is only kept while it is the goal. Leaving the text
      // behind would put it back on the dashboard the next time a rider
      // returned to "Something else" and saved without retyping.
      goal_custom: goal === CUSTOM_GOAL_ID ? goalCustom.trim() : '',
      /*
       * "Not saying" is a real answer, and it is stored as the empty string —
       * what the field already held for every rider who skipped the question at
       * onboarding. The generated union cannot express that value (issue #134),
       * so the assertion is the gap in the types rather than a new value being
       * smuggled past them.
       */
      stance: stance as StanceId,
      avatar_key: avatarKey,
    });
  } catch {
    return { error: 'We could not save that just now. Try again in a moment.' };
  }

  revalidatePath(ROUTES.account);
  return { saved: true };
}
