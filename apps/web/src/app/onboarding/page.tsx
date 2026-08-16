import type { CategoryId, Difficulty, SportId } from '@landit/core';
import { listTricks } from '@landit/db';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ROUTES } from '@/lib/routes';
import { currentRider } from '@/lib/session';

import { Onboarding, type OnboardingTrick } from './Onboarding';

export const metadata: Metadata = {
  title: 'Getting set up · Land It',
  description: 'Four steps and you are riding.',
};

/**
 * Onboarding runs outside the app shell: there is no nav to offer somebody who
 * has not chosen a sport yet, which is also what the prototype does.
 *
 * The tricks come down with the page because a pick is written as
 * `trick_progress`, which needs a record id — the canonical data in
 * `@landit/core` names tricks by slug, and a slug cannot be saved.
 */
export default async function OnboardingPage() {
  const session = await currentRider();
  if (!session) redirect(ROUTES.signIn);
  if (session.rider.onboarded) redirect(ROUTES.account);

  let tricks: OnboardingTrick[] = [];
  try {
    const rows = await listTricks(session.client);
    tricks = rows.map((row) => ({
      id: row.id,
      name: row.name,
      sport: row.sport as SportId,
      cat: row.cat as CategoryId,
      diff: row.diff as Difficulty,
    }));
  } catch {
    // An unseeded or unreachable library is not a reason to block a rider from
    // finishing: step 4 shows its empty state and everything else still saves.
    tricks = [];
  }

  return <Onboarding name={session.rider.name || 'rider'} tricks={tricks} />;
}
