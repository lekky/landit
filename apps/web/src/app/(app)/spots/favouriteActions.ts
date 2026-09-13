'use server';

import {
  favouriteSpot,
  listFavouriteSpotIds,
  listFavouriteSpots,
  unfavouriteSpot,
  type Client,
} from '@landit/db';

import { currentRider } from '@/lib/session';
import { spotFavouriteRefusalMessage } from '@/lib/spotRefusal';

import { toSpotView, type SpotView } from './view';

/**
 * Faving a spot, unfaving it, and reading back the list.
 *
 * **Nothing here decides who owns what.** The rider's own session client is the
 * only client these use, and every rule on `spot_favourites` is `OWN` — so a
 * request that skipped this file entirely could still only read and write its
 * own rows. The `user` on a create is overwritten from the token by
 * `pocketbase/hooks/60_ownership.pb.js`, so a body naming somebody else's id
 * writes a row belonging to the caller. This file adds no authority; it
 * translates.
 *
 * **A Server Function is a POST anybody can send**, so the spot id is checked
 * for shape here before the database sees it, and `64_spot_favourites.pb.js`
 * checks that it points at a spot the caller could have seen. Nothing throws to
 * the caller: a failure is a `{ error }` the screen can put in a sentence,
 * never a stack trace in a network tab.
 *
 * **The list is the truth, and the screen is told it on every change.** Both
 * actions hand back the whole id set rather than "it worked", so a heart that
 * was filled optimistically in the browser is corrected by the server's answer
 * a moment later — including the case that matters, a rider at the ceiling
 * whose new fave was refused. Two tabs disagreeing is then the shorter of two
 * disagreements rather than one that persists until a reload.
 *
 * **No `revalidatePath`.** Faves are per-rider state on a screen that is
 * otherwise the same for everybody, and a spots page rebuilt because one rider
 * tapped a heart is a cache thrown away for nothing. The screen keeps the
 * returned ids in its own state.
 */

const RECORD_ID = /^[a-z0-9]{15}$/;

const FAILED = 'That did not save. Try again in a moment.';
const SIGNED_OUT = 'Sign in to save a spot.';

export interface FavouritesResult {
  /** Every spot id this rider now holds, newest first. Empty when signed out. */
  readonly ids: string[];
  /** A sentence to show the rider, when something was refused. */
  readonly error?: string;
}

export interface FavouriteSpotsResult {
  readonly spots: SpotView[];
  readonly error?: string;
}

function readId(input: unknown): string | null {
  return typeof input === 'string' && RECORD_ID.test(input) ? input : null;
}

/**
 * Every id this rider holds, or an empty list when even that read failed.
 *
 * The ids read, not the spots: this is what fills a heart, and one read of the
 * rider's own small collection answers it. `favouriteSpotsAction` below is the
 * one that needs the spots themselves, and pays for the second read.
 */
async function idsFor(client: Client): Promise<string[]> {
  try {
    return await listFavouriteSpotIds(client);
  } catch {
    return [];
  }
}

/** Add a spot to the rider's faves, and hand back the list as it now stands. */
export async function favouriteSpotAction(input: unknown): Promise<FavouritesResult> {
  const session = await currentRider();
  if (!session) return { ids: [], error: SIGNED_OUT };

  const spotId = readId(input);
  if (!spotId) return { ids: [], error: FAILED };

  try {
    await favouriteSpot(session.client, session.rider.id, spotId);
  } catch (error) {
    /*
     * The hook's own sentences pass through; PocketBase's ("Failed to create
     * record.") never do — they are written for a developer, and this product
     * is read by children. `spotFavouriteRefusalMessage` is what draws the
     * line, matching against the list in `@landit/core`.
     *
     * The ids are still read back on a refusal, deliberately: the rider at the
     * ceiling needs the list to be right so they can remove one, and an empty
     * list here would blank every heart on the screen.
     */
    const said = spotFavouriteRefusalMessage(error);
    return { ids: await idsFor(session.client), error: said ?? FAILED };
  }

  return { ids: await idsFor(session.client) };
}

/** Take a spot off the rider's faves, and hand back the list as it now stands. */
export async function unfavouriteSpotAction(input: unknown): Promise<FavouritesResult> {
  const session = await currentRider();
  if (!session) return { ids: [], error: SIGNED_OUT };

  const spotId = readId(input);
  if (!spotId) return { ids: [], error: FAILED };

  try {
    await unfavouriteSpot(session.client, session.rider.id, spotId);
  } catch {
    return { ids: await idsFor(session.client), error: FAILED };
  }

  return { ids: await idsFor(session.client) };
}

/**
 * The rider's faves as cards.
 *
 * Spots rather than ids, because the faves view has to render places the list
 * on screen may never have loaded — a rider who faved a park in another county
 * and then searched for something else still gets their card. A spot that has
 * since come off the map is simply not in the answer (`getSpotsByIds` drops
 * what the caller may not read), so the view is shorter by one rather than
 * holding a card it cannot fill in.
 */
export async function favouriteSpotsAction(): Promise<FavouriteSpotsResult> {
  const session = await currentRider();
  if (!session) return { spots: [] };

  try {
    return { spots: (await listFavouriteSpots(session.client)).map(toSpotView) };
  } catch {
    return { spots: [], error: 'We could not load your faves just now. Try again in a moment.' };
  }
}
