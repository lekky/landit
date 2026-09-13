'use client';

import {
  spotCredits,
  distanceLabelIn,
  filterSpots,
  hasCoords,
  mapsLink,
  sortSpotsByDistance,
  spotFeature,
  spotsInBounds,
  type DistanceUnits,
  type MapBounds,
  type SportId,
} from '@landit/core';
import type { SpotPoint } from '@landit/db';
import { Button, Empty, Icon, Panel, Pill, SportChip, Tag } from '@landit/ui-web';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { runActionOr } from '@/lib/runAction';
import { sportFilterProperty } from '@/lib/sportFilter';

import { SportFilter } from '@/components/filters/SportFilter';
import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { reportHref, spotHref } from '@/lib/routes';
import { SPORT_LOOKS } from '@/lib/sports';
import { useSport } from '@/providers/sport';

import { AddSpotForm } from './AddSpotForm';
import { SpotMap } from './SpotMap';
import { spotsCardsAction, spotsPageAction, spotsPointsAction } from './listActions';
import { useHereOnce } from '@/lib/useHereOnce';
import styles from './spots.module.css';
import { SPOTS_PAGE, fromPointTuple, type SpotView } from './view';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * "councils, venues and OpenStreetMap (Open Database Licence); the French
 * Ministry of Sport’s equipment census via data.gouv.fr (Licence Ouverte 2.0,
 * updated 8 September 2026); OpenStreetMap contributors (…); GeoNames (CC BY
 * 4.0)". Every source the catalogue says must be named, in its order, then
 * every dataset those sources draw on (`spotCredits`). The date is spelled from a fixed table rather than a locale:
 * this screen hydrates, and nothing on it may be locale-derived (LESSONS §5).
 */
function creditLine(): string {
  return spotCredits()
    .map((source) => {
      const terms = [source.licenceName];
      const day = source.snapshot ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(source.snapshot) : null;
      if (day) terms.push(`updated ${Number(day[3])} ${MONTHS[Number(day[2]) - 1]} ${day[1]}`);
      return `${source.name} (${terms.join(', ')})`;
    })
    .join('; ');
}

export type { SpotView } from './view';

/** How many spots a press reveals. See `SPOTS_PAGE`. */
const PAGE = SPOTS_PAGE;

/** How long a search box may go quiet before it asks the server. */
const SEARCH_DEBOUNCE_MS = 250;

/**
 * The width below which the map is a sheet rather than a column.
 *
 * **The same 860px the stylesheet uses, and the duplication is the point of
 * this comment.** CSS owns the layout and always will; this copy exists so the
 * two things JavaScript has to decide — whether an Escape means anything, and
 * whether an opened map is worth counting — agree with what a rider can
 * actually see. Change one and change the other: `spots.module.css` has the
 * matching `@media (max-width: 860px)` block, and `mobile map sheet` in
 * `e2e/spots.spec.ts` fails if they drift apart at the boundary.
 */
const SHEET_WIDTH = '(max-width: 860px)';

/**
 * The list query, as one string, so "did it change" is one comparison.
 *
 * The sports are joined in `SPORT_IDS` order — `SportFilter` hands them over
 * that way whatever order they were pressed in — so choosing scooter then BMX
 * and choosing BMX then scooter are the same query and do not refetch.
 */
function queryKey(search: string, sports: readonly SportId[], feature: string | null): string {
  return `${search.trim().toLowerCase()}|${sports.join('+')}|${feature ?? ''}`;
}

/** What the server has handed over so far for one query. */
interface Loaded {
  readonly key: string;
  readonly spots: readonly SpotView[];
  readonly total: number;
  readonly page: number;
}

/**
 * Where to ride: the list, the map, and the two staying in step (screenshot 19).
 *
 * **Selection is one piece of state and both halves read it.** A card click and
 * a pin click call the same setter; the map flies to whatever is selected and
 * the list scrolls it into view. That is the whole of "selection sync", and it
 * only works because neither side owns it — the moment the map kept its own
 * idea of the selected spot there would be two, and they would disagree the
 * first time a filter removed the selected one from the list.
 *
 * **The list comes a page at a time, from the server** (issue #367). The
 * screen used to hold every live spot and filter it in memory; at three and a
 * half thousand rows that was 1.34 MB of page. Now it holds what it has been
 * handed: the first page from the server render, and each further page,
 * search or filter from `listActions.ts`. Two modes, one list:
 *
 * - **Home-first**, the default. The query is the search, the sport pill and
 *   the feature pill; the server sorts the reader's country ahead of the rest
 *   and pages it. "Show more" asks for the next page and appends.
 * - **Nearest-first**, while a position is held. Distance is sorted here, in
 *   the browser, over a compact list of every live spot's point — fetched once
 *   when the position first arrives — and the same query narrows that list
 *   with the same `filterSpots` the server mirrors. The cards for the
 *   nearest screenful are then fetched by id. That request is the one thing
 *   about "Near me" that reaches our server (plan §6.4, standard 10, amended
 *   2026-09-08): never the position, only the ids the position chose.
 * - **This area**, while a view of the map is held — "Search this area",
 *   offered on the map once the rider has moved it (2026-09-11). The same
 *   points, the same query, cut to the view by `spotsInBounds` and ordered
 *   from its middle, and the same cards-by-id request. The view never leaves
 *   the browser either, for the position's own reason: a map nobody has moved
 *   sits over the rider's nearest spots. It wins over nearest-first while it
 *   is held, and "Near me" or its own pill ends it.
 *
 * A reply that arrives for a query the rider has since left is dropped, so
 * a slow search cannot overwrite a fast one.
 *
 * **The rider's location never leaves this component** in either mode. It is
 * held in React state, shown while it is held, and dropped on the next
 * navigation — there is no `localStorage` write, no cookie, no field on `users`,
 * and no request carries it. See `useHereOnce`.
 *
 * **This screen opens nearest-first when the browser already allows it**
 * (Rachid, 2026-08-30, in chat; §6.4 standard 10 amended in the same change).
 * `resumeWhenGranted` reads a position on load *only* where the Permissions API
 * answers `granted` — a state the rider put their own browser into on an
 * earlier press — so a rider who has said yes once is not made to say it again
 * on every visit to find their nearest park. Where the answer is `prompt`,
 * `denied`, or a browser that will not answer at all, **nothing happens**: no
 * dialog is put in front of a child who did not ask for one, and the "Near me"
 * control below is unchanged. The indicator and its "Turn off" are the same
 * either way, which is what makes the resume defensible rather than quiet.
 */
export function SpotsScreen({
  initialSpots,
  initialTotal,
  countsBySport,
  ownSpots,
  signedIn,
  units,
  initialFeature = null,
}: {
  /** The first page, rendered on the server unfiltered but for `initialFeature`. */
  readonly initialSpots: readonly SpotView[];
  /** How many spots that first query matches in all. */
  readonly initialTotal: number;
  /** Live spots per sport, over the whole collection, for the filter pills' counts. */
  readonly countsBySport: Readonly<Record<string, number>>;
  /** The rider's own submissions that are not on the map: pending or turned down. */
  readonly ownSpots: readonly SpotView[];
  readonly signedIn: boolean;
  /** Miles or kilometres, settled on the server from the rider's country. */
  readonly units: DistanceUnits;
  /**
   * A feature tag the list opens narrowed to — `/spots?feature=flat`, from a
   * trick page's "Where to practise" line (T31). Already validated by the
   * page; `null` is the plain list.
   */
  readonly initialFeature?: string | null;
}) {
  /*
   * The rider's own sports, and only for the "Add a spot" form's default ticks.
   * The list is no longer filtered by the global switch — see the filter row.
   */
  const { sports: ownSports } = useSport();

  const [search, setSearch] = useState('');
  /*
   * The search the list is actually asked for lags the box by a beat. Every
   * keystroke used to filter an in-memory list; now it is a request, and a
   * request per keystroke is a queue of stale answers racing each other.
   */
  const [settledSearch, setSettledSearch] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setSettledSearch(search), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  /*
   * The feature narrowing is client state seeded from the URL, like nothing
   * else on this screen — and that is deliberate. The rider arrived here to
   * see one kind of spot, and the pill below is how they widen it again; the
   * URL is not rewritten when they do, because "the plain list" already has
   * an address and this one is only ever arrived at from a link.
   */
  const [feature, setFeature] = useState<string | null>(initialFeature);
  const featureLabel = feature ? (spotFeature(feature)?.label ?? feature) : null;
  /*
   * Which sports the list is narrowed to. **Empty is every spot, and empty is
   * where it opens** (Rachid, 2026-09-12, in chat).
   *
   * It used to be `everySport`, a boolean starting `false` — so the screen
   * opened filtered to whatever sport the global switch was on, and the only
   * way to another sport was to change that switch, which changed home, the
   * library and progress with it. On a rider who records one sport the switch
   * is not rendered at all (`SportSwitch` needs two), so the other sports'
   * spots were unreachable. See `SportFilter`.
   */
  const [sports, setSports] = useState<readonly SportId[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /*
   * Whether the map sheet is up. **Only a phone can see this** — the sheet
   * exists inside one media query and on a wide screen the map is a column that
   * is always there, so on desktop this flag is set and read and changes
   * nothing. See `SHEET_WIDTH` and the `.mapPanel` rules.
   */
  const [mapOpen, setMapOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  /*
   * Whether the sheet has come up at least once on this visit — which, on a
   * phone, is what decides whether the map exists at all.
   *
   * **On the sheet width the map is not built until the sheet first opens**
   * (issue #374). The closed sheet waits below the screen, translated out of
   * sight, and under WebKit — Safari, and so every browser on an iPhone — a
   * MapLibre canvas *built* inside that off-screen layer never paints once the
   * layer slides into view: the pins, the zoom buttons and the credit arrive,
   * and the ground under them stays blank through zooming, waiting, a
   * Plain/Detail swap and a close and reopen. Chromium draws it, which is why
   * only iPhones saw it. The 2026-09-08 mobile audit took the suspects away
   * one at a time — the slide, `position: fixed`, the scrim, the page hold,
   * and hiding the panel with `display: none` instead — and each was still
   * blank; the one build that painted was a build that ran with the panel on
   * screen. So on a phone the map is built on screen, the
   * first time a rider asks for it, and then kept: a map built on screen
   * paints again when the sheet comes back, so a close and reopen does not
   * rebuild it.
   *
   * The column never waits. `isSheet` is false on the server and on the first
   * render, so a wide screen builds its map on load exactly as it always has,
   * and a phone renders the same markup to hydrate against and drops it on the
   * next render, once it knows it is a phone — the build effect's own cleanup
   * takes anything it had begun with it.
   *
   * Set during render rather than in an effect — React's "adjust state when a
   * prop changes" pattern, as `lastKey` below — so the render that opens the
   * sheet is the one that mounts the map, not the one after it.
   */
  const [everOpened, setEverOpened] = useState(false);
  if (mapOpen && !everOpened) setEverOpened(true);

  /*
   * The view of the map the list is narrowed to, once "Search this area" has
   * been pressed — `null` is every area. Held here rather than in the map
   * because the list is what it changes; the map only offers the button. Like
   * the position it is state and nothing more: never in the URL, never in a
   * request, never a property of an event.
   */
  const [area, setArea] = useState<MapBounds | null>(null);

  /*
   * Whether the map panel is currently *a sheet* — the same `SHEET_WIDTH` the
   * Escape handler and the open count already ask about, but held in state
   * because three of the things the sheet now does cannot be written in CSS:
   * the page has to be held still behind it, the map has to be told to take
   * one-finger drags, and the map is not built until the sheet first opens
   * (`everOpened`, #374).
   *
   * **False on the server and on the first client render, deliberately.**
   * Measuring a viewport during render is a first paint that is a guess and a
   * correction after hydration (LESSONS §5), which is why every *presentational*
   * choice on this screen is a media query and stays one. Nothing here is
   * presentational: the sheet cannot be open on the first render — a rider has
   * to press something — so by the time either of these is read this has been
   * true for many frames.
   */
  const [isSheet, setIsSheet] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(SHEET_WIDTH);
    const read = () => setIsSheet(query.matches);
    read();
    // Rotating a phone crosses this line, and a sheet that stayed modal on the
    // wide side of it would hold a page nothing is covering.
    query.addEventListener('change', read);
    return () => query.removeEventListener('change', read);
  }, []);

  const here = useHereOnce({ resumeWhenGranted: true });

  /*
   * Nearest-first happened — counted once per position held, not per render.
   *
   * `source` is what makes the number worth having: it separates the riders who
   * pressed "Near me" on this visit from the ones a standing browser permission
   * served silently, which is the only evidence there is that the resume earns
   * its place. `screen` keeps this list's funnel apart from the calendar's,
   * which fires the same event. Nothing else travels. The position is not a property and never
   * may be — it is the one rider fact §6.4 standard 10 says we do not keep, so
   * an event carrying it would undo the screen it is measuring.
   */
  const counted = useRef(false);
  useEffect(() => {
    if (here.state !== 'on') {
      counted.current = false;
      return;
    }
    if (counted.current) return;
    counted.current = true;
    capture(ANALYTICS_EVENTS.nearbySortUsed, {
      screen: 'spots',
      source: here.resumed ? 'resumed' : 'pressed',
    });
  }, [here.state, here.resumed]);

  /* ------------------------------------------------------- the query -- */

  const key = queryKey(settledSearch, sports, feature);

  /*
   * Every reply is checked against the request that is *current* when it
   * lands. A number rather than an `AbortController` because a server action
   * cannot be aborted; it can only be ignored, and this is how.
   */
  const latest = useRef(0);
  const [error, setError] = useState<string | null>(null);

  /*
   * The cards this screen has ever been handed, by id — every page from the
   * server and every card fetched for nearest-first — so a rider who presses
   * "Near me" after paging finds most of the nearest cards already in hand.
   * `null` is an id that was asked for and not answered: a spot the caller
   * may not read, remembered so it is neither asked for again nor waited on.
   * Written only when a reply lands, never inside an effect's own tick.
   */
  const [cards, setCards] = useState<ReadonlyMap<string, SpotView | null>>(
    () => new Map(initialSpots.map((spot) => [spot.id, spot])),
  );
  const remember = useCallback((spots: readonly SpotView[], asked: readonly string[] = []) => {
    setCards((was) => {
      const next = new Map(was);
      for (const id of asked) if (!next.has(id)) next.set(id, null);
      for (const spot of spots) next.set(spot.id, spot);
      return next;
    });
  }, []);

  /* ---------------------------------------------------- home-first mode -- */

  const [loaded, setLoaded] = useState<Loaded>(() => ({
    // The server renders the unfiltered first page, which is the query the
    // screen opens on — so there is no swap on hydration any more.
    key: queryKey('', [], initialFeature),
    spots: initialSpots,
    total: initialTotal,
    page: 1,
  }));

  /**
   * Ask the server for a page of the current query. `append` is a "Show more";
   * otherwise the reply replaces the list. The reply is ignored if the query
   * moved on while it was in flight.
   */
  const fetchPage = useCallback(
    async (forKey: string, page: number, append: boolean) => {
      const ticket = ++latest.current;
      // A read, but the same hole: a thrown fetch skipped `setError` below and
      // left the list simply stopped, with nothing on screen saying why.
      const result = await runActionOr(
        'spots_page',
        () => spotsPageAction({ search: settledSearch, sports, feature }, page),
        // The empty page beside the message is what the type asks for; the
        // branch below reads `error` first and never gets as far as it.
        (error) => ({ error, spots: [], total: 0 }),
      );
      if (ticket !== latest.current) return;
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      remember(result.spots);
      setLoaded((was) => ({
        key: forKey,
        spots: append && was.key === forKey ? [...was.spots, ...result.spots] : result.spots,
        total: result.total,
        page,
      }));
    },
    [settledSearch, sports, feature, remember],
  );

  const nearMode = here.point !== null;
  const areaMode = area !== null;
  /** The two modes that sort in the browser over the points rather than asking for pages. */
  const pointsMode = nearMode || areaMode;

  /*
   * A "Show more" in flight. The *first* page of a query needs no flag of its
   * own: the list is loading exactly while `loaded.key` is behind `key`, which
   * is a fact about state already held rather than a second copy of it.
   */
  const [morePending, setMorePending] = useState(false);

  // The query changed under the list: fetch its first page. Not while a
  // position or an area is held — those modes have their own list and never
  // ask for pages. Sent from a timer rather than the effect's own tick, so a
  // query that changes again before the tick ends — a fast typist beating the
  // debounce — is cancelled here and never leaves the browser.
  useEffect(() => {
    if (pointsMode || loaded.key === key) return;
    const timer = window.setTimeout(() => void fetchPage(key, 1, false), 0);
    return () => window.clearTimeout(timer);
  }, [pointsMode, loaded.key, key, fetchPage]);

  /* -------------------------------------------------- nearest-first mode -- */

  /*
   * Every live spot as a point, fetched once and kept for the rest of the
   * visit — the first time a position or an area is held, or the first time
   * the map is on screen, whichever comes first.
   *
   * **The map is the new reason** (issue #388; owner, 2026-09-11): it draws
   * every matching spot from these, clustered. On a wide screen the map is a
   * column that is always there, so that is on load; on a phone it is the
   * first time the sheet comes up, and a rider who never opens it never pays.
   * Still never in the page's own HTML, which is what #367 took out.
   *
   * `isSheet` lags the first commit by design (see its note), so the width is
   * also read directly here: a phone must not fetch on the render before the
   * screen has learnt it is a phone.
   */
  const [points, setPoints] = useState<readonly SpotPoint[] | null>(null);
  const pointsAsked = useRef(false);
  useEffect(() => {
    if (points || pointsAsked.current) return;
    const sheet = isSheet || window.matchMedia(SHEET_WIDTH).matches;
    if (!pointsMode && sheet && !mapOpen) return;
    pointsAsked.current = true;
    // Only a list that is waiting on these says so when they fail. The map on
    // its own falls back to the cards on screen, which is what it drew before.
    const listWaiting = pointsMode;
    void (async () => {
      const result = await runActionOr('spots_points', spotsPointsAction, (error) => ({
        error,
        points: [],
      }));
      if (result.error) {
        pointsAsked.current = false;
        if (listWaiting) setError(result.error);
        else console.warn('[spots] every spot could not be loaded; the map shows the list');
        return;
      }
      setPoints(result.points.map(fromPointTuple));
    })();
  }, [pointsMode, points, isSheet, mapOpen]);

  /**
   * Every live spot under the query, once the points are in: what the map
   * draws (issue #388), and what both orderings below start from.
   */
  const matchingPoints = useMemo(
    () => (points ? filterSpots(points, { search: settledSearch, sports, feature }) : null),
    [points, settledSearch, sports, feature],
  );

  /** The nearest-first list, narrowed by the same query, as ids in order. */
  const nearIds = useMemo(() => {
    if (!here.point || !matchingPoints) return null;
    return sortSpotsByDistance(matchingPoints, here.point).map((point) => point.id);
  }, [here.point, matchingPoints]);

  /**
   * The spots inside the searched view, under the same query, nearest its
   * middle first. Wins over `nearIds` while it is held: the rider asked about
   * a place, and it is not where they are.
   */
  const areaIds = useMemo(() => {
    if (!area || !matchingPoints) return null;
    return spotsInBounds(matchingPoints, area).map((point) => point.id);
  }, [area, matchingPoints]);

  /** Whichever list is ordered in the browser, if either is — area first. */
  const orderedIds = areaIds ?? nearIds;

  /*
   * The list is shown a screenful at a time (2026-08-18, owner: "maybe need
   * pagination?").
   *
   * **A "show more" rather than numbered pages, and the map is why.** The two
   * halves of this screen share one selection and the map's own footer promises
   * that everything on the list is on it. Numbered pages would break that
   * promise every time the map redrew — a rider tapping a pin for a spot on
   * page 3 would land on a card that is not rendered, and the scroll-into-view
   * would silently do nothing. Growing one list keeps list and map the same set
   * at every moment.
   */
  const [shown, setShown] = useState(PAGE);

  /*
   * Reset the page when the list underneath it changes, during render rather
   * than in an effect — an effect would paint the old count first, so a rider
   * who searched from the bottom of a long list would see a flash of results
   * they had already scrolled past. This is React's documented "adjust state
   * when a prop changes" pattern; the extra render is discarded before paint.
   */
  const mode = area
    ? `area:${area.south},${area.west},${area.north},${area.east}`
    : nearMode
      ? 'near'
      : 'home';
  const listKey = `${key}|${mode}`;
  const [lastKey, setLastKey] = useState(listKey);
  if (listKey !== lastKey) {
    setLastKey(listKey);
    setShown(PAGE);
    setSelectedId(null);
  }

  /*
   * The nearest screenful's cards, for whichever are not yet in hand. Each id
   * is in flight at most once — `inFlight` is what stops the same ids being
   * asked for again on every render while the reply is on its way — and a
   * reply that no longer matches the screenful, because the rider searched
   * while it flew, is dropped like a page.
   */
  const wantedIds = useMemo(() => orderedIds?.slice(0, shown) ?? [], [orderedIds, shown]);
  const inFlight = useRef(new Set<string>());
  useEffect(() => {
    const missing = wantedIds.filter((id) => !cards.has(id) && !inFlight.current.has(id));
    if (!missing.length) return;
    for (const id of missing) inFlight.current.add(id);
    const ticket = ++latest.current;
    void (async () => {
      const result = await runActionOr(
        'spots_cards',
        () => spotsCardsAction(missing),
        (error) => ({
          error,
          spots: [],
        }),
      );
      for (const id of missing) inFlight.current.delete(id);
      if (ticket !== latest.current) return;
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      remember(result.spots, missing);
    })();
  }, [wantedIds, cards, remember]);

  /* ----------------------------------------------------------- the list -- */

  /**
   * What is on screen, whichever mode. In nearest-first and this-area the
   * cards are looked up by id, and one still in flight is simply not there
   * yet; in home-first they are the pages in the order the server sent them.
   */
  const visible = useMemo<readonly SpotView[]>(() => {
    if (orderedIds) {
      return wantedIds.map((id) => cards.get(id)).filter((spot): spot is SpotView => !!spot);
    }
    return loaded.spots;
  }, [orderedIds, wantedIds, cards, loaded.spots]);

  /** How many match the query in all, and how many are not yet on screen. */
  const total = orderedIds ? orderedIds.length : loaded.total;
  const more = Math.max(0, total - (orderedIds ? shown : loaded.spots.length));

  /** Something asked for is still on its way. Derived, so it cannot go stale. */
  const loading = orderedIds
    ? wantedIds.some((id) => !cards.has(id))
    : morePending || (!pointsMode && loaded.key !== key);

  const showMore = useCallback(() => {
    if (orderedIds) {
      setShown((count) => count + PAGE);
      return;
    }
    setMorePending(true);
    void fetchPage(key, loaded.page + 1, true).finally(() => setMorePending(false));
  }, [orderedIds, fetchPage, key, loaded.page]);

  /*
   * Waiting on the world, in words the count line can carry: the points for
   * the first nearest-first sort, or a page. Distinct, because the first can
   * take a second on a phone and "loading" alone reads as broken.
   */
  const waiting =
    pointsMode && !points
      ? areaMode
        ? 'searching this area'
        : 'finding the nearest'
      : loading
        ? 'loading'
        : null;

  /**
   * The cards on screen that have a location. No longer what the map draws —
   * that is `mapSpots` — but what its camera frames, so the map still opens on
   * the list a rider can see rather than on the whole world, and what it draws
   * until the points arrive.
   */
  const plotted = useMemo(() => visible.filter(hasCoords), [visible]);

  /**
   * What the map draws: every spot matching the query once the points are in
   * (issue #388; owner, 2026-09-11, in chat), clustered by `SpotMap` where they
   * crowd — and the cards on screen until then, which is what it drew before.
   */
  const mapSpots = useMemo(() => matchingPoints ?? plotted, [matchingPoints, plotted]);
  const mapIds = useMemo(() => new Set(mapSpots.map((spot) => spot.id)), [mapSpots]);

  /*
   * Derived, not stored — which is what makes a filter that hides the selected
   * spot harmless. The id stays in state and counts as chosen only while its
   * spot is on the map; a search that hides it takes the pin and the header
   * together, and clearing the search brings both back. Reconciling the id in
   * an effect instead would be a cascading render for a worse outcome.
   *
   * **A pin can now choose a spot whose card is not on screen** (#388), so the
   * pin is marked at once from the id, and the header — which needs the card —
   * fills in when the card lands from the request below.
   */
  const mapSelectedId = selectedId && mapIds.has(selectedId) ? selectedId : null;
  const selected = useMemo(() => {
    const card = mapSelectedId ? cards.get(mapSelectedId) : null;
    return card && hasCoords(card) ? card : null;
  }, [mapSelectedId, cards]);

  /*
   * The chosen spot's card, when a pin chose a spot the list has not handed
   * over. Deliberately outside the list's own ticket (`latest`): a card for an
   * id is the same whatever the query, so there is nothing for it to be stale
   * against — and a reply dropped as stale would leave the header empty for
   * good. Same request, same rule, as the nearest-first cards (§6.4 standard 10
   * as amended 2026-09-08): an id, never a position.
   */
  useEffect(() => {
    if (!mapSelectedId || cards.has(mapSelectedId) || inFlight.current.has(mapSelectedId)) return;
    const id = mapSelectedId;
    inFlight.current.add(id);
    void (async () => {
      const result = await runActionOr(
        'spots_cards',
        () => spotsCardsAction([id]),
        (error) => ({ error, spots: [] }),
      );
      inFlight.current.delete(id);
      if (result.error) {
        setError(result.error);
        return;
      }
      remember(result.spots, [id]);
    })();
  }, [mapSelectedId, cards, remember]);

  const cardNodes = useRef(new Map<string, HTMLElement>());
  const select = useCallback((id: string, via: 'card' | 'pin') => {
    setSelectedId(id);
    /*
     * **Choosing a spot brings the map to it, rather than leaving a rider to go
     * looking** (owner, 2026-08-31: "clicking a spot should show the map, not
     * make the user guess").
     *
     * On a phone the map panel was the last thing on the page — measured at
     * 6,435px down a 7,642px document on a 375×780 screen, below all 24 cards,
     * and *further* away with every press of "Show more". So a rider tapped
     * "Show on map", nothing they could see happened, and the thing they asked
     * for was eight screens south. This is the flag that lifts it.
     */
    setMapOpen(true);
    // `nearest` so choosing a card you are already looking at does not jump the
    // page; a pin click on a card further down does scroll it into view. The
    // cards carry a `scroll-margin-bottom` on narrow screens so this never
    // parks the chosen one underneath the sheet.
    cardNodes.current.get(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    /*
     * Counted, because this gesture just got smaller. The whole card used to
     * select the map; the card is now a link to the spot's page (design
     * handoff, "the conflict and the resolution"), so selecting has shrunk to a
     * button in the footer and a pin. `via` separates the two, and nothing
     * about the spot or the rider travels — the catalogue rule in
     * `analytics.ts` rules out the name and the slug, and standard 10 rules out
     * a position.
     */
    capture(ANALYTICS_EVENTS.spotMapSelected, { via });
  }, []);

  /*
   * Stable, so the map's marker effect runs when the list changes rather than
   * on every render of this screen — each run re-frames the camera, and an
   * inline arrow here made that every keystroke.
   */
  const selectPin = useCallback((id: string) => select(id, 'pin'), [select]);

  /*
   * "Search this area", pressed on the map. The map reads the view off its
   * camera and hands it here; the list does the rest. Counted with the one
   * thing worth knowing about where it was pressed — over the list on a phone
   * or beside it — and nothing about the view (see `spotsAreaSearched`).
   */
  const searchArea = useCallback(
    (bounds: MapBounds) => {
      setArea(bounds);
      capture(ANALYTICS_EVENTS.spotsAreaSearched, { view: isSheet ? 'sheet' : 'column' });
    },
    [isSheet],
  );

  /* A numbered block opened: which layout, and nothing about where (see `spotsMapClusterOpened`). */
  const clusterOpened = useCallback(
    () => capture(ANALYTICS_EVENTS.spotsMapClusterOpened, { view: isSheet ? 'sheet' : 'column' }),
    [isSheet],
  );

  /*
   * The sheet going up, counted — and counted only where it *is* a sheet.
   *
   * This is the one number that says whether the fix above worked: a rider on a
   * phone reaching the map at all. On a wide screen the map is simply on the
   * page, nothing opens, and an event saying it did would be a lie that made
   * the mobile figure unreadable. Hence the width check rather than a property.
   *
   * Nothing travels with it. Which spot was chosen is a catalogue fact and
   * would be allowed, but it is not what this measures, and the smallest event
   * that answers the question is the right one.
   */
  const sheetWasOpen = useRef(false);
  useEffect(() => {
    if (mapOpen === sheetWasOpen.current) return;
    sheetWasOpen.current = mapOpen;
    if (!mapOpen) return;
    if (!window.matchMedia(SHEET_WIDTH).matches) return;
    capture(ANALYTICS_EVENTS.spotsMapSheetOpened);
  }, [mapOpen]);

  /*
   * Escape closes it, because it covers the bottom of the screen and a rider
   * who reached it from the keyboard needs the way out that every other
   * dismissible surface in the product has. Guarded on the width so a desktop
   * Escape does not silently flip a flag nothing is reading.
   */
  useEffect(() => {
    if (!mapOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && window.matchMedia(SHEET_WIDTH).matches) setMapOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mapOpen]);

  /*
   * **Hold the page still while the sheet is up** (Rachid, 2026-09-08, in chat:
   * "when it's open and the user scrolls it actually scrolls the page behind
   * instead of focusing on the slide up panel").
   *
   * The sheet is three quarters of a phone screen and the thing filling it is a
   * map — a surface whose whole gesture vocabulary is dragging. Every one of
   * those drags went to the document underneath, so the rider's finger moved
   * the one surface they could not see. Two changes answer that together: the
   * map takes one-finger drags now (`gestures` on `SpotMap`), and the page
   * behind it stops being a scroll target at all. This is the second.
   *
   * **`position: fixed` on the body rather than `overflow: hidden`**, which is
   * the difference between working and looking like it works. On iOS Safari —
   * most of this product's phones — `overflow: hidden` on the body does not
   * stop touch scrolling; taking the body out of flow at a negative offset is
   * the pattern that does, and restoring the offset on the way out is what
   * stops the page jumping to the top when the sheet closes. Every property is
   * saved and put back rather than cleared, so this composes with anything else
   * that ever touches them.
   *
   * **Reverses itself on width, not just on close.** `isSheet` is in the
   * dependencies, so rotating a phone into the two-column layout releases the
   * page — the alternative is a desktop-width screen that cannot scroll because
   * of a flag nothing can see.
   */
  useEffect(() => {
    if (!mapOpen || !isSheet) return;

    const { body } = document;
    const offset = window.scrollY;
    const held = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      overflow: body.style.overflow,
    };

    body.style.position = 'fixed';
    body.style.top = `-${offset}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.overflow = 'hidden';

    return () => {
      body.style.position = held.position;
      body.style.top = held.top;
      body.style.left = held.left;
      body.style.right = held.right;
      body.style.overflow = held.overflow;
      /*
       * Instant, because nothing in the stylesheets sets `scroll-behavior:
       * smooth` on the document and this is the one place that has to stay
       * true: it is not a journey, it is putting the rider back exactly where
       * the sheet found them, and a tweened restore reads as the page running
       * away from them the moment they press Close.
       */
      window.scrollTo(0, offset);
    };
  }, [mapOpen, isSheet]);

  /*
   * **Navigation owns the card; the map is an explicit button** (design
   * handoff, "Screen 4 — the conflict and the resolution").
   *
   * A press on a spot card could mean "show me this on the map" or "open this
   * spot's page", and it cannot mean both. It used to mean the first: the whole
   * box selected the map, and the page a rider actually wanted was a 12px hint
   * — or, until spot pages existed, nowhere at all. Navigation gets the box
   * because it is the frequent gesture and the one that needs a real URL: a
   * hover target, a middle-click, a crawl path, something to share. What
   * selection loses in target size it gets back in being *stated* — "Show on
   * map" says what it does, which the invisible card handler never did.
   *
   * The link is stretched over the card (`.cardLink`, `inset: 0`) rather than
   * wrapping it, because a card holds three other controls and none of them can
   * live inside an `<a>`. Everything that must stay pressable sits above it on
   * `z-index`, and the link carries a visually-hidden name of its own so a
   * screen reader hears "Ventnor Skatepark, Ventnor — open spot page" instead
   * of a decorative arrow.
   */

  /*
   * How many live spots each sport has, for the filter pills' counts. Counted
   * on the server over every live spot rather than the filtered list: the count
   * answers "is it worth adding BMX?", and one that shrank as you typed a
   * search would answer a question nobody asked.
   */
  const sportNote = useCallback((id: SportId) => String(countsBySport[id] ?? 0), [countsBySport]);

  const mine = useMemo(() => ownSpots.filter((spot) => spot.status === 'pending'), [ownSpots]);
  // `listRule` returns a rider's own submission at any status, so a rejected
  // one comes back too. It used to fall between two filters and simply vanish —
  // a child's submission gone with nothing said (issue #107).
  const rejected = useMemo(() => ownSpots.filter((spot) => spot.status === 'rejected'), [ownSpots]);
  const pendingCount = mine.length;

  return (
    <div>
      {/*
        There is no `SportSwitch` here any more (Rachid, 2026-09-12, in chat),
        and the filter row below carries every sport instead.

        T13 put the tab row here in 2026-08-31, correcting a prototype pill that
        could only ever reach two sports — that reasoning still holds and is why
        the row is not being replaced by anything like it. What it could not fix
        is that the row is a *preference*: it is global state shared with home,
        the library, progress and stickers, so looking for a BMX park changed
        all four, and it is fed by the rider's own `users.sports`, so a rider who
        records one sport never saw it and had no way past "Good for Skate".
        A filter over `SPORT_IDS` answers both, and answers the third thing
        neither could: "scooter and BMX". Recorded in plan §7 T13.
      */}
      <div className={styles.head}>
        <div>
          <span className="eyebrow">Spots</span>
          <h1 className={`d ${styles.title}`}>Where to ride</h1>
        </div>
        <Button
          variant="ink"
          size="sm"
          onClick={() => setFormOpen((open) => !open)}
          aria-expanded={formOpen}
        >
          {formOpen ? 'Cancel' : '+ Add a spot'}
        </Button>
      </div>

      {formOpen && (
        <AddSpotForm
          signedIn={signedIn}
          /*
           * What the submission form ticks to start with: the sports the rider
           * has filtered to, else the sports they ride. Unchanged in intent —
           * the filter is the better guess at what they are looking at, and
           * their own sports are the fallback when they have not narrowed it.
           */
          defaultSports={sports.length ? sports : ownSports}
          pendingCount={pendingCount}
          onDone={() => setFormOpen(false)}
        />
      )}

      <div className={`search ${styles.search}`}>
        <Icon name="search" size={19} strokeWidth={2.6} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Town, park name or feature…"
          aria-label="Search spots"
        />
        {search && (
          <button type="button" className={`cond ${styles.clear}`} onClick={() => setSearch('')}>
            Clear
          </button>
        )}
      </div>

      <div className={styles.filters}>
        <span className="lab" style={{ color: 'var(--ink-3)' }}>
          Show
        </span>
        <SportFilter
          value={sports}
          onChange={(next) => {
            setSports(next);
            // Catalogue facts only: which screen, and which sports. Never the
            // rider's own sports, never the search text, never a position.
            capture(ANALYTICS_EVENTS.sportFilterSet, {
              screen: 'spots',
              sports: sportFilterProperty(next),
            });
          }}
          everyLabel="Every spot"
          note={sportNote}
          label="Filter spots by sport"
        />
        {/*
          The feature the list arrived narrowed to, as a pill that is already
          on. Pressing it is the only way off: there is no picker to choose a
          different one, because this screen has no feature filter of its own
          — the parameter exists so a trick page can point at one kind of
          ground, and a rider who wants another types it into the search.
        */}
        {featureLabel && (
          <Pill
            on
            onClick={() => setFeature(null)}
            aria-label={`Showing ${featureLabel} only. Show every feature`}
          >
            {featureLabel} ×
          </Pill>
        )}
        {/*
          The searched area, as a pill that is already on — the feature pill's
          shape, for the feature pill's reason: the way off is the thing
          itself. Pressing it is every area again, and the map goes back to
          framing the list.
        */}
        {area && (
          <Pill on onClick={() => setArea(null)}>
            This area ×
          </Pill>
        )}
        <span className={styles.spacer} />

        {/*
          Standard 10 (plan §6.4). Off until this is pressed, asked for again on
          every visit, and announced while it is on — the chip below is the
          "visible indicator", and it carries the way to turn it off with it.
        */}
        {here.state === 'off' && (
          <Pill
            onClick={() => {
              // A question about where the rider is ends the one about a place.
              setArea(null);
              here.ask();
            }}
            className={styles.nearMe}
          >
            <Icon name="map" size={14} strokeWidth={2.6} />
            Near me
          </Pill>
        )}
        {here.state === 'asking' && (
          <span className={`cond ${styles.locating}`}>Asking your browser…</span>
        )}
        {here.state === 'on' && (
          <span className={styles.locationOn}>
            <span className={styles.locationDot} aria-hidden="true" />
            <span className="lab">Using your location</span>
            <button type="button" className={`cond ${styles.locationOff}`} onClick={here.forget}>
              Turn off
            </button>
          </span>
        )}
        {here.state === 'refused' && (
          <span className={`cond ${styles.locating}`}>{here.message}</span>
        )}
      </div>

      <div className={styles.grid}>
        <div className={styles.list}>
          {/*
            The count is the claim about the whole collection under this
            query, counted on the server; the cards below it are one screenful
            of that. `aria-live` so a rider who cannot see the list hears a
            search land — and hears it once, when the number settles, rather
            than on every keystroke, which the debounce above sees to.
          */}
          <div className={`lab ${styles.count}`} aria-live="polite">
            {total} spot{total === 1 ? '' : 's'}
            {areaIds ? ' in this area' : here.state === 'on' ? ' · nearest first' : ''}
            {more > 0 ? ` · showing ${visible.length}` : ''}
            {waiting ? ` · ${waiting}…` : ''}
          </div>

          {error && (
            <p className={styles.pendingNote} role="alert">
              {error}
            </p>
          )}

          {visible.map((spot) => {
            const on = spot.id === mapSelectedId;
            const plottable = hasCoords(spot);
            const distance = here.point ? distanceLabelIn(here.point, spot, units) : null;
            return (
              <div
                key={spot.id}
                ref={(node) => {
                  if (node) cardNodes.current.set(spot.id, node);
                  else cardNodes.current.delete(spot.id);
                }}
                className={`panel flat ${styles.card} ${on ? styles.cardOn : ''} ${
                  spot.slug ? styles.cardLinked : ''
                }`}
              >
                {/*
                  The stretched link. Its text is the whole accessible name of
                  the card — the visible "Spot page →" in the footer is
                  decorative, and a screen reader would otherwise announce a
                  link called "→".
                */}
                {spot.slug && (
                  <Link className={styles.cardLink} href={spotHref(spot.slug)}>
                    <span className={styles.cardLinkLabel}>
                      {[spot.name, spot.town].filter(Boolean).join(', ')} — open spot page
                    </span>
                  </Link>
                )}
                <span className={styles.cardIcon}>
                  <Icon name="map" size={20} strokeWidth={2.2} />
                </span>
                <div className={styles.cardBody}>
                  <div className={styles.cardTop}>
                    <div className={styles.cardHeading}>
                      <div className="d" style={{ fontSize: 19 }}>
                        {spot.name}
                      </div>
                      <div className={`lab ${styles.cardMeta}`}>
                        {[[spot.town, spot.country].filter(Boolean).join(', '), spot.type, distance]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      {/*
                        The address and the number, for the two questions a card
                        cannot otherwise answer: can I get there, and can
                        somebody ring ahead? Rendered only when they exist — a
                        street spot has neither and a rider-submitted spot has
                        nothing but what the form asked for, so an always-on
                        label would print a blank line for most of the list.

                        `tel:` is a real link on a phone and inert on a desktop,
                        which is the right way round; the card's own click
                        handler steps aside for it like any other link.
                      */}
                      {(spot.address || spot.phone) && (
                        <div className={styles.cardContact}>
                          {spot.address && <span>{spot.address}</span>}
                          {spot.phone && (
                            <a
                              className={styles.cardPhone}
                              href={`tel:${spot.phone.replace(/[^+\d]/g, '')}`}
                            >
                              {spot.phone}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    {/*
                      T18. A spot is rider-submitted content in a public place,
                      so "this is wrong, gone, or not safe" needs somewhere to
                      go from the spot itself — an ordinary link, so it works
                      signed out, which is the OSA duty (plan §6.1). It sits in
                      the corner rather than in the row below: reporting is
                      about the spot, not one of the two things a rider came to
                      the card to do. The label is short because the corner is
                      small, and `aria-label` says which spot it reports, which
                      the corner has no room to.
                    */}
                    <Link
                      className={`cond ${styles.report}`}
                      href={reportHref({ type: 'spot', id: spot.id })}
                      aria-label={`Report ${spot.name}`}
                    >
                      Report
                    </Link>
                  </div>
                  <div className={styles.cardTags}>
                    {spot.tags.map((tag) => (
                      <Tag key={tag} color="var(--ink)" style={{ fontSize: 10 }}>
                        {tag}
                      </Tag>
                    ))}
                    {spot.sports.map((id) => (
                      <SportChip key={id} sport={SPORT_LOOKS[id]} small />
                    ))}
                  </div>
                  {plottable && (
                    <div className={styles.cardActions}>
                      {/*
                        A real `<button>`, not a div and not the card: it is the
                        one control that changes the map, it says so, and it is
                        the keyboard path to a gesture that has no other one.
                        `--sky` while it is the chosen spot, which is the
                        design's active state.
                      */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`${styles.mapPick} ${on ? styles.mapPickOn : ''}`}
                        onClick={() => select(spot.id, 'card')}
                        aria-pressed={on}
                      >
                        <span className={styles.mapPickMark} aria-hidden="true" />
                        {on ? 'On the map' : 'Show on map'}
                      </Button>
                      <span className={styles.cardActionsPush} />
                      {/*
                        Decorative: the stretched link above already carries the
                        card's name, and this only says where the box goes.
                      */}
                      {spot.slug && (
                        <span className={`cond ${styles.pageHint}`} aria-hidden="true">
                          Spot page →
                        </span>
                      )}
                      <a
                        className={`cond ${styles.directions}`}
                        href={mapsLink(spot)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Directions
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {more > 0 && (
            <Button
              variant="ghost"
              wide
              onClick={showMore}
              disabled={loading}
              className={styles.more}
            >
              Show {Math.min(more, PAGE)} more
            </Button>
          )}

          {!visible.length && !waiting && !mine.length && (
            <Empty
              icon="map"
              title="No spots there yet"
              sub="Riders add the spots. Tell us about yours and it goes on the map."
              cta="Add a spot"
              onCta={() => setFormOpen(true)}
            />
          )}

          {mine.map((spot) => (
            <div key={spot.id} className={`panel flat ${styles.card} ${styles.cardPending}`}>
              <span className={`${styles.cardIcon} ${styles.cardIconPending}`}>
                <Icon name="map" size={20} strokeWidth={2.2} />
              </span>
              <div className={styles.cardBody}>
                <div className="d" style={{ fontSize: 19 }}>
                  {spot.name}
                </div>
                <div className={`lab ${styles.cardMeta}`}>
                  {[spot.town, spot.type].filter(Boolean).join(' · ')} · Waiting to be checked
                </div>
                <p className={styles.pendingNote}>
                  Only you can see this one. A person reads every spot before it goes on the map.
                </p>
              </div>
            </div>
          ))}

          {rejected.map((spot) => (
            <div key={spot.id} className={`panel flat ${styles.card} ${styles.cardPending}`}>
              <span className={`${styles.cardIcon} ${styles.cardIconPending}`}>
                <Icon name="map" size={20} strokeWidth={2.2} />
              </span>
              <div className={styles.cardBody}>
                <div className="d" style={{ fontSize: 19 }}>
                  {spot.name}
                </div>
                <div className={`lab ${styles.cardMeta}`}>
                  {[spot.town, spot.type].filter(Boolean).join(' · ')} · Not added
                </div>
                <p className={styles.pendingNote}>
                  Only you can see this one. A person checked it and did not put it on the map.
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.mapColumn}>
          {/*
            The scrim behind the sheet. Rendered at every width and shown at
            none but the sheet's — `display: none` above 860px, where the map is
            a column on the page and there is nothing to dim. CSS owns that
            decision the way it owns every other part of this panel's
            presentation; `isSheet` above exists for the two things CSS cannot
            do, not for this one.

            Tapping it closes the sheet. `aria-hidden` because it is not the
            accessible way out — Escape and the Close button in the header are,
            and a screen reader hearing a third, unlabelled one would be worse
            served, not better.
          */}
          {mapOpen && (
            <div className={styles.mapScrim} onClick={() => setMapOpen(false)} aria-hidden="true" />
          )}

          <Panel className={`${styles.mapPanel} ${mapOpen ? styles.mapPanelOpen : ''}`}>
            <div className={styles.mapHead}>
              <span className="lab">Map</span>
              {selected && <span className={`cond ${styles.mapName}`}>{selected.name}</span>}
              {selected && (
                <a
                  className={`cond ${styles.mapLink}`}
                  href={mapsLink(selected)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in Maps
                </a>
              )}
              {/*
                The way out of the sheet, and nothing at all on a wide screen —
                `display: none` there, so it is out of the tab order and out of
                the accessibility tree rather than merely invisible. A column
                that is always on the page has nothing to close.

                It is last in the source so it is last in the tab order. In
                the sheet it takes the header's `margin-left: auto` and "Open in
                Maps" gives it up, so Close is hard right whether or not a spot
                is selected; on a wide screen the link keeps the auto and is the
                rightmost thing, exactly as before.
              */}
              <button
                type="button"
                className={`cond ${styles.mapClose}`}
                onClick={() => setMapOpen(false)}
              >
                Close
              </button>
            </div>

            {/*
              In the column at once; in the sheet from its first opening, so
              the map is built on screen where WebKit will paint it (#374 — see
              `everOpened`). Until then a closed sheet holds its header and
              footer and no map, below the screen where nobody sees either.
            */}
            {(!isSheet || everOpened) && (
              <SpotMap
                spots={mapSpots}
                /*
                  Every matching spot, clustered (#388), with the camera still
                  framing the cards on screen so the map opens where the list is.
                */
                cluster
                frame={plotted}
                onClusterOpened={clusterOpened}
                selectedId={mapSelectedId}
                onSelect={selectPin}
                here={here.point}
                /*
                  "Search this area". While an area is held the list is drawn from
                  the camera, so the camera stops framing the list — it would
                  otherwise move the view the rider just chose each time a card
                  arrived.
                */
                follow={!area}
                onSearchArea={searchArea}
                /*
                  One finger moves the map, but only in the sheet. Everywhere else
                  this panel appears it is one thing on a page a rider scrolls,
                  and cooperative gestures are what stop a scroll getting caught
                  in it. In the sheet the page behind is held still, so a drag
                  spent on it moves nothing at all — which is precisely what the
                  owner reported on 2026-09-08.
                */
                gestures={mapOpen && isSheet ? 'direct' : 'cooperative'}
              />
            )}

            {/*
              The way out of the map and into the spot.

              **First, and full width, because of where it is read.** In the
              sheet — a phone, everything below the map hidden behind it — this
              is the only link to the page a rider is looking at, and the design
              puts it above Directions and Report so a thumb never hunts for it
              behind the map. On a wide screen it is the same button doing the
              same job beside the list; the Directions and Report row below it
              is the sheet's only, because on desktop both are already on the
              card the rider can see.
            */}
            {selected && selected.slug && (
              <div className={styles.mapActions}>
                <Link className={`btn wide ${styles.mapOpen}`} href={spotHref(selected.slug)}>
                  Open {selected.name} page →
                </Link>
                <div className={styles.sheetActions}>
                  <a
                    className="btn sm ghost"
                    href={mapsLink(selected)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Directions
                  </a>
                  <Link
                    className="btn sm ghost"
                    href={reportHref({ type: 'spot', id: selected.id })}
                    aria-label={`Report ${selected.name}`}
                  >
                    Report
                  </Link>
                </div>
              </div>
            )}

            <div className={styles.mapFoot}>
              {/*
                Two footers, one shown at a time, chosen by width in CSS for the
                reason the notice below gives: a footer picked from a measured
                viewport during render is a first paint that is a guess.

                **They say different things because the sheet is a different
                moment.** On a wide screen the map sits beside the list and the
                thing worth saying is that the two are the same set. In the
                sheet the list is behind it and one spot fills the view — a
                rider is looking at where they are about to go, so this is the
                last place "check before you travel" can still reach them before
                Directions takes them out of the product entirely. It is the
                short wording, because a sheet has no room for the long one.
              */}
              {/*
                **Re-worded when the card became a link** (2026-09-06). It used
                to read "tap a pin or a card — they follow each other", which
                was true while the whole card selected the map and stopped being
                true the moment it started navigating instead. A note explaining
                a behaviour is a dated claim about the product, and this one's
                date had passed (LESSONS §4).
              */}
              {/*
                **Re-worded again 2026-09-11** (#388; owner, in chat): the map
                now draws every matching spot, not only the cards on screen, so
                "every live spot on this list is on the map" became the smaller
                of two true claims. This is the larger one.
              */}
              <p className={`cond ${styles.mapNote}`}>
                Every matching spot is on the map. The list shows {PAGE} at a time. Cards are links,
                so the map only moves when you ask it to — press <strong>Show on map</strong> on a
                card, a pin, or a number.
              </p>
              <p className={styles.mapWarn}>
                <strong>Check before you travel:</strong> Spots may not be verified.
              </p>
            </div>
          </Panel>

          {/*
            **The honest line about what this list is** (owner, 2026-08-18, in
            chat), under the map because that is where the owner put it.

            The spots are researched from councils, venues and OpenStreetMap,
            and rider submissions land here too. None of that is a live feed: a
            park can close for a rebuild, a session timetable can change, and a
            park that allows scooters this year can stop. The product cannot
            know, so it says so plainly rather than leaving a rider to find out
            at the gate.

            This is also what makes the `sports` data honest. A park is listed
            for a sport where nothing says otherwise and never where a
            restriction is documented — so the filter is a good guess, not a
            promise, and this is where that distinction is made in the open.

            Deliberately not dismissible: it is true every time the screen is
            read, and a rider who dismissed it in March is the one it is for in
            August.

            **It sits in the map column, which puts it last on a narrow screen**
            — the column stacks under the list below 860px. That is a real cost
            of this placement and it is recorded here rather than quietly
            worked around.
          */}
          {/*
            Two lengths of the same warning, chosen by screen width in CSS
            rather than by JavaScript (owner, 2026-08-18).

            **Why both are in the markup.** Choosing the text from a measured
            viewport during render means the server's first paint is a guess and
            the correction arrives after hydration — the same class of bug
            LESSONS §5 records for locale-derived markup. `display: none` costs
            a few dozen bytes and is settled before anything is painted.

            The hidden one is hidden from assistive technology too, so a screen
            reader hears one warning rather than two.
          */}
          <p className={styles.notice}>
            <span className={styles.noticeShort}>
              <strong>Check before you travel:</strong> Spots may not be verified.
            </span>
            <span className={styles.noticeFull}>
              <strong>Check before you travel.</strong> Spots come from riders, councils and public
              listings, and we cannot check them all every day. Opening times, prices and which
              wheels are allowed change — some parks do not allow scooters or BMX. If a spot has a
              number, ring ahead.
            </span>
          </p>
          {/*
            **The credit line**, and it is a licence term rather than a
            courtesy: the hand-researched spots were cross-checked against
            OpenStreetMap (Open Database Licence), and France's parks come from
            the Ministry of Sport's census under Licence Ouverte 2.0, which asks
            for the source's name *and* when it was last taken. Both are read
            from `SPOT_SOURCES` in `@landit/core` — the same table each row is
            stamped from — so a new dataset credits itself the day it is added,
            and a row's own source is never shown on its page (owner,
            2026-09-07). Never folded into `MAP_ATTRIBUTION`: that string is the
            tile credit and is kept byte-identical to what OpenFreeMap serves
            so MapLibre de-duplicates it.

            Not hidden on a narrow screen the way the long warning is. A
            licence that asks to be named is not met by a shorter paragraph.
          */}
          <p className={styles.credit}>Spot data: {creditLine()}.</p>
        </div>
      </div>
    </div>
  );
}
