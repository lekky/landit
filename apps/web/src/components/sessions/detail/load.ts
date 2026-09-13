import {
  DEFAULT_TIMEZONE,
  STAGE,
  clipPlatformLabel,
  clipWatchUrl,
  sessionFeelColor,
  sessionFeelLabel,
  sessionWeatherLabel,
  sortSessionsNewestFirst,
  type ClipPlatformId,
  type RideSession,
  type SessionFeelId,
  type SessionVisibilityId,
  type SessionWeatherId,
  type SportId,
  type StageId,
} from '@landit/core';
import {
  getRider,
  getSession,
  getSpotsByIds,
  getTrickAward,
  listAllOwnSessions,
  listTricks,
  records,
  type EventsRecord,
  type TricksRecord,
} from '@landit/db';
import type { Route } from 'next';

import { eventHref, spotHref } from '@/lib/routes';
import {
  changeLines,
  crewChipName,
  crewStatValue,
  detailTrickNote,
  durationWords,
  pagerPosition,
  sessionDateLabels,
  tricksStatValue,
  visibilityCardCopy,
} from '@/lib/sessionDetail';
import { editSessionHref, isRecordId, sessionHref } from '@/lib/sessionRoutes';
import { currentRider } from '@/lib/session';
import { SPORT_LOOKS } from '@/lib/sports';

/**
 * Everything the session detail page (T39, 1e/2c) draws, read and formatted on
 * the server.
 *
 * **Every read is the viewer's own client** (`currentRider`), so the collection
 * rules decide what comes back and the enrich hook has already stripped "rode
 * with" to the riders this viewer may see (D3). Nothing here holds a superuser
 * client, and the crew chips are exactly what the session record returned —
 * never re-fetched some other way.
 *
 * **Everything that decorates is allowed to fail on its own** — the spot's
 * name, the event pill, a trick's sticker, a crew-mate's name, the diary behind
 * "What this one changed". A session page that cannot be served because a
 * second read failed is worse than one missing a pill.
 */

export interface DetailTrickRow {
  readonly key: string;
  readonly name: string;
  readonly href: Route | null;
  readonly note: string;
  readonly art: string | null;
  readonly move: {
    readonly from: { readonly label: string; readonly color: string } | null;
    readonly to: { readonly label: string; readonly color: string };
  } | null;
}

export interface SessionDetailView {
  readonly id: string;
  readonly isOwner: boolean;
  readonly editHref: Route | null;
  readonly dates: ReturnType<typeof sessionDateLabels>;
  readonly spot: { readonly name: string; readonly place: string; readonly href: Route | null };
  readonly event: { readonly name: string; readonly href: Route } | null;
  readonly sport: { readonly id: SportId; readonly label: string; readonly icon: string };
  readonly duration: string;
  readonly feel: { readonly id: SessionFeelId; readonly label: string; readonly color: string };
  readonly tricksStat: string;
  readonly crewStat: string;
  readonly clip: {
    readonly platform: ClipPlatformId;
    readonly label: string;
    readonly href: string;
  } | null;
  readonly changes: readonly string[];
  readonly aim: string | null;
  readonly notes: string | null;
  readonly tricks: readonly DetailTrickRow[];
  readonly crew: readonly {
    readonly id: string;
    readonly name: string;
    readonly avatarId: string;
  }[];
  readonly visibility: {
    readonly id: SessionVisibilityId;
    readonly title: string;
    readonly body: string;
  };
  readonly weather: { readonly id: SessionWeatherId; readonly label: string } | null;
  readonly pager: {
    readonly position: string | null;
    readonly newer: { readonly href: Route; readonly label: string } | null;
    readonly older: { readonly href: Route; readonly label: string } | null;
  };
}

export type SessionDetailLoad =
  | { readonly kind: 'signed-out' }
  | { readonly kind: 'missing' }
  | { readonly kind: 'ok'; readonly view: SessionDetailView };

function stageLook(id: StageId) {
  return { label: STAGE[id].label, color: STAGE[id].color };
}

/** An event by id, or `null` — live events only, which is what the rule lists. */
async function eventById(
  client: Parameters<typeof getSession>[0],
  id: string,
): Promise<EventsRecord | null> {
  try {
    return await records(client, 'events').get(id);
  } catch {
    return null;
  }
}

export async function loadSessionDetail(id: string): Promise<SessionDetailLoad> {
  const viewer = await currentRider();
  if (!viewer) return { kind: 'signed-out' };
  if (!isRecordId(id)) return { kind: 'missing' };

  const { client, rider } = viewer;
  const detail = await getSession(client, id);
  if (!detail) return { kind: 'missing' };

  const { session } = detail;
  const isOwner = session.userId === rider.id;
  // The viewer's clock: it is their screen. For the owner it is also the clock
  // the session was logged on.
  const timezone = rider.timezone || DEFAULT_TIMEZONE;

  const [spots, event, trickRows, crewRows, diary] = await Promise.all([
    session.spotId ? getSpotsByIds(client, [session.spotId]).catch(() => []) : Promise.resolve([]),
    session.eventId ? eventById(client, session.eventId) : Promise.resolve(null),
    session.trickEntries.length
      ? listTricks(client).catch((): TricksRecord[] => [])
      : Promise.resolve([] as TricksRecord[]),
    Promise.all(session.crewIds.map((crewId) => getRider(client, crewId).catch(() => null))),
    isOwner
      ? listAllOwnSessions(client, { userId: rider.id }).catch((): RideSession[] | null => null)
      : Promise.resolve(null),
  ]);

  const trickById = new Map(trickRows.map((row) => [row.id, row]));
  const arts = await Promise.all(
    session.trickEntries.map((entry) => {
      const row = trickById.get(entry.trickId);
      return row ? getTrickAward(client, row.slug).catch(() => null) : Promise.resolve(null);
    }),
  );

  const spot = spots[0];
  const trickName = (trickId: string) => trickById.get(trickId)?.name ?? 'A trick';

  const ordered = diary ? sortSessionsNewestFirst(diary) : null;
  const dateOf = (sessionId: string | null) => {
    const found = sessionId ? ordered?.find((s) => s.id === sessionId) : undefined;
    return found ? sessionDateLabels(found.startedAt, timezone).dayMonth : null;
  };

  const crew = crewRows
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .map((row) => ({ id: row.id, name: crewChipName(row.name || ''), avatarId: row.avatar_key }));

  const look = SPORT_LOOKS[session.sport] ?? SPORT_LOOKS.scooter;

  const view: SessionDetailView = {
    id: session.id,
    isOwner,
    editHref: isOwner ? editSessionHref(session.id) : null,
    dates: sessionDateLabels(session.startedAt, timezone),
    spot: {
      name: spot?.name || 'A spot not on the map',
      place: [spot?.town, spot?.country].filter(Boolean).join(', '),
      // Only a live spot has a page; a rider's own pending submission does not.
      href: spot && spot.status === 'live' && spot.slug ? spotHref(spot.slug) : null,
    },
    event: event ? { name: event.name, href: eventHref(event.slug) } : null,
    sport: { id: session.sport, label: look.label, icon: look.icon },
    duration: durationWords(session.durationMinutes),
    feel: {
      id: session.feel,
      label: sessionFeelLabel(session.feel),
      color: sessionFeelColor(session.feel),
    },
    tricksStat: tricksStatValue(session.trickEntries),
    crewStat: crewStatValue(crew.map((c) => c.name)),
    clip: session.clip
      ? {
          platform: session.clip.platform,
          label: clipPlatformLabel(session.clip.platform),
          href: clipWatchUrl(session.clip),
        }
      : null,
    changes: changeLines(session, diary, trickName, { isOwner, timezone }),
    aim: session.aim?.trim() || null,
    notes: session.notes?.trim() || null,
    tricks: session.trickEntries.map((entry, i) => {
      const row = trickById.get(entry.trickId);
      return {
        key: entry.trickId,
        name: row?.name ?? 'A trick',
        href: row ? (`/library/${encodeURIComponent(row.slug)}` as Route) : null,
        note: detailTrickNote(entry),
        // `img` is a file name; the art is served from `public/stickers`, as the trick page does.
        art: arts[i]?.img ? `/stickers/${arts[i]!.img}` : null,
        move: entry.stageTo
          ? {
              from: entry.stageFrom ? stageLook(entry.stageFrom) : null,
              to: stageLook(entry.stageTo),
            }
          : null,
      };
    }),
    crew,
    visibility: { id: session.visibility, ...visibilityCardCopy(session.visibility) },
    weather: session.weather
      ? { id: session.weather, label: sessionWeatherLabel(session.weather) }
      : null,
    pager: {
      position: ordered
        ? (pagerPosition(
            ordered.map((s) => s.id),
            session.id,
          )?.label ?? null)
        : null,
      newer: detail.newerId
        ? { href: sessionHref(detail.newerId), label: dateOf(detail.newerId) ?? 'Newer' }
        : null,
      older: detail.olderId
        ? { href: sessionHref(detail.olderId), label: dateOf(detail.olderId) ?? 'Older' }
        : null,
    },
  };

  return { kind: 'ok', view };
}
