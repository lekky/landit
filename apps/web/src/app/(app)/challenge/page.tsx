import {
  DEFAULT_TIMEZONE,
  planUnlocksPaidTricks,
  sportsOf,
  type PlanId,
  type SportId,
  type Sticker,
} from '@landit/core';
import {
  challengesFromRecords,
  listChallenges,
  listRiderStickers,
  listStickers,
  riderSnapshot,
} from '@landit/db';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ROUTES } from '@/lib/routes';
import { currentRider } from '@/lib/session';

import { ChallengeScreen } from './ChallengeScreen';
import { buildChallengeView } from './view';

export const metadata: Metadata = {
  title: 'Challenge · Land The Trick',
  description: 'This week’s challenge for every sport you ride, and how the last few went.',
};

/**
 * The challenge screen (`landit-screens-b.jsx`, screenshot 17).
 *
 * A server component that reads and computes over a client component that
 * renders — the sport tabs are per-device client state, and every date label on
 * this screen would otherwise be produced twice, once by Node and once by
 * Chromium (`view.ts`).
 *
 * Every read goes through the rider's own client, so the API rules apply
 * exactly as they would in the browser (plan §3). The plan comes from
 * `users.plan`, which the account guard refuses to let a client write.
 */
export default async function ChallengePage() {
  const session = await currentRider();
  if (!session) redirect(ROUTES.signIn);
  if (!session.rider.onboarded) redirect(ROUTES.onboarding);

  const { client, rider } = session;
  const plan = (rider.plan ?? 'rookie') as PlanId;
  const timezone = rider.timezone || DEFAULT_TIMEZONE;

  const [challengeRecords, snapshot, stickerRecords, earnedRecords] = await Promise.all([
    listChallenges(client),
    riderSnapshot(client, rider.id),
    listStickers(client),
    listRiderStickers(client, rider.id),
  ]);

  const stickerById = new Map(stickerRecords.map((s) => [s.id, s]));
  const stickers: Sticker[] = stickerRecords.map((s) => ({
    id: s.slug,
    name: s.name,
    sport: (s.sport || null) as SportId | null,
    hue: s.hue,
    ico: s.ico,
    cond: s.cond,
    ...(s.n ? { n: s.n } : {}),
    isLive: s.is_live,
  }));

  const views = buildChallengeView({
    sports: sportsOf({ sports: rider.sports as SportId[] }),
    challenges: challengesFromRecords(challengeRecords),
    logged: snapshot.challengeLogged ?? {},
    plan,
    // The same signal T9's printable sheets use, read off the `plans` record
    // rather than compared against a plan id (plan §2.4). Challenge history is
    // a capacity limit, not an achievement gate: nothing here decides whether a
    // rider may *log*, and the Challenger sticker is earned on the free plan
    // exactly as it is on a paid one.
    keepsHistory: planUnlocksPaidTricks(plan),
    clock: { timezone },
    stickers,
    earnedStickerIds: earnedRecords
      .map((row) => stickerById.get(row.sticker)?.slug)
      .filter((slug): slug is string => Boolean(slug)),
  });

  return <ChallengeScreen views={views} />;
}
