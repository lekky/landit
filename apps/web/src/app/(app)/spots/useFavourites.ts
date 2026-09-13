'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { runActionOr } from '@/lib/runAction';

import {
  favouriteSpotAction,
  favouriteSpotsAction,
  unfavouriteSpotAction,
} from './favouriteActions';
import type { SpotView } from './view';

/**
 * A rider's favourite spots, as the screens hold them.
 *
 * A hook of its own rather than six more `useState`s in `SpotsScreen.tsx`,
 * which is already 1,600 lines carrying paging, the map, the points download
 * and "Near me". The spot page uses it too, for a single card, which is the
 * other reason it is not in the screen.
 *
 * **The server is the truth and every write returns it.** Both actions hand
 * back the whole id list, so the optimistic fill below is corrected a moment
 * later by what the server actually holds — including the case that matters, a
 * rider at the ceiling whose fave was refused. Nothing here has to guess what
 * the server did with a write.
 *
 * **Optimistic, because a heart that waits on a round trip reads as broken.**
 * The fill happens on the press; a refusal puts it back and says why. The
 * revert is the server's list rather than an undo of what this hook did, so two
 * tabs converge instead of fighting.
 *
 * **The cards are loaded once, and only when signed out is that skipped.** A
 * rider holds 200 favourites at the very most (`SPOT_FAVOURITE_MAX_HELD`), so
 * this is a small read — and it is what lets the faves view render a park in
 * another county that the list on screen has never loaded. It deliberately does
 * *not* wait for the points download that "Near me" needs: a rider should be
 * able to open their faves without paying for a map of the world (issue #472).
 */
export interface Favourites {
  /** Which spots are faved. Empty and never filled when signed out. */
  readonly ids: ReadonlySet<string>;
  /** Every fave as a card, newest first — the faves view's list. */
  readonly spots: readonly SpotView[];
  /** The first read has landed. Until then the hearts are not drawn at all. */
  readonly ready: boolean;
  /** Ids with a write in flight, so a control can say it is working. */
  readonly pending: ReadonlySet<string>;
  /** Something was refused, in words to show the rider. Cleared by the next press. */
  readonly error: string | null;
  /** Fave this spot, or unfave it if it already is. */
  readonly toggle: (spot: SpotView, source: FavouriteSource) => void;
  readonly dismissError: () => void;
}

/** Where a press came from. Fixed strings; the analytics events carry them. */
export type FavouriteSource = 'card' | 'spot_page' | 'faves';

const EMPTY: ReadonlySet<string> = new Set<string>();

export function useFavourites(signedIn: boolean): Favourites {
  const [ids, setIds] = useState<ReadonlySet<string>>(EMPTY);
  const [spots, setSpots] = useState<readonly SpotView[]>([]);
  const [ready, setReady] = useState(!signedIn);
  const [pending, setPending] = useState<ReadonlySet<string>>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  /*
   * Writes are serialised by id rather than cancelled: every reply carries the
   * whole list, so the last one to land is the truth and an older one landing
   * after it would put back a heart the rider has since changed. The ticket is
   * what makes "last" mean last.
   */
  const latest = useRef(0);

  /*
   * Signed out there is nothing to read and nothing to set: `ids` starts empty
   * and `ready` starts true, so the early return leaves the hook in exactly the
   * state a signed-out rider should see. Setting it here instead would be three
   * synchronous setStates inside an effect — a cascading render for a result
   * the initial state already had.
   */
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    void (async () => {
      const result = await runActionOr(
        'spots_faves',
        () => favouriteSpotsAction(),
        (message) => ({ spots: [], error: message }),
      );
      if (!live) return;
      // A failed read is not shown. The rider did not ask for this and has
      // nothing to do about it; the hearts stay empty and the next press is
      // where a real failure gets said out loud.
      if (!result.error) {
        setSpots(result.spots);
        setIds(new Set(result.spots.map((spot) => spot.id)));
      }
      setReady(true);
    })();
    return () => {
      live = false;
    };
  }, [signedIn]);

  /** Read the cards again, when the ids say we are missing one. */
  const refresh = useCallback(async (ticket: number) => {
    const result = await runActionOr(
      'spots_faves',
      () => favouriteSpotsAction(),
      (message) => ({ spots: [], error: message }),
    );
    if (result.error || ticket !== latest.current) return;
    setSpots(result.spots);
    setIds(new Set(result.spots.map((spot) => spot.id)));
  }, []);

  const toggle = useCallback(
    (spot: SpotView, source: FavouriteSource) => {
      if (!signedIn) {
        setError('Sign in to save a spot.');
        return;
      }
      const adding = !ids.has(spot.id);
      setError(null);

      /*
       * The optimistic move, on both lists at once. `spots` matters as much as
       * `ids` here: the faves view renders from it, so an unfave made *inside*
       * that view has to take the card off the screen immediately or the rider
       * presses a heart and watches nothing happen.
       */
      setIds((was) => {
        const next = new Set(was);
        if (adding) next.add(spot.id);
        else next.delete(spot.id);
        return next;
      });
      setSpots((was) =>
        adding
          ? [spot, ...was.filter((row) => row.id !== spot.id)]
          : was.filter((row) => row.id !== spot.id),
      );
      setPending((was) => new Set(was).add(spot.id));

      /*
       * `type` is the spot's kind and is a fixed catalogue word. Nothing else
       * from the spot is sent — not its name, its slug, its id, its town or
       * its country — because a favourite is the strongest statement this
       * product holds about where a rider actually rides, which is the thing
       * §6.4 standard 10 keeps out of every property.
       */
      capture(adding ? ANALYTICS_EVENTS.spotFavourited : ANALYTICS_EVENTS.spotUnfavourited, {
        source,
        type: spot.type || 'unknown',
      });

      const ticket = ++latest.current;
      void (async () => {
        /*
         * `ids: null` is "no reply at all" — `runActionOr`'s fallback for a
         * throw. It has to be distinguishable from the server's own empty
         * list, which is a real answer (a rider who just unfaved their last
         * one): treating a dead network as "you hold nothing" would blank
         * every heart on the screen for what is only a lost request.
         */
        const result = await runActionOr<{ ids: string[] | null; error?: string }>(
          'spot_favourite',
          () => (adding ? favouriteSpotAction(spot.id) : unfavouriteSpotAction(spot.id)),
          (message) => ({ ids: null, error: message }),
        );
        setPending((was) => {
          const next = new Set(was);
          next.delete(spot.id);
          return next;
        });
        if (ticket !== latest.current) return;
        if (result.error) setError(result.error);
        // Nothing came back, so there is nothing truer than what is on screen.
        if (result.ids === null) return;

        const held = result.ids;
        setIds(new Set(held));
        setSpots((was) => {
          const byId = new Map(was.map((row) => [row.id, row]));
          byId.set(spot.id, spot);
          return held.map((id) => byId.get(id)).filter((row): row is SpotView => !!row);
        });

        /*
         * An id we have never seen is a fave made somewhere else — another tab,
         * or the spot's own page — so the cards are read again rather than
         * leaving the faves view one short of its own count. Judged against the
         * ids held *before* this press, which is the set the cards on hand
         * match; rare, and one small read when it happens.
         */
        const known = new Set(ids);
        known.add(spot.id);
        if (held.some((id) => !known.has(id))) void refresh(ticket);
      })();
    },
    [ids, refresh, signedIn],
  );

  const dismissError = useCallback(() => setError(null), []);

  return useMemo(
    () => ({ ids, spots, ready, pending, error, toggle, dismissError }),
    [ids, spots, ready, pending, error, toggle, dismissError],
  );
}
