import {
  CATS,
  DEFAULT_TIMEZONE,
  SPORTS,
  STAGE,
  TIERS_LABEL,
  categoryLabel,
  challengeProgress,
  challengeRangeLabel,
  challengeState,
  computeStats,
  currentWeeklyStreak,
  formatDayLong,
  goalLabel,
  isTrickLocked,
  liveChallenge,
  riderToday,
  rodeToday,
  sportsOf,
  suggestedNextTricks,
  trickById,
  tricksFor,
  weeklyEncouragement,
  weeklyProgress,
  weeklyProgressLabel,
  weeklyStreakLabel,
  type Challenge,
  type PlanId,
  type SportId,
  type StageId,
  type Trick,
} from '@landit/core';
import {
  challengesFromRecords,
  getCrewBoard,
  listAnnouncementDismissals,
  listAnnouncements,
  listChallenges,
  listCrewMemberships,
  listRiderStickers,
  listStickers,
  listTrickPrereqs,
  listTricks,
  riderSnapshot,
  tricksFromRecords,
  type AnnouncementsRecord,
} from '@landit/db';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ROUTES } from '@/lib/routes';
import { SPORT_LOOKS } from '@/lib/sports';
import { currentRider } from '@/lib/session';

import { HomeScreen } from './HomeScreen';
import type {
  AnnouncementView,
  ChallengeView,
  CrewRiderView,
  HomeView,
  SportView,
  StickerView,
  TrickCardView,
} from './view';

export const metadata: Metadata = {
  title: 'Home · Land The Trick',
  description: 'Your riding week, your streak and what you are working on.',
};

/**
 * The dashboard (`landit-screens-a.jsx`, screenshot 06).
 *
 * A server component that reads and computes, over a client component that
 * renders — because the sport tabs are per-device client state and every string
 * on the page would otherwise be produced twice, once by Node and once by
 * Chromium. See `view.ts`.
 *
 * Nothing here decides what the rider may see. Every read goes through the
 * rider's own client, so the API rules apply exactly as they would in the
 * browser (plan §3).
 */
export default async function HomePage() {
  const session = await currentRider();
  if (!session) redirect(ROUTES.signIn);
  if (!session.rider.onboarded) redirect(ROUTES.onboarding);

  const { client, rider } = session;
  const timezone = rider.timezone || DEFAULT_TIMEZONE;
  const clock = { timezone };
  const today = riderToday(clock);

  // The library comes from the database, not from `@landit/core`'s canonical
  // constants. They agree today because the seed is built from those constants,
  // but staff can edit tricks (T17) and a hidden or renamed trick has to
  // disappear from Home the moment it disappears from `/library` — otherwise
  // Home offers a card whose page 404s, which is exactly what CI caught.
  const [
    trickRecords,
    prereqRecords,
    snapshot,
    stickerRecords,
    earnedRecords,
    challengeRecords,
    notices,
    dismissals,
    crews,
  ] = await Promise.all([
    listTricks(client),
    listTrickPrereqs(client),
    riderSnapshot(client, rider.id),
    listStickers(client),
    listRiderStickers(client, rider.id),
    listChallenges(client),
    listAnnouncements(client),
    listAnnouncementDismissals(client, rider.id),
    listCrewMemberships(client, rider.id),
  ]);

  const tricks = tricksFromRecords(trickRecords, prereqRecords);

  // Slug to record id. The rules and this whole view are keyed by slug; a write
  // to `trick_progress` needs the id its relation stores, and this is the only
  // place both are in hand.
  const recordIdBySlug: Record<string, string> = {};
  for (const row of trickRecords) recordIdBySlug[row.slug] = row.id;

  /* ------------------------------------------------------------- streak -- */

  // The five stored fields, as `@landit/core` names them. Empty strings are how
  // PocketBase spells "never", and `null` is how the rule does.
  const streakState = {
    streak: rider.streak ?? 0,
    lastQualifyingWeek: rider.last_qualifying_week || null,
    weekStart: rider.week_start || null,
    ridesThisWeek: rider.rides_this_week ?? 0,
    lastRide: rider.last_ride || null,
  };

  // The stored number is only as fresh as the last write, and nothing writes to
  // a rider who has stopped riding — so it is reconciled on read, never shown raw.
  const weeks = currentWeeklyStreak(streakState, clock);
  const progress = weeklyProgress(streakState, clock);

  /* ------------------------------------------------------------ stickers -- */

  const stickerById = new Map(stickerRecords.map((s) => [s.id, s]));
  const earned = earnedRecords
    .map((row) => stickerById.get(row.sticker))
    .filter((s): s is (typeof stickerRecords)[number] => Boolean(s));

  const stickers: StickerView[] = earned.slice(0, 4).map((s) => ({
    id: s.slug,
    name: s.name,
    hue: s.hue,
    ...(s.ico ? { icon: s.ico } : {}),
  }));

  /* ---------------------------------------------------------------- crew -- */

  const crew: CrewRiderView[] = [];
  const firstCrew = crews[0];
  if (firstCrew) {
    try {
      const board = await getCrewBoard(client, firstCrew.crew);
      for (const row of board.riders.slice(0, 4)) {
        crew.push({
          id: row.id,
          name: row.name || 'Rider',
          handle: row.handle,
          avatarKey: row.avatar_key,
          landed: row.landed,
          isMe: row.id === rider.id,
        });
      }
    } catch {
      // A crew whose board will not load is an empty panel, not a broken page.
    }
  }

  /* ------------------------------------------------------------- per sport */

  const sports = sportsOf(snapshot);
  const dismissed = new Set(dismissals.map((d) => d.announcement));
  const challenges = challengesFromRecords(challengeRecords);
  const plan = (rider.plan ?? 'rookie') as PlanId;
  const goal = goalLabel(rider.goal, rider.goal_custom);
  const globalLanded = computeStats(snapshot, null, { tricks }).landed;

  const bySport: Record<string, SportView> = {};
  for (const sport of sports) {
    bySport[sport] = buildSportView({
      sport,
      snapshot,
      tricks,
      recordIdBySlug,
      plan,
      goal,
      globalLanded,
      sportCount: sports.length,
      stickerCount: earned.length,
      challenges,
      clock,
      today,
      notices,
      dismissed,
    });
  }

  const view: HomeView = {
    firstName: (rider.name || 'rider').split(' ')[0] || 'rider',
    dateLabel: formatDayLong(today),
    streak: {
      headline: weeklyStreakLabel(weeks),
      progressLabel: weeklyProgressLabel(progress),
      encouragement: weeklyEncouragement(progress),
      cells: Array.from({ length: progress.target }, (_, i) => i < progress.rides),
      spare: Math.max(0, progress.rides - progress.target),
      rodeToday: rodeToday(streakState.lastRide, clock),
    },
    stickers,
    crew,
    bySport,
    sports,
  };

  return <HomeScreen view={view} />;
}

/* -------------------------------------------------------------- builders -- */

function toCardView(
  trick: Trick,
  stage: StageId | undefined,
  plan: PlanId,
  recordId?: string,
): TrickCardView {
  const locked = isTrickLocked(trick, plan);
  return {
    slug: trick.id,
    ...(recordId ? { recordId } : {}),
    name: trick.name,
    category: {
      label: categoryLabel(trick.cat, trick.sport),
      color: CATS[trick.cat].color,
    },
    difficulty: trick.diff,
    sport: SPORT_LOOKS[trick.sport],
    stage: stage
      ? {
          id: stage,
          label: STAGE[stage].short,
          short: STAGE[stage].short,
          color: STAGE[stage].color,
        }
      : null,
    locked,
    ...(locked ? { lockTier: TIERS_LABEL[trick.diff - 1] } : {}),
  };
}

interface SportViewInput {
  sport: SportId;
  snapshot: Parameters<typeof computeStats>[0];
  /** The live library, as `@landit/core` takes it. */
  tricks: readonly Trick[];
  /** Slug to `tricks` record id, so a card can carry the id a write needs. */
  recordIdBySlug: Readonly<Record<string, string>>;
  plan: PlanId;
  goal: string | null;
  globalLanded: number;
  sportCount: number;
  stickerCount: number;
  challenges: readonly Challenge[];
  clock: { timezone: string };
  today: string;
  notices: readonly AnnouncementsRecord[];
  dismissed: ReadonlySet<string>;
}

function buildSportView(input: SportViewInput): SportView {
  const { sport, snapshot, tricks, plan, goal, clock, today, recordIdBySlug } = input;
  const stats = computeStats(snapshot, sport, { tricks });
  const byId = snapshot.byId ?? {};
  const look = SPORTS[sport];
  const short = look.short.toLowerCase();

  const inSport = (id: string): Trick | undefined => {
    const trick = trickById(id, tricks);
    return trick && trick.isLive && trick.sport === sport ? trick : undefined;
  };

  const staged = (stage: StageId): TrickCardView[] =>
    Object.keys(byId)
      .filter((id) => byId[id] === stage)
      .map(inSport)
      .filter((t): t is Trick => Boolean(t))
      .map((t) => toCardView(t, byId[t.id], plan, recordIdBySlug[t.id]));

  const workingTricks = staged('trying');
  const wishList = staged('want').slice(0, 4);

  // "Start here" only appears when nothing is in progress, and it never offers a
  // trick this rider cannot track: the paywall is a refusal, not a tease.
  const startHere = workingTricks.length
    ? []
    : suggestedNextTricks(byId, plan, sport, tricks)
        // Plain `<`, not `localeCompare`: ordering from ICU is one more thing
        // two runtimes can disagree about (LESSONS §3a), and trick names are
        // ASCII.
        .sort((a, b) => a.diff - b.diff || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        .slice(0, 4)
        .map((t) => toCardView(t, byId[t.id], plan));

  /* ---------------------------------------------------------- challenge -- */

  const challenge = liveChallenge(sport, clock, input.challenges);
  let challengeView: ChallengeView | null = null;
  if (challenge) {
    const logged = snapshot.challengeLogged?.[challenge.id] ?? 0;
    const p = challengeProgress(challenge, logged);
    const state = challengeState(challenge, clock);
    challengeView = {
      id: challenge.id,
      week: challenge.week,
      title: challenge.title,
      blurb: challenge.blurb,
      hue: challenge.hue,
      logged: p.logged,
      goal: p.goal,
      pct: p.pct,
      stateLabel:
        state === 'live'
          ? look.label
          : state === 'upcoming'
            ? `Starts ${challengeRangeLabel(challenge).split(' to ')[0]}`
            : 'Finished',
    };
  }

  /* ------------------------------------------------------- announcement -- */

  const notice = input.notices.find(
    (n) => !input.dismissed.has(n.id) && inAudience(n, sport, plan, today),
  );
  const announcement: AnnouncementView | null = notice
    ? {
        id: notice.id,
        title: notice.title,
        body: notice.body,
        label: notice.label || 'Land The Trick',
        hue: notice.hue || 'var(--yellow)',
      }
    : null;

  /* ------------------------------------------------------------ summary -- */

  let summary: string;
  if (stats.landed === 0) {
    summary = `Nothing logged on the ${short} yet. Pick one thing off the list and go and try it today.`;
  } else {
    const tricks = `${stats.landed} ${short} ${stats.landed === 1 ? 'trick' : 'tricks'} landed`;
    summary = `${tricks}, ${stats.working} in progress.`;
    if (goal) summary += ` Goal: ${goal}.`;
  }

  const acrossSports =
    input.sportCount > 1 && input.globalLanded > stats.landed
      ? `${input.globalLanded} landed across your sports.`
      : null;

  return {
    sport,
    landed: stats.landed,
    working: stats.working,
    wanted: stats.wanted,
    total: stats.total,
    pct: stats.pct,
    stickerCount: input.stickerCount,
    libraryLabel: `${look.label} library`,
    summary,
    acrossSports,
    // Counted off the same live, in-sport tricks the library counts, so the
    // "All 12 of yours" on this screen and the "My tricks · 12" on that one
    // cannot drift. Not `stats.working + stats.wanted`: that would miss the
    // stages between them.
    tracked: tricksFor(sport, tricks).filter((t) => t.isLive && byId[t.id]).length,
    workingTricks,
    startHere,
    wishList,
    challenge: challengeView,
    announcement,
  };
}

/**
 * Is this rider in the notice's audience?
 *
 * `all`, `plan` or `sport` (plan §3). The sport compared against is the tab the
 * rider is *looking at*, not their whole list — a scooter notice belongs on the
 * scooter tab, which is why this is decided per sport rather than once.
 */
function inAudience(
  notice: AnnouncementsRecord,
  sport: SportId,
  plan: PlanId,
  today: string,
): boolean {
  const starts = notice.starts ? notice.starts.slice(0, 10) : '';
  const ends = notice.ends ? notice.ends.slice(0, 10) : '';
  if (starts && starts > today) return false;
  if (ends && ends < today) return false;

  if (notice.audience === 'plan') return notice.audience_plan === plan;
  if (notice.audience === 'sport') return notice.audience_sport === sport;
  return true;
}
