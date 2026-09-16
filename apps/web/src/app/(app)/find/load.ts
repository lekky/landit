import { listFavouriteSpots, listOwnSessions, getSpotsByIds } from '@landit/db';

import { sessionsEnabledFor } from '@/lib/sessionsPreview';
import { currentRider, type RiderSession } from '@/lib/session';

import { loadEvents } from '../events/load';
import { toSpotView, type SpotView } from '../spots/view';
import { HUB_EVENTS, HUB_SPOTS, type FindData } from './view';

/**
 * Everything the Find hub renders on the server (rethink §3.7).
 *
 * **One session read for the whole page.** `currentRider()` re-checks the token
 * against PocketBase rather than decoding it, so it is a round trip; the hub
 * needs the calendar *and* the rider's own faves and recent spots, and reading
 * the session once and handing it to `loadEvents` is what keeps that at one.
 *
 * **The calendar comes from `loadEvents`, not from a fourth copy of it.** The
 * attendance join, the units and the country default are that file's, with the
 * comment above it explaining why three screens share one loader; a hub that
 * built its own would be the fourth place the "a visitor has no attendance to
 * fetch" rule could drift.
 *
 * **Nothing here is about where the rider is.** "Near you" resolves a position
 * in the browser and nowhere else (plan §6.4, standard 10) — the server's part
 * is only the *fallback*: the spots a rider has already told us they care
 * about, which is their faves and the places they have logged a session at.
 */

/** How far back "recent" reaches when looking for spots a rider has ridden. */
const RECENT_SESSIONS = 30;

export async function loadFind(): Promise<FindData> {
  const session = await currentRider();

  const [events, known] = await Promise.all([
    loadEvents('upcoming', null, { session }),
    session ? knownSpots(session) : Promise.resolve<readonly SpotView[]>([]),
  ]);

  const going = events.view.events.filter((event) => event.going).slice(0, HUB_EVENTS);
  const goingIds = new Set(going.map((event) => event.id));

  /*
   * "Coming up" opens on the reader's own country, for the reason `/events`
   * does: the calendar is two hundred-odd events across thirty countries, and a
   * hub that led with a jam in Chile for a rider in Corby would be a section
   * nobody reads twice. `defaultCountry` is already resolved — a declared
   * sign-up country, else `Accept-Language` — and is `''` for a reader the
   * calendar cannot place, which opens on the world exactly as `/events` does.
   *
   * **It widens rather than empties.** Where the reader's country has nothing
   * upcoming in it, the section falls back to the whole calendar rather than
   * showing an empty panel that looks like a product with no events in it. The
   * country line above the rows only appears when the narrowing actually held,
   * so it never claims a filter that is not on.
   */
  const notGoing = events.view.events.filter((event) => !goingIds.has(event.id));
  const inCountry = events.view.defaultCountry
    ? notGoing.filter((event) => event.country === events.view.defaultCountry)
    : [];
  const narrowed = inCountry.length > 0;

  return {
    signedIn: events.signedIn,
    units: events.units,
    going,
    coming: (narrowed ? inCountry : notGoing).slice(0, HUB_EVENTS),
    comingCountry: narrowed ? events.view.defaultCountry : '',
    known,
  };
}

/**
 * The spots this rider has already said something about: faves first, then the
 * ones they have logged a session at.
 *
 * Faves lead because they are the deliberate statement — a rider pressed a star
 * on that park — where a session spot is wherever they happened to ride. Both
 * come back through their own collections' rules, so nothing here widens what
 * the rider may read, and neither list is anybody else's.
 *
 * Sessions are only consulted where sessions are on for this rider
 * (`sessionsEnabledFor`, plan §7 T41): reading a preview feature's collection
 * to fill a section on a screen that does not otherwise mention it would put
 * the preview in front of riders who are not in it.
 */
async function knownSpots(session: RiderSession): Promise<readonly SpotView[]> {
  const [faves, sessions] = await Promise.all([
    listFavouriteSpots(session.client),
    sessionsEnabledFor(session.rider)
      ? listOwnSessions(session.client, { userId: session.rider.id, perPage: RECENT_SESSIONS })
      : Promise.resolve(null),
  ]);

  const spots = faves.slice(0, HUB_SPOTS).map(toSpotView);
  if (spots.length >= HUB_SPOTS || !sessions) return spots;

  const held = new Set(spots.map((spot) => spot.id));
  const wanted: string[] = [];
  for (const ride of sessions.items) {
    if (!ride.spotId || held.has(ride.spotId) || wanted.includes(ride.spotId)) continue;
    wanted.push(ride.spotId);
    if (spots.length + wanted.length >= HUB_SPOTS) break;
  }
  if (!wanted.length) return spots;

  /*
   * By id and in the order asked for, the same way the session form reads its
   * recent spots. A spot that has since been taken off the map simply does not
   * come back and the list is shorter by one — never a row with nothing in it.
   */
  const ridden = await getSpotsByIds(session.client, wanted);
  const byId = new Map(ridden.map((record) => [record.id, record]));
  return [
    ...spots,
    ...wanted.map((id) => byId.get(id)).flatMap((record) => (record ? [toSpotView(record)] : [])),
  ];
}
