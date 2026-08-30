import {
  DEFAULT_TIMEZONE,
  SPORTS,
  computeStats,
  currentWeeklyStreak,
  sportsOf,
  stickerCondition,
  weeklyStreakLabel,
  type SportId,
  type Sticker,
} from '@landit/core';
import {
  listRiderStickers,
  listStickers,
  listTrickPrereqs,
  listTricks,
  riderSnapshot,
  tricksFromRecords,
} from '@landit/db';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { shortDate } from '@/lib/dates';
import { ROUTES } from '@/lib/routes';
import { currentRider } from '@/lib/session';

import { StickerWall } from './StickerWall';
import type { StickerView, StickerWallView, WallTabView } from './view';

export const metadata: Metadata = {
  title: 'Stickers · Land The Trick',
  description: 'Every sticker you have earned, and every one still to go.',
};

/**
 * The sticker wall (`StickerWall` in `landit-screens-b.jsx`, screenshot 14).
 *
 * **Earned means the server said so.** The wall reads `rider_stickers`, not the
 * client-side evaluation in `@landit/core`. Those rules exist for instant UI
 * feedback (plan §3) and the award hook is the authority: it re-evaluates every
 * rule against stats it recomputes from the database on each `trick_progress`,
 * `clips`, `challenge_log` and `crew_members` write, and it is the only thing
 * that can create the row — `createRule` is `null`. A wall drawn from the
 * client's opinion would show a sticker the rider does not hold, which in a
 * product whose §1 says achievements are never for sale is the whole game.
 *
 * A server component over a client one, for the reason `view.ts` gives: the
 * tabs and the modal are client state, so every string would otherwise be
 * produced twice and any of them could differ (LESSONS §3a).
 */
export default async function StickersPage() {
  const session = await currentRider();
  if (!session) redirect(ROUTES.signIn);
  if (!session.rider.onboarded) redirect(ROUTES.onboarding);

  const { client, rider } = session;
  const timezone = rider.timezone || DEFAULT_TIMEZONE;

  const [stickerRecords, earnedRecords, trickRecords, prereqRecords, snapshot] = await Promise.all([
    listStickers(client),
    listRiderStickers(client, rider.id),
    listTricks(client),
    listTrickPrereqs(client),
    riderSnapshot(client, rider.id),
  ]);

  const tricks = tricksFromRecords(trickRecords, prereqRecords);
  const sports = sportsOf(snapshot);
  const landed = computeStats(snapshot, null, { tricks }).landed;

  const weeks = currentWeeklyStreak(
    {
      streak: rider.streak ?? 0,
      lastQualifyingWeek: rider.last_qualifying_week || null,
      weekStart: rider.week_start || null,
      ridesThisWeek: rider.rides_this_week ?? 0,
      lastRide: rider.last_ride || null,
    },
    { timezone },
  );

  const name = (rider.name || 'Rider').split(' ')[0] || 'Rider';
  // "3 weeks", never "3 days". The unit is `weeklyStreakLabel`'s to decide, so
  // the share card cannot go stale the way the sticker names did (issue #10).
  const shareMeta = `${name} · ${landed} tricks landed · ${weeklyStreakLabel(weeks)}`;

  /* --------------------------------------------------- earned, per record -- */

  const earnedByStickerId = new Map(earnedRecords.map((row) => [row.sticker, row]));

  const toView = (record: (typeof stickerRecords)[number]): StickerView => {
    const held = earnedByStickerId.get(record.id);
    const sport = (record.sport || null) as SportId | null;
    const look = sport ? SPORTS[sport] : null;

    // `stickerCondition` is `@landit/core`'s, so the threshold shown is the one
    // on the record staff can edit rather than a number written into a screen.
    const asSticker: Sticker = {
      id: record.slug,
      name: record.name,
      sport,
      hue: record.hue,
      ico: record.ico,
      cond: record.cond,
      ...(record.n ? { n: record.n } : {}),
      isLive: record.is_live,
    };
    const condition = stickerCondition(asSticker);

    return {
      slug: record.slug,
      name: record.name,
      hue: record.hue,
      ...(record.ico ? { icon: record.ico } : {}),
      ...(record.img ? { img: record.img } : {}),
      ...(record.stars ? { stars: record.stars } : {}),
      ...(record.rarity ? { rarity: record.rarity } : {}),
      sport,
      sportLabel: look ? look.label : null,
      sportColor: look ? look.color : null,
      sportIcon: look ? look.icon : null,
      condition,
      earned: Boolean(held),
      earnedLabel: held?.earned_at ? `Earned ${shortDate(held.earned_at, timezone)}` : null,
      unannounced: Boolean(held && !held.seen_at),
      riderStickerId: held ? held.id : null,
      caption: `${record.name} sticker earned on Land The Trick. ${condition}.`,
      shareHeadline: `Earned ${record.name}`,
    };
  };

  const views = stickerRecords.map(toView);

  /* ------------------------------------------------------------- per tab -- */

  const bySport: Record<string, readonly StickerView[]> = {};
  const eyebrowBySport: Record<string, string> = {};
  const tabs: WallTabView[] = [];

  for (const sport of sports) {
    // Shared stickers sit on every wall; a sport sticker only on its own. The
    // prototype's rule, kept exactly.
    const wall = views.filter((s) => !s.sport || s.sport === sport);
    bySport[sport] = wall;
    eyebrowBySport[sport] =
      sports.length > 1 ? `Sticker wall · ${SPORTS[sport].label} and shared` : 'Sticker wall';
    tabs.push({
      sport,
      label: SPORTS[sport].label,
      color: SPORTS[sport].color,
      icon: SPORTS[sport].icon,
      earnedLabel: `${wall.filter((s) => s.earned).length} earned`,
    });
  }

  const view: StickerWallView = {
    tabs,
    bySport,
    eyebrowBySport,
    shareMeta,
    dateLabel: shortDate(new Date(), timezone).replace(/ \d{4}$/, ''),
  };

  return <StickerWall view={view} />;
}
