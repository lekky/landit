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
  trackedTricksForDashboard,
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
  getEventsByIds,
  listEventAttendance,
  listFavouriteSpotIds,
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

import { dayMonth, relativeTime } from '@/lib/dates';
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
   * **Both are the rider's own small collections, and neither pulls a
   * catalogue with it** (review S6). The first cut read every live event and
   * every favourited spot: 74 events to draw one row, and up to 200 spot
   * records to draw four cards — a whole calendar charged to every first-day
   * account with no attendance at all. What is read here now is the attendance
   * rows and the fave *ids*; the records they name are fetched below, keyed,
   * and only if there are any.
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
    attendance,
    faveSpotIds,
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
    listEventAttendance(client, rider.id),
    listFavouriteSpotIds(client),
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

  /*
   * The Stickers card's two values, **scoped to one sport**.
   *
   * The card sits in a `SportView`, whose contract is "everything that changes
   * when the rider switches sport" — and it used to carry a count of every
   * sticker on every wall and a "newest" that could easily not be on the wall
   * the card opens. A rider with one skate sticker, chipped to scooter, was told
   * "1 · Newest: First skate trick" and then met an empty scooter wall.
   *
   * The scope is the wall's own, reused rather than re-derived: a shared sticker
   * sits on every wall, a sport sticker only on its own
   * (`app/(app)/stickers/page.tsx`, "<sport> and shared").
   *
   * Newest is sorted by `earned_at` rather than trusted from the read's order:
   * the award rows come back in whatever order the collection gives, so "newest"
   * has to be asked of the date. An empty string is how PocketBase spells
   * "never", and it sorts to the bottom, which is where a row with no date
   * belongs.
   */
  const earnedOnWall = [...earnedRecords]
    .sort((a, b) => (a.earned_at < b.earned_at ? 1 : a.earned_at > b.earned_at ? -1 : 0))
    .map((row) => stickerById.get(row.sticker))
    .filter((s): s is (typeof stickerRecords)[number] => Boolean(s));

  const stickersFor = (sport: string) => {
    const wall = earnedOnWall.filter((s) => !s.sport || s.sport === sport);
    return { count: wall.length, newest: wall[0]?.name ?? null };
  };

  /* ---------------------------------------------------------------- crew -- */

  // Three lines of the first crew's activity, where Home used to draw the
  // board (§3.4). `buildCrewActivity` below says what is and is not in them.
  const firstCrew = crews[0];
  const crewActivity = firstCrew ? await buildCrewActivity(client, firstCrew.crew, timezone) : [];

  /* ------------------------------------------------- next up, your spots -- */

  /*
   * Both keyed reads, and both skipped entirely when there is nothing to key
   * them with (review S6). In parallel with each other, so a rider with both
   * pays one round trip rather than two.
   */
  const [nextEvent, faveSpotRecords] = await Promise.all([
    buildNextEvent(client, attendance, clock),
    // Four, newest favourite first — cut **before** the read, not after it.
    // The flood cap is 200 faves, and the section draws four.
    faveSpotIds.length
      ? getSpotsByIds(client, faveSpotIds.slice(0, FAVE_SPOTS))
      : Promise.resolve([]),
  ]);

  // `getSpotsByIds` already drops a spot the rider may no longer read, so a
  // stale fave shortens the row rather than drawing a card it cannot fill in.
  const faveSpots: FaveSpotView[] = faveSpotRecords.map((spot) => ({
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
    const stickers = stickersFor(sport);
    bySport[sport] = buildSportView({
      sport,
      snapshot,
      tricks,
      recordIdBySlug,
      plan,
      goal,
      globalLanded,
      sportCount: sports.length,
      stickerCount: stickers.count,
      newestSticker: stickers.newest,
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

/** How many faved spots "Your spots" draws — and therefore how many it reads. */
const FAVE_SPOTS = 4;

/**
 * The next event this rider said yes to, or `null`.
 *
 * **Keyed on their own attendance, never on the calendar** (review S6). The
 * first cut read every live event and picked one out of it, which charged the
 * whole calendar — 74 events today and meant to grow — to every render of every
 * rider's dashboard, including the majority who have said yes to nothing. Now a
 * rider with no attendance costs **no events read at all**, and a rider with
 * some reads exactly those.
 *
 * `event_attendance` relates to the event **record** while everything about an
 * event on screen is keyed by slug, so the join happens once, here, in the one
 * place holding both — the same shape `app/(app)/events/load.ts` uses, and for
 * the same reason. `upcomingEvents` is `@landit/core`'s single definition of
 * what is still ahead, so Home cannot call an event upcoming while the calendar
 * calls it over.
 */
async function buildNextEvent(
  client: Parameters<typeof getEventsByIds>[0],
  attendance: readonly { readonly event: string }[],
  clock: { timezone: string },
): Promise<NextEventView | null> {
  if (!attendance.length) return null;

  const rows = await getEventsByIds(
    client,
    attendance.map((row) => row.event),
  );
  const next = upcomingEvents(eventsFromRecords(rows), clock)[0];
  if (!next) return null;

  return {
    slug: next.id,
    name: next.name,
    dateLabel: formatDayLong(next.date),
    town: next.town,
    hue: eventKindColor(next.kind),
  };
}

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
  const day = last ? dayMonth(last.startedAt, timezone) : '';
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
  /** Stickers earned on **this sport's** wall — its own plus the shared ones. */
  stickerCount: number;
  /** The newest of those, by `earned_at`, or `null`. */
  newestSticker: string | null;
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

  /*
   * Every trick this rider tracks in this sport, learning first (Rachid,
   * 2026-09-18, in chat).
   *
   * **It used to be the `trying` slice alone, and that was the bug.** The
   * heading says "Your tricks" and the link beside it says "All N of yours",
   * but the grid held only the ones at `trying` — so a rider with two landed
   * and one being learned read a promise of three and was shown one, with
   * nothing on the screen to say the other two were a tap away. Widening it
   * also retires #190 properly: bumping a trick off Learning now moves its
   * card **down this list** instead of taking it out of the section under the
   * rider's thumb.
   *
   * The order is `trackedTricksForDashboard`'s, not this file's: learning
   * first, then the ordinary stage order, difficulty within each. It is a rule
   * about the product rather than a detail of this screen, so it is a pure
   * unit-tested function in `@landit/core` and the native app gets it for free.
   */
  const trackedTricks = tricksFor(sport, tricks).filter((t) => t.isLive && byId[t.id]);
  const ordered = trackedTricksForDashboard(trackedTricks, byId);

  /*
   * Four, not all of them (§3.4) — the cap did not move with the widening
   * (Rachid, 2026-09-18, in chat).
   *
   * Home is a dashboard: the section is a slice with "All N of yours →" beside
   * it, and the whole list lives on `/library?mine=1`. Four rather than two
   * because the phone shows the first two by CSS and the desktop row is 4-up —
   * a count decided in the browser is a count the server guessed differently,
   * and the grid would be rebuilt on hydration.
   *
   * "On the wish list" went with the §3.4 change. What it showed — the tricks
   * a rider has marked "want to" — is in this list now, in stage order, rather
   * than in a second grid under the first.
   */
  const dashboardTricks = ordered
    .slice(0, 4)
    .map((t) => toCardView(t, byId[t.id], plan, recordIdBySlug[t.id]));

  // "Start here" only appears when the rider tracks nothing at all, and it never
  // offers a trick this rider cannot track: the paywall is a refusal, not a tease.
  const startHere = dashboardTricks.length
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
    newestSticker: input.newestSticker,
    libraryLabel: `${look.label} library`,
    summary,
    acrossSports,
    // Counted off the very list the grid is sliced from, so the "All 12 of
    // yours" on this screen, the cards under it and the "My tricks · 12" on
    // `/library?mine=1` cannot drift — they are now one array and its length.
    // Not `stats.working + stats.wanted`: that would miss the stages between
    // them, which is the miscount the widening was about.
    tracked: trackedTricks.length,
    trackedTricks: dashboardTricks,
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
