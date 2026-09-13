'use server';

import {
  SPORT_IDS,
  regionFromAcceptLanguage,
  spotCountryForRegion,
  spotFeature,
  type SportId,
} from '@landit/core';
import { getSpotsByIds, pageSpots, type SpotListQuery } from '@landit/db';
import { headers } from 'next/headers';

import { anonymousClient, currentRider } from '@/lib/session';

import { SPOTS_PAGE, toSpotView, type SpotView } from './view';

/**
 * The spots list, served a page at a time (issue #367).
 *
 * `/spots` used to put every live spot into the page — 1.34 MB of HTML once
 * France's census landed — so a rider on a phone downloaded and hydrated the
 * whole world's list to see twenty-four cards. These three actions are what
 * the screen calls instead: a page of the list under the current query, and
 * the cards for a handful of ids once they are on screen.
 *
 * **The point list is no longer one of them.** Every live spot's point used to
 * come back through `spotsPointsAction` here; it is now `GET /api/spots/points`
 * and `GET /api/spots/names`, because a Server Function is a POST and no
 * browser will ever cache one. See `lib/spotPoints.ts`.
 *
 * **Every input is a stranger's.** A server action is a POST anybody can
 * send, so the query is validated to the same fixed sets the page validates
 * `?feature=` against, the search is capped, the page number is bounded, and
 * ids are checked for shape before the database sees any of them. Nothing here
 * throws to the caller: a failure is a `{ error }` the screen can put in a
 * sentence, never a stack trace in a network tab.
 *
 * **Who is asking decides what comes back**, and it is decided by the
 * collection's rule, not here. The caller's own session client is used when
 * there is one, so a rider's own pending submission comes back to them by id
 * exactly as the list rule allows, and a stranger's pending one comes back to
 * nobody. The actions never widen that.
 *
 * **What the server learns.** The search text, the filters and — once "Near
 * me" is pressed — the ids of the nearest cards. Not the position: that is
 * sorted in the browser over the points, and only the ids of the winners
 * travel (plan §6.4, standard 10, amended 2026-09-08). None of this is an
 * analytics property; it is a request to our own server and nothing more.
 */

const MAX_SEARCH = 80;
const MAX_PAGE = 400;
/** Twice a page: a "Show more" that lands while cards are already in flight. */
const MAX_IDS = SPOTS_PAGE * 2;

export interface SpotsPageResult {
  readonly spots: SpotView[];
  readonly total: number;
  readonly error?: string;
}

export interface SpotsCardsResult {
  readonly spots: SpotView[];
  readonly error?: string;
}

const FAILED = 'We could not load the spots just now. Try again in a moment.';

async function clientFor() {
  const session = await currentRider();
  return {
    client: session?.client ?? anonymousClient(),
    region: session
      ? session.rider.country
      : regionFromAcceptLanguage((await headers()).get('accept-language')),
  };
}

/** The query as the screen sent it, reduced to values this repository knows. */
function readQuery(input: unknown): SpotListQuery {
  const raw = (input ?? {}) as Record<string, unknown>;
  const search = typeof raw.search === 'string' ? raw.search.slice(0, MAX_SEARCH) : '';
  const sport = SPORT_IDS.find((id) => id === raw.sport) ?? null;
  /*
   * The multi-select's chosen sports, reduced to `SPORT_IDS` the same way the
   * single one always was — a server action is a POST anybody can send, so
   * this is the fixed set and not the caller's list. Order and duplicates are
   * the caller's too, so the value is rebuilt from `SPORT_IDS` rather than
   * filtered in place: a hundred copies of `'bmx'` becomes one clause, and an
   * array of junk becomes the unfiltered query rather than a long one.
   */
  const sports = Array.isArray(raw.sports)
    ? SPORT_IDS.filter((id) => (raw.sports as unknown[]).includes(id))
    : [];
  const feature = typeof raw.feature === 'string' ? (spotFeature(raw.feature)?.id ?? null) : null;
  return { search, sport: sport as SportId | null, sports, feature };
}

/** One page of the list, the reader's country first. */
export async function spotsPageAction(input: unknown, page: unknown): Promise<SpotsPageResult> {
  const query = readQuery(input);
  const number = Math.min(MAX_PAGE, Math.max(1, Math.floor(Number(page)) || 1));
  try {
    const { client, region } = await clientFor();
    const result = await pageSpots(client, query, {
      home: spotCountryForRegion(region),
      page: number,
      perPage: SPOTS_PAGE,
    });
    return { spots: result.items.map(toSpotView), total: result.total };
  } catch {
    return { spots: [], total: 0, error: FAILED };
  }
}

/** The cards for these ids, in this order, minus any the caller may not read. */
export async function spotsCardsAction(input: unknown): Promise<SpotsCardsResult> {
  const ids = Array.isArray(input)
    ? input.filter((id): id is string => typeof id === 'string').slice(0, MAX_IDS)
    : [];
  if (!ids.length) return { spots: [] };
  try {
    const { client } = await clientFor();
    return { spots: (await getSpotsByIds(client, ids)).map(toSpotView) };
  } catch {
    return { spots: [], error: FAILED };
  }
}
