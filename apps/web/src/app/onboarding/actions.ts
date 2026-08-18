'use server';

import {
  CUSTOM_GOAL_ID,
  SPORT_IDS,
  handleCandidates,
  profileChoiceProblem,
  type LevelId,
  type SportId,
  type StageId,
  type StanceId,
} from '@landit/core';
import { claimHandle, setTrickStage, updateProfile } from '@landit/db';
import { redirect } from 'next/navigation';

import { ROUTES } from '@/lib/routes';
import { currentRider } from '@/lib/session';

/**
 * Finishing onboarding.
 *
 * Everything here is written with the **rider's own** client, so every API rule
 * applies exactly as it would from the browser. Nothing in onboarding needs more
 * than a rider's own authority, and reaching for the superuser client to save a
 * profile would quietly bypass the guard hook that makes `plan`, `role`,
 * `consent_state` and the weekly streak unwritable.
 *
 * Which is also why the streak is absent: `streak`, `last_ride`, `week_start`,
 * `rides_this_week` and `last_qualifying_week` are server-owned (issue #8), and
 * a new rider simply has none. "I rode today" is a server route, and it is T8's.
 */

export interface OnboardingInput {
  readonly sports: readonly SportId[];
  readonly stance: StanceId | null;
  readonly level: LevelId | null;
  readonly goal: string | null;
  readonly goalCustom: string;
  readonly avatarKey: string | null;
  /** Trick record id to the stage the rider tapped. */
  readonly picks: Readonly<Record<string, StageId>>;
  readonly timezone: string;
}

export interface OnboardingResult {
  readonly error?: string;
}

export async function finishOnboarding(input: OnboardingInput): Promise<OnboardingResult> {
  const session = await currentRider();
  if (!session) redirect(ROUTES.signIn);

  const sports = input.sports.filter((sport): sport is SportId =>
    (SPORT_IDS as readonly string[]).includes(sport),
  );
  // The same check the account editor runs (T23), and deliberately the same
  // function: two copies of "pick at least one sport" drift the first time one
  // of the rules moves.
  const problem = profileChoiceProblem({
    sports,
    level: input.level,
    goal: input.goal,
    goalCustom: input.goalCustom,
    stance: input.stance,
    avatarKey: input.avatarKey,
  });
  if (problem) return { error: problem };

  const { client, rider } = session;

  try {
    await updateProfile(client, rider.id, {
      sports: [...sports],
      stance: input.stance ?? undefined,
      // Both are non-null by the check above — `profileChoiceProblem` refuses a
      // missing or unknown level and goal — which its return type cannot say.
      level: input.level as LevelId,
      goal: input.goal as string,
      goal_custom: input.goal === CUSTOM_GOAL_ID ? input.goalCustom.trim() : '',
      avatar_key: input.avatarKey ?? '',
      ...(input.timezone ? { timezone: input.timezone } : {}),
      onboarded: true,
    });
  } catch {
    return { error: 'We could not save that. Try again in a moment.' };
  }

  // A handle nobody has yet. Uniqueness is the index's answer, not something a
  // rider can be asked — the privacy rules mean they cannot see who holds what.
  if (!rider.handle) {
    await claimHandle(client, rider.id, handleCandidates(rider.name));
  }

  // Best effort, and deliberately after the profile: a rider who ticked a trick
  // that will not save should still arrive onboarded rather than be sent round
  // the four steps again.
  for (const [trickId, stage] of Object.entries(input.picks)) {
    try {
      await setTrickStage(client, { userId: rider.id, trickId, stage });
    } catch {
      continue;
    }
  }

  // Straight to the dashboard: the four steps just filled it in (T8).
  redirect(ROUTES.dashboard);
}
