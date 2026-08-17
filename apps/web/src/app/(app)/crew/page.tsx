import {
  SPORT_IDS,
  crewActivityLine,
  isConsentLimited,
  type ConsentState,
  type SportId,
} from '@landit/core';
import {
  getCrewBoard,
  getCrewFeed,
  listCrewMemberships,
  listCrews,
  type CrewFeedItem,
} from '@landit/db';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { relativeTime } from '@/lib/dates';
import { ROUTES, signInHref } from '@/lib/routes';
import { SPORT_LOOKS, sentenceCase, sportsList } from '@/lib/sports';
import { currentRider } from '@/lib/session';

import { CrewScreen } from './CrewScreen';
import type {
  BoardRowView,
  CrewSummaryView,
  CrewView,
  FeedItemView,
  SelectedCrewView,
} from './view';

export const metadata: Metadata = {
  title: 'Crew · Land The Trick',
  description: 'Your crew board and what your mates have been landing.',
};

/**
 * The crew screen (`landit-screens-b.jsx`, screenshot 15).
 *
 * The prototype has one demo crew you "join" with a button. This is the real
 * thing, and three of plan §6.1's load-bearing facts are visible in what it
 * does *not* have:
 *
 * - **No discovery.** There is no crew search, no directory and no "crews near
 *   you". `listCrews` takes no filter because `crews.listRule` already answers
 *   with exactly the crews the caller is in — a rider cannot see that any other
 *   crew exists, let alone find one.
 * - **No way in but a code.** The two things a rider without a crew can do are
 *   start one and redeem an invite. `crew_members.createRule` is `null`, so
 *   there is no third option to leave out.
 * - **No messaging.** The right-hand panel is the activity feed, and every
 *   sentence in it is written by `crewActivityLine` in `@landit/core` from a
 *   stage or a sticker. There is nowhere for a rider to put a word of their own.
 *
 * The board is read through `GET /api/landit/crew-board/{crew}` and never
 * through `users` — that route is what lets a private rider appear by name and
 * score (guarantee 1) without their record being readable. The feed is a second
 * route, and it deliberately does *not* inherit that exception: see its comment
 * in `hooks/85_crews.pb.js`.
 */
export default async function CrewPage({
  searchParams,
}: {
  searchParams: Promise<{ crew?: string }>;
}) {
  const session = await currentRider();
  if (!session) redirect(signInHref(ROUTES.crew));
  if (!session.rider.onboarded) redirect(ROUTES.onboarding);

  const { client, rider } = session;
  const consentLimited = isConsentLimited(rider.consent_state as ConsentState);

  const sportsLine = sentenceCase(
    sportsList(rider.sports?.length ? (rider.sports as SportId[]) : SPORT_IDS),
  );

  const base = {
    firstName: (rider.name || 'Rider').split(' ')[0] || 'Rider',
    handle: rider.handle || null,
    sportsLine,
    consentLimited,
  };

  // A rider held behind the guardian gate is in no crew and cannot be put in
  // one — the rules and the hooks say so (guarantee 4), and the screen says so
  // rather than offering buttons that would 403.
  if (consentLimited) {
    return <CrewScreen view={{ ...base, crews: [], selected: null }} />;
  }

  const [crews, memberships] = await Promise.all([
    listCrews(client),
    listCrewMemberships(client, rider.id),
  ]);

  const membershipOf = new Map(memberships.map((m) => [m.crew, m]));
  const summaries: CrewSummaryView[] = crews.map((crew) => ({
    id: crew.id,
    name: crew.name,
    membershipId: membershipOf.get(crew.id)?.id ?? null,
    isOwner: crew.owner === rider.id,
  }));

  const asked = (await searchParams).crew;
  const chosen = summaries.find((c) => c.id === asked) ?? summaries[0] ?? null;

  const view: CrewView = {
    ...base,
    crews: summaries,
    selected: chosen ? await loadCrew(client, rider.id, chosen) : null,
  };

  return <CrewScreen view={view} />;
}

type Client = Parameters<typeof getCrewBoard>[0];

async function loadCrew(
  client: Client,
  riderId: string,
  crew: CrewSummaryView,
): Promise<SelectedCrewView> {
  const now = Date.now();

  const [boardResult, feedResult] = await Promise.allSettled([
    getCrewBoard(client, crew.id),
    getCrewFeed(client, crew.id),
  ]);

  if (boardResult.status === 'rejected') {
    return {
      ...crew,
      memberCount: 0,
      board: [],
      feed: [],
      problem: 'We could not load this crew just now. Try again in a moment.',
    };
  }

  const board: BoardRowView[] = boardResult.value.riders.map((row) => ({
    id: row.id,
    name: (row.name || 'Rider').trim(),
    handle: row.handle,
    avatarKey: row.avatar_key || null,
    // Filtered rather than defaulted: a rider who has picked no sport shows no
    // chip, where `sportsOf` would put a scooter beside their name for them.
    sports: (row.sports ?? []).filter((s) => SPORT_LOOKS[s]).map((s) => SPORT_LOOKS[s]),
    streak: row.streak ?? 0,
    landed: row.landed ?? 0,
    isMe: row.id === riderId,
    isOwner: row.role === 'owner',
    flair: row.flair === true,
  }));

  const feed: FeedItemView[] =
    feedResult.status === 'fulfilled'
      ? feedResult.value.items.map((item) => toFeedItem(item, now))
      : [];

  return {
    ...crew,
    memberCount: board.length,
    board,
    feed,
    problem: null,
  };
}

/**
 * One feed row, as words.
 *
 * The sentence comes from `@landit/core` rather than being written here, so the
 * whole vocabulary of the feed is in one unit-tested place — which is what makes
 * "there is no free text in the feed" checkable rather than merely intended.
 */
function toFeedItem(item: CrewFeedItem, now: number): FeedItemView {
  const sport = item.sport && SPORT_LOOKS[item.sport] ? SPORT_LOOKS[item.sport] : null;
  return {
    id: item.id,
    name: (item.rider.name || 'Rider').trim(),
    handle: item.rider.handle,
    avatarKey: item.rider.avatar_key || null,
    line: crewActivityLine({
      id: item.id,
      kind: item.kind,
      riderId: item.rider.id,
      riderName: item.rider.name,
      handle: item.rider.handle,
      at: item.at,
      ...(item.trick ? { trickName: item.trick } : {}),
      ...(item.stage ? { stage: item.stage } : {}),
      ...(item.sticker ? { stickerName: item.sticker } : {}),
    }),
    when: relativeTime(item.at, now),
    sport,
    hue: item.hue || null,
  };
}
