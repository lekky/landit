'use server';

import { isForbidden, listChallenges, logChallengeEntry } from '@landit/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { ROUTES } from '@/lib/routes';
import { currentRider } from '@/lib/session';

/**
 * Logging one entry against a challenge.
 *
 * **The gate is not here.** `pocketbase/hooks/40_challenges.pb.js` refuses a
 * write outside the challenge's window on every path, including a superuser
 * one, and `pocketbase/tests/challenge-log-window.test.ts` proves it over HTTP.
 * This action does not re-check the dates: a second, weaker copy of a rule is
 * worse than no copy, because it is the one people start trusting (plan §3).
 * What it does is take the server's 403 and turn it into a sentence.
 *
 * The action takes a **slug**, not a record id, for the same reason every other
 * screen does: slugs survive a reseed and a record id in a form value is a
 * record id in somebody's network tab.
 */

export interface LogChallengeState {
  readonly logged?: boolean;
  readonly error?: string;
}

export async function logChallengeAction(slug: string): Promise<LogChallengeState> {
  const session = await currentRider();
  if (!session) redirect(ROUTES.signIn);

  const { client, rider } = session;

  const challenges = await listChallenges(client);
  const challenge = challenges.find((c) => c.slug === slug);
  if (!challenge) {
    return { error: 'We could not find that challenge. Reload the page and try again.' };
  }

  try {
    await logChallengeEntry(client, { userId: rider.id, challengeId: challenge.id });
  } catch (error) {
    if (isForbidden(error)) {
      // The window closed between the page rendering and the tap — a rider
      // finishing something at one minute to midnight, most likely. Say what
      // happened rather than blaming them.
      return { error: `“${challenge.title}” is not running right now.` };
    }
    return { error: 'We could not log that just now. Try again in a moment.' };
  }

  revalidatePath(ROUTES.challenge);
  revalidatePath(ROUTES.dashboard);
  return { logged: true };
}
