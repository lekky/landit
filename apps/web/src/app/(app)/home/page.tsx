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
  crewActivityLine,
  currentWeeklyStreak,
  eventKindColor,
  formatDayLong,
  goalLabel,
  groupSessionsByMonth,
  isTrickLocked,
  liveChallenge,
  riderMonthKey,
  riderToday,
  rodeToday,
  sportsOf,
  suggestedNextTricks,
  trickById,
  tricksFor,
  upcomingEvents,
  weekdayName,
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
  eventsFromRecords,
  getCrewFeed,
  getSpotsByIds,
  listAllOwnSessions,
  listAnnouncementDismissals,
  listAnnouncements,
  listChallenges,
  listCrewMemberships,
  listEventAttendance,
  listEvents,
  listFavouriteSpots,
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

import { relativeTime, shortDate } from '@/lib/dates';
import { ROUTES } from '@/lib/routes';
import { currentRider } from '@/lib/session';
import { sessionsEnabledFor } from '@/lib/sessionsPreview';
import { SPORT_LOOKS } from '@/lib/sports';

import { HomeScreen } from './HomeScreen';
import type {
  AnnouncementView,
  ChallengeView,
  CrewLineView,
  FaveSpotView,
  HomeView,
  NextEventView,
  SessionsCardView,
  SportView,
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

  /*
   * The library comes from the database, not from `@landit/core`'s canonical
   * constants. They agree today because the seed is built from those constants,
   * but staff can edit tricks (T17) and a hidden or renamed trick has to
   * disappear from Home the moment it disappears from `/library` — otherwise
   * Home offers a card whose page 404s, which is exactly what CI caught.
   *
   * Two of these are new with the record cards (rethink §3.4): the events this
   * rider said yes to, for "Next up", and their favourite spots, for "Your
   * spots". Both are collections whose every rule is `OWN`, read with the
   * rider's own client — so this screen cannot see anybody else's attendance or
   * anybody else's faves, and the child-safety position that there is no
   * stranger-contact surface is not being leaned on by this file, it is
   * enforced under it.
   *
   * The **sessions** reads are not here, and that is deliberate: the Sessions
   * card is drawn only for a rider the preview covers (T41), so its reads are
   * made below, behind that gate. A dashboard should not pay for a card nobody
   * is shown.
   */
  const sessionsEnabled = sessionsEnabledFor(rider);

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
    eventRecords,
    attendance,
    faveSpotRecords,
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
    listEvents(client),
    listEventAttendance(client, rider.id),
    listFavouriteSpots(client),
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

  /*
   * The newest one the rider holds, for the Stickers card's sub-line.
   *
   * Sorted by `earned_at` here rather than trusted from the read's order: the
   * wall is keyed by sticker and the award rows come back in whatever order the
   * collection gives, so "newest" has to be asked of the date. An empty string
   * is how PocketBase spells "never", and it sorts to the bottom, which is
   * where a row with no date belongs.
   */
  const newestSticker =
    [...earnedRecords]
      .sort((a, b) => (a.earned_at < b.earned_at ? 1 : a.earned_at > b.earned_at ? -1 : 0))
      .map((row) => stickerById.get(row.sticker)?.name)
      .find((name): name is string => Boolean(name)) ?? null;

  /* ---------------------------------------------------------------- crew -- */

  // Three lines of the first crew's activity, where Home used to draw the
  // board (§3.4). `buildCrewActivity` below says what is and is not in them.
  const firstCrew = crews[0];
  const crewActivity = firstCrew ? await buildCrewActivity(client, firstCrew.crew, timezone) : [];

  /* -------------------------------------------------------------- next up -- */

  /*
   * The next event this rider said yes to.
   *
   * `event_attendance` relates to the event **record** while everything about
   * an event on screen is keyed by slug, so the join happens once, here, in the
   * one place holding both — the same shape `app/(app)/events/load.ts` uses,
   * and for the same reason. `upcomingEvents` is `@landit/core`'s single
   * definition of what is still ahead, so Home cannot call an event upcoming
   * while the calendar calls it over.
   */
  const goingTo = new Set(attendance.map((row) => row.event));
  const goingSlugs = new Set(
    eventRecords.filter((row) => goingTo.has(row.id)).map((row) => row.slug),
  );
  const nextEventItem = upcomingEvents(eventsFromRecords(eventRecords), clock).find((event) =>
    goingSlugs.has(event.id),
  );
  const nextEvent: NextEventView | null = nextEventItem
    ? {
        slug: nextEventItem.id,
        name: nextEventItem.name,
        dateLabel: formatDayLong(nextEventItem.date),
        town: nextEventItem.town,
        hue: eventKindColor(nextEventItem.kind),
      }
    : null;

  /* ----------------------------------------------------------- your spots -- */

  // Four, newest favourite first. `listFavouriteSpots` already drops a spot the
  // rider may no longer read, so a stale fave shortens the row rather than
  // drawing a card it cannot fill in.
  const faveSpots: FaveSpotView[] = faveSpotRecords.slice(0, 4).map((spot) => ({
    slug: spot.slug,
    name: spot.name,
    town: spot.town,
  }));

  /* -------------------------------------------------------- sessions card -- */

  const sessionsCard = sessionsEnabled ? await buildSessionsCard(client, rider.id, timezone) : null;

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
    // Asked here, on the server, and handed over as a boolean: the same gate
    // the Sessions tab, the `/progress/sessions` routes and the spot, event and
    // trick blocks ask (plan §7, T41). Unset `LANDIT_OWNER_ID` fails closed, so
    // a deploy nobody configured offers the logger to nobody.
    sessionsEnabled,
    dateLabel: formatDayLong(today),
    streak: {
      headline: weeklyStreakLabel(weeks),
      progressLabel: weeklyProgressLabel(progress),
      encouragement: weeklyEncouragement(progress),
      cells: Array.from({ length: progress.target }, (_, i) => i < progress.rides),
      spare: Math.max(0, progress.rides - progress.target),
      rodeToday: rodeToday(streakState.lastRide, clock),
    },
    newestSticker,
    sessionsCard,
    crewActivity,
    nextEvent,
    faveSpots,
    bySport,
    sports,
  };

  return <HomeScreen view={view} />;
}

/* -------------------------------------------------------------- builders -- */

/**
 * Three lines of a crew's activity, where Home used to draw the board (§3.4).
 *
 * Every sentence is `crewActivityLine`'s — six of them, written by the product
 * from catalogue facts. Nothing a rider typed is in this panel and nothing can
 * be: the feed route hands back a kind, a stage, a trick name and a sticker
 * name, and this turns those into one of the six (plan §6.1).
 *
 * A function rather than a block inside the page because of the clock. `now` is
 * read once here so three rows are timed against one instant, and a component
 * body may not read it at all — `react-hooks/purity` refuses `Date.now()` in a
 * render, for the good reason that a value which changes between two renders of
 * the same tree is a value React cannot reconcile.
 */
async function buildCrewActivity(
  client: Parameters<typeof getCrewFeed>[0],
  crewId: string,
  timezone: string,
): Promise<CrewLineView[]> {
  const now = Date.now();
  try {
    const feed = await getCrewFeed(client, crewId);
    return feed.items.slice(0, 3).map((item) => ({
      id: item.id,
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
      when: relativeTime(item.at, now, timezone),
      name: (item.rider.name || 'Rider').trim(),
      avatarKey: item.rider.avatar_key || '',
    }));
  } catch {
    // A crew whose feed will not load is an empty panel, not a broken page.
    return [];
  }
}

/**
 * The Sessions card: this month's count, and the last ride's spot and day.
 *
 * Only ever called for a rider the preview covers (plan §7, T41), which is what
 * keeps its two extra reads off everybody else's dashboard. The diary is read
 * whole because that is what `listAllOwnSessions` is — two requests however
 * long it is — and the month is cut from it with `groupSessionsByMonth`, the
 * same function the Sessions screen groups by, so "this month" cannot mean two
 * different things on two screens.
 *
 * The spot name is fetched by id through `getSpotsByIds`, which drops anything
 * the rider may not read: a spot taken off the map since they rode there leaves
 * the card saying the day and not the place, rather than a blank.
 */
async function buildSessionsCard(
  client: Parameters<typeof listAllOwnSessions>[0],
  userId: string,
  timezone: string,
): Promise<SessionsCardView> {
  const sessions = await listAllOwnSessions(client, { userId });
  if (!sessions.length) {
    return { value: '0', sub: 'Log your first ride and it lands here.' };
  }

  const thisMonth = riderMonthKey({ timezone });
  const groups = groupSessionsByMonth(sessions, timezone);
  const count = groups.find((group) => group.monthKey === thisMonth)?.count ?? 0;

  // `listAllOwnSessions` sorts newest first, so the last ride is the first row.
  const last = sessions[0];
  const day = last ? shortDate(last.startedAt, timezone).replace(/ \d{4}$/, '') : '';
  let place = '';
  if (last?.spotId) {
    try {
      const spots = await getSpotsByIds(client, [last.spotId]);
      place = spots[0]?.name ?? '';
    } catch {
      // A spot that will not load costs the card its place name, not its number.
    }
  }

  return {
    value: String(count),
    sub: place ? `${place} · ${day}` : `Last ride ${day}`,
  };
}

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

  /*
   * Four, not all of them (§3.4).
   *
   * Home is a dashboard now: the section is a slice with "All N of yours →"
   * beside it, and the whole list lives on `/library?mine=1`. Four rather than
   * two because the phone shows the first two by CSS and the desktop row is
   * 4-up — a count decided in the browser is a count the server guessed
   * differently, and the grid would be rebuilt on hydration.
   *
   * "On the wish list" went with the same change. What it showed — the tricks a
   * rider has marked "want to" — is the Progress card's third number, and the
   * list itself is one tap away on `/library?mine=1`; a second grid of trick
   * cards under the first was the largest thing on the phone's dashboard and
   * the least often acted on.
   */
  const workingTricks = staged('trying').slice(0, 4);

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
      /*
       * The Challenge card's one line of context (§3.4).
       *
       * A weekday while it runs, because the window is a week and that is the
       * shortest true thing to say; the start date before it does; the past
       * tense once it is over. Never a countdown and never what is about to be
       * lost — plan §6.4, Standard 13, which is the same rule the streak card
       * is built under.
       */
      endsLabel:
        state === 'live'
          ? `Ends ${weekdayName(challenge.ends)}`
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
