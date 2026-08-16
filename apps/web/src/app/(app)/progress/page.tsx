import { planIncludesInsights, sportsOf, type PlanId, type SportId } from '@landit/core';
import {
  listTrickLog,
  listTrickPrereqs,
  listTrickProgress,
  listTricks,
  trickLogEntries,
  trickProgressById,
  tricksFromRecords,
} from '@landit/db';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ProgressScreen } from '@/components/progress/ProgressScreen';
import { ROUTES } from '@/lib/routes';
import { currentRider } from '@/lib/session';

import { buildProgressView } from './view';

export const metadata: Metadata = {
  title: 'Progress · Land It',
  description: 'Where you are at: by category, by stage, over time, and the whole skill tree.',
};

/**
 * Progress (plan §7, T9).
 *
 * Everything on this screen is derived from the rider's own rows — their
 * stages, their log — read with *their* token, so the API rules apply exactly
 * as they would in the browser. Nothing here holds a superuser client and
 * nothing here reads another rider.
 *
 * The plan is taken from `users.plan`, which is server-owned: the account guard
 * refuses a client that tries to write it (plan §3). That is what makes the
 * paywall's lock states and the Legend insights gate mean something — they are
 * drawn from an entitlement resolved in our own database, never from something
 * the browser told us about itself (§2.4).
 */
export default async function ProgressPage() {
  const session = await currentRider();
  if (!session) redirect(ROUTES.signIn);
  if (!session.rider.onboarded) redirect(ROUTES.onboarding);

  const { client, rider } = session;
  const plan = rider.plan as PlanId;

  const [trickRows, prereqRows, progressRows, logRows] = await Promise.all([
    listTricks(client),
    listTrickPrereqs(client),
    listTrickProgress(client, rider.id),
    listTrickLog(client, rider.id),
  ]);

  const tricks = tricksFromRecords(trickRows, prereqRows);
  const sports = sportsOf({ sports: rider.sports as SportId[] });

  const views = buildProgressView({
    byId: trickProgressById(progressRows, trickRows),
    log: trickLogEntries(logRows, trickRows),
    tricks,
    sports,
    plan,
    optedIntoInsights: rider.insights_opt_in === true,
    timezone: rider.timezone || undefined,
  });

  return (
    <ProgressScreen
      views={views}
      plan={plan}
      entitledToInsights={planIncludesInsights(plan)}
      optedIntoInsights={rider.insights_opt_in === true}
    />
  );
}
