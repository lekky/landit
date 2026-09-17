import {
  DEFAULT_TIMEZONE,
  SPORT_IDS,
  addDays,
  crewActivityLine,
  isConsentLimited,
  riderToday,
  unseenWhatsNew,
  whatsNewLines,
  WHATS_NEW_CHALLENGE_DAYS,
  WHATS_NEW_EVENT_DAYS,
  WHATS_NEW_LOOKBACK_DAYS,
  type ConsentState,
  type SportId,
  type WhatsNewChallenge,
  type WhatsNewEvent,
  type WhatsNewJoin,
  type WhatsNewLine,
  type WhatsNewSticker,
} from '@landit/core';
import {
  getCrewFeed,
  listChallengeLogFor,
  listChallengesEnding,
  listCrewJoins,
  listCrews,
  listEventAttendanceFor,
  listEventsBetween,
  listReadableRiders,
  listRiderStickersSince,
  listStickers,
  type Client,
  type CrewFeedItem,
  type UsersRecord,
} from '@landit/db';
import { cache } from 'react';

import { relativeTime } from '@/lib/dates';
import { SPORT_LOOKS } from '@/lib/sports';
import { currentRider } from '@/lib/session';

import type {
  WhatsNewCrewItemView,
  WhatsNewCrewView,
  WhatsNewLineView,
  WhatsNewView,
} from './view';

/**
 * What's new, read from the collections the rider can already read.
 *
 * **Nothing here is a privileged read.** Every call takes the rider's own
 * client, so PocketBase's API rules are the gate exactly as they are in the
 * browser (plan §3): `rider_stickers`, `event_attendance` and `challenge_log`
 * are own-row; `crews` and `crew_members` answer only for crews the rider is
 * in; `users` answers with the three-way privacy rule, which is what decides
 * whose crew join may be named; `events`, `challenges` and `stickers` are the
 * public catalogue. The crew **feed** route is the one hook route here, and it
 * is the same one `/crew` calls.
 *
 * **The split between the badge and the panel is deliberate.**
 *
 * - `loadWhatsNewLines` is the **You** tab, and it is what the layout reads on
 *   every page render to decide whether the bell shows a count. **Four reads
 *   fired together, then up to four more that depend on what the first four
 *   found**, every one of them windowed, and `cache`d for the request so the
 *   layout and `/whats-new` do not each pay for it. A rider with no sticker
 *   this month, no event this week, no challenge closing and no crew pays four.
 * - `loadWhatsNewView` adds **one read per crew** for the crew tabs, and is
 *   called only when a panel is actually being rendered — the page, or the
 *   dropdown's action. The bar carries a bell on every screen; a crew feed
 *   fetched on every page view to fill a panel most page views never open is
 *   the cost T45's sport chip already refused for the same reason.
 *
 * **The badge counts the You lines and not the crew tabs**, which the spec
 * leaves open. Two reasons, and the second is the one that settles it: a crew
 * feed is a place to go and look rather than news addressed to this rider, and
 * it carries the reader's *own* stage changes back to them — a badge fed by it
 * would light up because the rider logged a trick, which is a notification
 * about yourself. Recorded in `docs/app-shell-rethink.md` §3.6.
 *
 * **It fails soft.** A feed that will not load must not take a page down: the
 * bell is in the top bar of every signed-in screen, so a throw here would be a
 * 500 on the library, the dashboard and everything else. Every branch answers
 * with an empty list and a zero count instead, which is what the panel already
 * has copy for.
 */

/* ------------------------------------------------------------------- inputs -- */

/** The rider facts the derived feed needs, and no others. */
function streakStateOf(rider: UsersRecord) {
  return {
    streak: rider.streak ?? 0,
    lastQualifyingWeek: rider.last_qualifying_week ? rider.last_qualifying_week.slice(0, 10) : null,
    weekStart: rider.week_start ? rider.week_start.slice(0, 10) : null,
    ridesThisWeek: rider.rides_this_week ?? 0,
    lastRide: rider.last_ride || null,
  };
}

/** A day key as the inclusive start of that day, the shape a `date` filter wants. */
function dayStart(day: string): string {
  return `${day} 00:00:00.000Z`;
}

export interface WhatsNewLines {
  readonly lines: readonly WhatsNewLine[];
  readonly unread: number;
  /**
   * Did the read actually succeed?
   *
   * The loader fails soft to an empty list, which is right for the badge — a
   * feed that will not load must not take the library down — and dangerous for
   * the **write**: stamping `whats_new_seen_at` after a failed read would move
   * a rider's bookmark past news they were never shown (review N5). So the
   * failure is carried rather than swallowed, and the panel only stamps on a
   * read it can vouch for. A signed-out call is `ok`, because there is nothing
   * to read and nothing to stamp.
   */
  readonly ok: boolean;
}

const EMPTY_LINES: WhatsNewLines = { lines: [], unread: 0, ok: true };
const FAILED_LINES: WhatsNewLines = { lines: [], unread: 0, ok: false };

/**
 * The signed-in rider, resolved once for this module per request.
 *
 * `currentRider` is not itself memoised, and every call is a PocketBase
 * auth-refresh — so on `/whats-new` the two loaders below would re-check the
 * same token twice between them, on top of the layout's own call and the
 * page's. This wrapper takes that back to one for this module. Caching
 * `currentRider` itself would take it to one for the whole request and is the
 * real fix; it is an owner's call rather than this task's, because a request
 * that signs a rider in or out and then asks again would start reading a
 * cached answer. Filed rather than done.
 */
const riderForRequest = cache(currentRider);

/**
 * The You tab and its unseen count, for one request.
 *
 * `cache` is React's per-request memo, so the layout's badge and a
 * `/whats-new` render in the same request share one set of reads. It does not
 * survive the request, and it must not: the whole point of the count is that it
 * is current.
 */
export const loadWhatsNewLines = cache(async (): Promise<WhatsNewLines> => {
  const session = await riderForRequest();
  if (!session) return EMPTY_LINES;

  try {
    return await readLines(session.client, session.rider);
  } catch {
    // Deliberately silent, and deliberately zero: see the module comment. Not
    // `ok`, though — a bookmark must not move past a list nobody was shown.
    return FAILED_LINES;
  }
});

async function readLines(client: Client, rider: UsersRecord): Promise<WhatsNewLines> {
  const timezone = rider.timezone || DEFAULT_TIMEZONE;
  const clock = { timezone };
  const today = riderToday(clock);
  const since = addDays(today, -WHATS_NEW_LOOKBACK_DAYS);
  const sports: readonly SportId[] = rider.sports?.length ? (rider.sports as SportId[]) : SPORT_IDS;

  // A rider waiting on a guardian is in no crew and cannot be put in one
  // (guarantee 4), so there is nothing for the crew reads to find.
  const gated = isConsentLimited(rider.consent_state as ConsentState);

  /*
   * **Four reads, and every one of them is windowed** (review S1).
   *
   * The first cut fired six and only one was narrowed: `listRiderStickers`,
   * `listEventAttendance`, `listChallenges` and `listChallengeLog` are all
   * `.list()`, which is `getFullList` — so a question about the next three days
   * was being answered by reading every challenge that has ever existed for
   * every sport, and a rider's whole logging history with it. On a screen whose
   * count is computed on every page render, that is the wrong shape of read.
   *
   * What each window is: thirty days back for stickers (the look-back §3.6 does
   * not give), seven days ahead for events, live-and-closing-within-three for
   * challenges. `listCrews` has no window and needs none — it answers with
   * exactly the caller's crews and a rider is in a handful.
   */
  const [recentlyEarned, challenges, crews, events] = await Promise.all([
    listRiderStickersSince(client, rider.id, dayStart(since)),
    listChallengesEnding(client, today, addDays(today, WHATS_NEW_CHALLENGE_DAYS)),
    gated ? Promise.resolve([]) : listCrews(client),
    listEventsBetween(client, today, addDays(today, WHATS_NEW_EVENT_DAYS)),
  ]);

  /*
   * The second round asks only what the first round found something for, which
   * on most page renders is nothing: a rider with no sticker this month, no
   * event this week, no challenge closing and no crew pays for four reads in
   * total.
   */
  const crewIds = crews.map((crew) => crew.id);
  const challengeIds = challenges
    // A rider who rides one sport is not told when another sport's week closes.
    .filter((row) => sports.includes(row.sport as SportId))
    .map((row) => row.id);

  const [stickers, attendance, challengeLog, joinRows] = await Promise.all([
    recentlyEarned.length ? listStickers(client) : Promise.resolve([]),
    listEventAttendanceFor(
      client,
      rider.id,
      events.map((event) => event.id),
    ),
    listChallengeLogFor(client, rider.id, challengeIds),
    crewIds.length ? listCrewJoins(client, crewIds, dayStart(since)) : Promise.resolve([]),
  ]);

  const stickerById = new Map(stickers.map((sticker) => [sticker.id, sticker]));
  const stickerInputs: WhatsNewSticker[] = recentlyEarned.flatMap((row) => {
    const sticker = stickerById.get(row.sticker);
    // A row whose sticker is no longer live has no name to put in a sentence,
    // and "You earned the sticker sticker." is worse than one fewer line.
    if (!sticker) return [];
    return [
      {
        id: row.id,
        name: sticker.name,
        ...(sticker.hue ? { hue: sticker.hue } : {}),
        earnedAt: row.earned_at,
      },
    ];
  });

  /*
   * `created` is when the rider pressed "I'm going", and it is what the line is
   * dated from when it is later than the window opening (review B2). Reading it
   * here is the whole of that fix on this side — the rule itself is in
   * `@landit/core`, where it can be tested.
   */
  const saidYesAt = new Map(attendance.map((row) => [row.event, row.created]));
  const eventInputs: WhatsNewEvent[] = events
    .filter((event) => saidYesAt.has(event.id))
    .map((event) => ({
      id: event.id,
      name: event.name,
      date: event.date.slice(0, 10),
      ...(saidYesAt.get(event.id) ? { saidYesAt: saidYesAt.get(event.id) as string } : {}),
    }));

  const loggedPerChallenge = new Map<string, number>();
  for (const row of challengeLog) {
    loggedPerChallenge.set(row.challenge, (loggedPerChallenge.get(row.challenge) ?? 0) + 1);
  }
  const wantedChallenges = new Set(challengeIds);
  const challengeInputs: WhatsNewChallenge[] = challenges
    .filter((row) => wantedChallenges.has(row.id))
    .map((row) => ({
      id: row.id,
      title: row.title,
      ends: row.ends.slice(0, 10),
      goal: row.goal,
      logged: loggedPerChallenge.get(row.id) ?? 0,
    }));

  const joinInputs = await joinsWithNames(client, crews, joinRows, rider.id);

  const lines = whatsNewLines(
    {
      stickers: stickerInputs,
      events: eventInputs,
      challenges: challengeInputs,
      joins: joinInputs,
      streak: streakStateOf(rider),
    },
    clock,
  );

  return {
    lines,
    unread: unseenWhatsNew(lines, rider.whats_new_seen_at || null),
    ok: true,
  };
}

/**
 * Membership rows, turned into names — **for the riders this rider may see**.
 *
 * The name comes from `users`, read with the rider's own client, and that is
 * the whole of the privacy decision (review B3). `users.listRule` is plan §3
 * guarantee 1's three-way rule: your own record always, a `public` or `members`
 * rider to a signed-in viewer, a `private` one to nobody, and never a rider
 * held behind the consent gate or suspended. So an id that comes back is a
 * rider this reader can already see and an id that does not is one they cannot
 * — which is **exactly** the test `hooks/85_crews.pb.js` spells out for the
 * crew feed, arrived at by asking the rule rather than by keeping a second copy
 * of it.
 *
 * **The first cut read the crew board instead, and that was wrong.** The board
 * names a private rider by name and score, which is guarantee 1's single
 * carve-out — and the crew feed's own comment says, in as many words, that the
 * carve-out "does not stretch to here", because what a rider *did* is more than
 * a name and a score. A join is activity. The result was a You tab reading
 * "Cara Quiet joined Ramp Rats." one tab away from a crew feed whose empty
 * state says private riders never show up, which is a promise and a screen
 * disagreeing in the same panel.
 *
 * The conservative reading is the one that ships: a private crew-mate's join is
 * simply not mentioned. Widening it — deciding that "somebody joined your crew"
 * is board-shaped rather than feed-shaped — is the owner's call, and §3.6 says
 * so.
 *
 * One read, not one per crew, and only when somebody actually joined.
 */
async function joinsWithNames(
  client: Client,
  crews: readonly { id: string; name: string }[],
  joinRows: readonly { id: string; crew: string; user: string; joined: string }[],
  riderId: string,
): Promise<WhatsNewJoin[]> {
  // The rider's own membership is not news to them.
  const rows = joinRows.filter((row) => row.user !== riderId);
  if (rows.length === 0) return [];

  const crewById = new Map(crews.map((crew) => [crew.id, crew]));
  const readable = new Map(
    (
      await listReadableRiders(
        client,
        rows.map((row) => row.user),
      )
    ).map((who) => [who.id, who] as const),
  );

  return rows.flatMap((row) => {
    const crew = crewById.get(row.crew);
    const who = readable.get(row.user);
    // No readable rider means no line — either they are private, or the row
    // points at an account that is gone. A line saying "A rider joined Ramp
    // Rats" would be the product narrating somebody it is not allowed to name.
    if (!crew || !who || !who.name?.trim()) return [];
    return [
      {
        id: row.id,
        crewName: crew.name,
        riderName: who.name.trim(),
        ...(who.avatar_key ? { avatarKey: who.avatar_key } : {}),
        joinedAt: row.joined,
      },
    ];
  });
}

/* --------------------------------------------------------------- the panel -- */

const SOURCE_LABELS: Record<WhatsNewLine['kind'], string> = {
  sticker: 'Sticker',
  event: 'Event',
  challenge: 'Challenge',
  week: 'Streak',
  join: 'Crew',
};

function toLineView(line: WhatsNewLine, now: number, timezone: string): WhatsNewLineView {
  return {
    id: line.id,
    kind: line.kind,
    line: line.line,
    // Nothing for a line about something still to come: its own sentence says
    // when, and its `at` is when the line appeared rather than when anything
    // happened (`whats-new.ts` in `@landit/core`).
    when: line.ahead ? null : relativeTime(line.at, now, timezone),
    source: SOURCE_LABELS[line.kind],
    riderName: line.riderName ?? null,
    avatarKey: line.avatarKey ?? null,
    hue: line.hue ?? null,
  };
}

const EMPTY_VIEW: WhatsNewView = { lines: [], crews: [], unread: 0, ok: true };

/**
 * The whole panel: the You tab, one tab per crew, and the unseen count.
 *
 * Called by `/whats-new` and by the dropdown's action, and not by the layout —
 * the crew feeds are a read per crew and the bar is on every screen.
 */
export const loadWhatsNewView = cache(async (): Promise<WhatsNewView> => {
  const session = await riderForRequest();
  if (!session) return EMPTY_VIEW;

  const { client, rider } = session;
  const timezone = rider.timezone || DEFAULT_TIMEZONE;
  const now = Date.now();

  const { lines, unread, ok } = await loadWhatsNewLines();

  let crews: WhatsNewCrewView[] = [];
  try {
    if (!isConsentLimited(rider.consent_state as ConsentState)) {
      const mine = await listCrews(client);
      crews = await Promise.all(mine.map((crew) => loadCrewTab(client, crew, now, timezone)));
    }
  } catch {
    // A crew feed that will not load costs its tab, never the page.
    crews = [];
  }

  return {
    lines: lines.map((line) => toLineView(line, now, timezone)),
    crews,
    unread,
    ok,
  };
});

/**
 * One crew's tab — **the existing crew activity feed, unchanged** (§3.6).
 *
 * Same route, same six sentences from `crewActivityLine` in `@landit/core`,
 * same shape of row. What's new shows the crew screen's feed in a second place;
 * it does not write a second version of it, which is what keeps "there is no
 * free text in the feed" true in one place rather than two.
 */
async function loadCrewTab(
  client: Client,
  crew: { id: string; name: string },
  now: number,
  timezone: string,
): Promise<WhatsNewCrewView> {
  try {
    const feed = await getCrewFeed(client, crew.id);
    return {
      id: crew.id,
      name: crew.name,
      items: feed.items.map((item) => toCrewItem(item, now, timezone)),
      problem: null,
    };
  } catch {
    return {
      id: crew.id,
      name: crew.name,
      items: [],
      problem: 'We could not load this crew just now. Try again in a moment.',
    };
  }
}

function toCrewItem(item: CrewFeedItem, now: number, timezone: string): WhatsNewCrewItemView {
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
    when: relativeTime(item.at, now, timezone),
    sport,
    hue: item.hue || null,
  };
}
