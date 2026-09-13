import {
  DEFAULT_TIMEZONE,
  MONTH_LABELS,
  MONTH_NAMES,
  SESSION_VISIBILITIES,
  SPORTS,
  clipPlatformColor,
  clipPlatformLabel,
  clipWatchUrl,
  currentWeeklyStreak,
  riderMonthKey,
  riderToday,
  sessionDurationLabel,
  sessionFeelColor,
  sessionFeelLabel,
  sessionMonthSummary,
  sessionQuotaLine,
  sessionQuotaPips,
  sessionQuotaResets,
  sessionStageMoves,
  sessionTimeLabel,
  sessionVisibilityLabel,
  sessionWeatherLabel,
  sessionsPerMonthLabel,
  sortSessionsNewestFirst,
  stageMoveLabel,
  toDayKey,
  topSpots,
  weekdayName,
  weeklyStreakLabel,
  type RideSession,
  type SportId,
} from '@landit/core';
import {
  getSessionQuota,
  getSpotsByIds,
  listAllOwnSessions,
  records,
  sessionAllowanceFromRecord,
  type Client,
  type EventsRecord,
  type PlansRecord,
  type SpotsRecord,
  type TricksRecord,
  type UsersRecord,
} from '@landit/db';

import { eventHref, spotHref, trickHref } from '@/lib/routes';
import { sessionFilterSports, topSpotBarWidth } from '@/lib/sessionList';
import { editSessionHref, sessionHref } from '@/lib/sessionRoutes';

import type { SessionCardView, SessionsSidebarView, SessionsView } from './types';

/**
 * The Sessions tab, shaped on the server (T37).
 *
 * **Every read holds the rider's own client** (`currentRider().client`), so the
 * collection rules and `66_sessions.pb.js`'s enrich hook apply exactly as they
 * would in the browser. Never the superuser client: it would skip both, and
 * the crew names under a session are only safe to render because the server
 * already stripped the ones this reader may not see (plan §7, T36 contract).
 *
 * Names are read by id with the same client. A spot or event the rider can no
 * longer read (taken off the map, pulled from the calendar) simply does not
 * come back, and its session still renders — with a plain label rather than a
 * link to a page that would 404.
 */

/** A PocketBase `id = {:i0} || …` filter over some ids. */
function idFilter(ids: readonly string[]): { filter: string; params: Record<string, string> } {
  const params: Record<string, string> = {};
  const parts = ids.map((id, i) => {
    params[`i${i}`] = id;
    return `id = {:i${i}}`;
  });
  return { filter: parts.join(' || '), params };
}

/** Forty ids a request keeps a filter well inside PocketBase's limits. */
function chunked<T>(list: readonly T[], size = 40): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function unique(values: readonly (string | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))];
}

async function eventsByIds(client: Client, ids: readonly string[]): Promise<EventsRecord[]> {
  const out: EventsRecord[] = [];
  for (const chunk of chunked(ids)) {
    out.push(
      ...(await records(client, 'events').list({ ...idFilter(chunk), fields: 'id,slug,name' })),
    );
  }
  return out;
}

async function tricksByIds(client: Client, ids: readonly string[]): Promise<TricksRecord[]> {
  const out: TricksRecord[] = [];
  for (const chunk of chunked(ids)) {
    out.push(
      ...(await records(client, 'tricks').list({ ...idFilter(chunk), fields: 'id,slug,name' })),
    );
  }
  return out;
}

/**
 * The tagged crew-mates' names. `users`' list rule is the profile-privacy rule,
 * and the ids are already the ones the enrich hook let through, so this reads
 * nothing the rider could not open themselves.
 */
async function ridersByIds(client: Client, ids: readonly string[]): Promise<UsersRecord[]> {
  const out: UsersRecord[] = [];
  for (const chunk of chunked(ids)) {
    out.push(...(await records(client, 'users').list({ ...idFilter(chunk), fields: 'id,name' })));
  }
  return out;
}

async function spotsByIds(client: Client, ids: readonly string[]): Promise<SpotsRecord[]> {
  const out: SpotsRecord[] = [];
  for (const chunk of chunked(ids)) out.push(...(await getSpotsByIds(client, chunk)));
  return out;
}

/** "14:00" on the rider's clock. Numeric parts only; this runs on the server alone. */
function clockTime(instant: string, timezone: string): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

/** What a spot is called when the rider can no longer read it. */
export const UNKNOWN_SPOT = 'A spot no longer on the map';

function cardView(
  session: RideSession,
  names: {
    spots: Map<string, SpotsRecord>;
    events: Map<string, EventsRecord>;
    tricks: Map<string, TricksRecord>;
    riders: Map<string, UsersRecord>;
  },
  timezone: string,
  today: string,
): SessionCardView {
  const dayKey = toDayKey(session.startedAt, timezone);
  const monthIndex = Number(dayKey.slice(5, 7)) - 1;
  const day = dayKey.slice(8, 10);
  const mon = MONTH_LABELS[monthIndex] ?? '';
  const spot = names.spots.get(session.spotId);
  const event = session.eventId ? names.events.get(session.eventId) : undefined;
  const sport = SPORTS[session.sport];
  const visibility = SESSION_VISIBILITIES.find((v) => v.id === session.visibility);

  return {
    id: session.id,
    session,
    viewHref: sessionHref(session.id),
    editHref: editSessionHref(session.id),
    dow: weekdayName(dayKey).slice(0, 3),
    day,
    mon,
    dateLabel: `${day} ${mon}`,
    sinceLong: `${Number(day)} ${MONTH_NAMES[monthIndex] ?? ''} ${dayKey.slice(0, 4)}`,
    sinceShort: `${Number(day)} ${mon}`,
    time: clockTime(session.startedAt, timezone),
    isToday: dayKey === today,
    spot: spot
      ? { name: spot.name, href: spot.status === 'live' && spot.slug ? spotHref(spot.slug) : null }
      : { name: UNKNOWN_SPOT, href: null },
    event: event ? { name: event.name, href: event.slug ? eventHref(event.slug) : null } : null,
    sport: { id: session.sport, label: sport?.short ?? session.sport, art: sport?.icon ?? 'scoot' },
    duration: sessionDurationLabel(session.durationMinutes),
    weather: session.weather
      ? { id: session.weather, label: sessionWeatherLabel(session.weather) }
      : null,
    feel: {
      id: session.feel,
      label: sessionFeelLabel(session.feel),
      color: sessionFeelColor(session.feel),
    },
    crew: session.crewIds
      .map((id) => names.riders.get(id)?.name?.trim())
      .filter(Boolean)
      .join(', '),
    aim: session.aim ?? '',
    notes: session.notes ?? '',
    tricks: session.trickEntries.map((entry) => {
      const trick = names.tricks.get(entry.trickId);
      return {
        key: entry.trickId,
        name: trick?.name ?? 'A trick',
        href: trick?.slug ? trickHref(trick.slug) : null,
        move: stageMoveLabel(entry),
      };
    }),
    clip: session.clip
      ? {
          platform: session.clip.platform,
          href: clipWatchUrl(session.clip),
          label: clipPlatformLabel(session.clip.platform),
          color: clipPlatformColor(session.clip.platform),
        }
      : null,
    visibility: {
      id: session.visibility,
      label: sessionVisibilityLabel(session.visibility),
      blurb: visibility?.blurb ?? '',
    },
    moved: sessionStageMoves(session).length > 0,
  };
}

/** "Rookie logs four sessions a month. Yours resets on 1 October." */
function quotaCopy(plan: PlansRecord | null, timezone: string): string {
  const allowance = sessionAllowanceFromRecord(plan);
  const planName = plan?.name?.trim() || 'Your plan';
  const resets = sessionQuotaResets({ timezone });
  if (allowance.cap === 0)
    return `${planName} does not log sessions. Yours resets on ${resets.label}.`;
  const perMonth = sessionsPerMonthLabel(allowance)
    .replace(/ a month$/i, '')
    .toLowerCase();
  return `${planName} logs ${perMonth} sessions a month. Yours resets on ${resets.label}.`;
}

export async function buildSessionsView(input: {
  client: Client;
  rider: UsersRecord;
}): Promise<SessionsView> {
  const { client, rider } = input;
  const timezone = rider.timezone || DEFAULT_TIMEZONE;

  const plan = rider.plan
    ? await records(client, 'plans').first('slug = {:slug}', { slug: rider.plan })
    : null;

  const [raw, quota] = await Promise.all([
    listAllOwnSessions(client, { userId: rider.id }),
    getSessionQuota(client, { userId: rider.id, plan, timezone }),
  ]);
  const sessions = sortSessionsNewestFirst(raw);

  const [spots, events, tricks, riders] = await Promise.all([
    spotsByIds(client, unique(sessions.map((s) => s.spotId))),
    eventsByIds(client, unique(sessions.map((s) => s.eventId))),
    tricksByIds(client, unique(sessions.flatMap((s) => s.trickEntries.map((e) => e.trickId)))),
    ridersByIds(client, unique(sessions.flatMap((s) => [...s.crewIds]))),
  ]);
  const names = {
    spots: new Map(spots.map((r) => [r.id, r])),
    events: new Map(events.map((r) => [r.id, r])),
    tricks: new Map(tricks.map((r) => [r.id, r])),
    riders: new Map(riders.map((r) => [r.id, r])),
  };

  const today = riderToday({ timezone });
  const currentMonthKey = riderMonthKey({ timezone });
  const month = sessionMonthSummary(sessions, currentMonthKey, timezone);
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

  const sidebar: SessionsSidebarView = {
    monthName: MONTH_NAMES[Number(currentMonthKey.slice(5, 7)) - 1] ?? '',
    sessions: month.sessions,
    time: sessionTimeLabel(month.minutes),
    stageMoves: month.stageMoves,
    spotsRidden: month.spotsRidden,
    streakLabel: weeklyStreakLabel(weeks),
    quota:
      quota.cap === null
        ? null
        : {
            line: sessionQuotaLine(quota),
            pips: sessionQuotaPips(quota),
            copy: quotaCopy(plan, timezone),
          },
    topSpots: topSpots(sessions, 4).map((top) => {
      const spot = names.spots.get(top.spotId);
      return {
        spotId: top.spotId,
        name: spot?.name ?? UNKNOWN_SPOT,
        href: spot && spot.status === 'live' && spot.slug ? spotHref(spot.slug) : null,
        count: top.count,
        bar: topSpotBarWidth(top.share),
      };
    }),
  };

  const sports = sessionFilterSports(
    rider.sports ?? [],
    sessions.map((s) => s.sport),
  );

  return {
    sessions: sessions.map((s) => cardView(s, names, timezone, today)),
    timezone,
    currentMonthKey,
    filterSports: sports.map((id: SportId) => ({ id, label: SPORTS[id].short })),
    sidebar,
  };
}
