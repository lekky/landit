import { isTrickFree, type CategoryId, type Difficulty, type SportId } from '@landit/core';
import { listTricks, tricksFromRecords } from '@landit/db';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ROUTES } from '@/lib/routes';
import { currentRider } from '@/lib/session';

import { Onboarding, type OnboardingTrick } from './Onboarding';

export const metadata: Metadata = {
  title: 'Getting set up · Land The Trick',
  description: 'Five steps and you are riding.',
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
  if (session.rider.onboarded) redirect(ROUTES.dashboard);

  let tricks: OnboardingTrick[] = [];
  try {
    const rows = await listTricks(session.client);
    /*
     * Freeness is resolved here, through the rule, rather than read off the
     * row: `free_override` is nullable and an empty one means "inherit from
     * `diff`", so only `isTrickFree` knows the answer. `tricksFromRecords` keys
     * by slug, which is what the rule shape uses; the record id stays on the
     * row because a pick is written as `trick_progress` and needs one.
     *
     * A row the map somehow misses falls back to paid. Failing closed matches
     * the hook: offering a locked trick costs a rider a pick that vanishes,
     * where withholding a free one costs them a suggestion they can still find
     * in the library.
     */
    const freeBySlug = new Map(tricksFromRecords(rows).map((t) => [t.id, isTrickFree(t)]));
    tricks = rows.map((row) => ({
      id: row.id,
      name: row.name,
      sport: row.sport as SportId,
      cat: row.cat as CategoryId,
      diff: row.diff as Difficulty,
      free: freeBySlug.get(row.slug) ?? false,
    }));
  } catch {
    // An unseeded or unreachable library is not a reason to block a rider from
    // finishing: step 4 shows its empty state and everything else still saves.
    tricks = [];
  }

  return <Onboarding name={session.rider.name || 'rider'} tricks={tricks} />;
}
