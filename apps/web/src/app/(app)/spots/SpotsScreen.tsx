'use client';

import {
  SPORTS,
  distanceLabelIn,
  filterSpots,
  hasCoords,
  mapsLink,
  sortSpotsByDistance,
  sortSpotsHomeFirst,
  type DistanceUnits,
  type SportId,
} from '@landit/core';
import { Button, Empty, Icon, Panel, Pill, SportChip, Tag } from '@landit/ui-web';
import Link from 'next/link';
import { type MouseEvent, useCallback, useMemo, useRef, useState } from 'react';

import { reportHref } from '@/lib/routes';
import { SPORT_LOOKS } from '@/lib/sports';
import { useSport } from '@/providers/sport';

import { AddSpotForm } from './AddSpotForm';
import { SpotMap } from './SpotMap';
import { useHereOnce } from './useHereOnce';
import styles from './spots.module.css';

/** A `spots` row, flattened to what a screen needs. */
export interface SpotView {
  readonly id: string;
  readonly name: string;
  readonly town: string;
  readonly type: string;
  readonly lat: number;
  readonly lng: number;
  readonly sports: readonly SportId[];
  readonly tags: readonly string[];
  readonly status: 'pending' | 'live' | 'rejected';
  readonly address?: string;
  readonly phone?: string;
  readonly country?: string;
}

/**
 * How many spots a press reveals. A tunable default, not a deliberated number.
 */
const PAGE = 24;

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
 * **The rider's location is opt-in, per use, and never leaves this component**
 * (plan §6.4, standard 10). It is asked for on a press, held in React state,
 * shown while it is held, and dropped on the next navigation — there is no
 * `localStorage` write, no cookie, no field on `users`, and nothing about it is
 * sent to the server. See `useHereOnce`.
 */
export function SpotsScreen({
  spots,
  signedIn,
  units,
  homeCountry = null,
}: {
  readonly spots: readonly SpotView[];
  readonly signedIn: boolean;
  /** Miles or kilometres, settled on the server from the rider's country. */
  readonly units: DistanceUnits;
  /**
   * The spots country the reader is in, settled on the server from the same
   * signal as `units`, or null when it cannot be told. Their parks lead the
   * list until they ask for "Near me".
   */
  readonly homeCountry?: string | null;
}) {
  const { sports, sport, setSport } = useSport();

  const [search, setSearch] = useState('');
  const [everySport, setEverySport] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const here = useHereOnce();

  const live = useMemo(() => spots.filter((spot) => spot.status === 'live'), [spots]);
  const mine = useMemo(() => spots.filter((spot) => spot.status === 'pending'), [spots]);

  const list = useMemo(() => {
    const narrowed = filterSpots(live, { search, sport: everySport ? null : sport });
    // Distance beats nationality the moment a rider presses for it: a rider in
    // Dublin is nearer Liverpool than parts of Ireland, and they said where
    // they are. Home-first is only what happens until then.
    return here.point
      ? sortSpotsByDistance(narrowed, here.point)
      : sortSpotsHomeFirst(narrowed, homeCountry);
  }, [live, search, sport, everySport, here.point, homeCountry]);

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
   *
   * `PAGE` is a tunable default, not a deliberated number: 24 fills a tall
   * desktop screen and is a few scrolls on a phone.
   */
  const [shown, setShown] = useState(PAGE);

  /*
   * Reset the page when the list underneath it changes, during render rather
   * than in an effect — an effect would paint the old count first, so a rider
   * who searched from the bottom of a long list would see a flash of results
   * they had already scrolled past. This is React's documented "adjust state
   * when a prop changes" pattern; the extra render is discarded before paint.
   */
  const listKey = `${search}|${sport}|${everySport}|${here.point ? 'near' : 'home'}`;
  const [lastKey, setLastKey] = useState(listKey);
  if (listKey !== lastKey) {
    setLastKey(listKey);
    setShown(PAGE);
  }

  const visible = useMemo(() => list.slice(0, shown), [list, shown]);
  const more = list.length - visible.length;

  /**
   * Only spots with a location can be plotted, and only the ones on screen are:
   * the map's footer promises that every spot on this list is on the map, and
   * that has to stay true of the list a rider can actually see. Pressing "Show
   * more" grows both together.
   */
  const plotted = useMemo(() => visible.filter(hasCoords), [visible]);

  /*
   * Derived, not stored — which is what makes a filter that hides the selected
   * spot harmless. The id stays in state, `selected` reads as null while the
   * spot is out of the list, the map and the header both lose it together, and
   * clearing the search brings it back. Reconciling the id in an effect instead
   * would be a cascading render for a worse outcome.
   */
  const selected = useMemo(
    () => plotted.find((spot) => spot.id === selectedId) ?? null,
    [plotted, selectedId],
  );

  const cards = useRef(new Map<string, HTMLElement>());
  const select = useCallback((id: string) => {
    setSelectedId(id);
    // `nearest` so choosing a card you are already looking at does not jump the
    // page; a pin click on a card further down does scroll it into view.
    cards.current.get(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);

  /*
   * The whole card is the target, not just the button inside it — a rider
   * looking for a park aims at the box.
   *
   * **The button stays, and is still the only keyboard path.** A card is a
   * `div` because the two links in it cannot live inside a `button`, so this
   * handler is a pointer affordance layered over a real control rather than a
   * replacement for one; dropping the button would leave the card unreachable
   * by keyboard and unnamed to a screen reader, and would take the label that
   * says which spot is currently on the map with it.
   *
   * The `closest` check is what stops "Directions" and "Report" moving the map
   * on their way out. One rule in one place, rather than `stopPropagation` on
   * each link: a third link added to a card is covered without anyone
   * remembering to opt it out.
   */
  const selectFromCard = useCallback(
    (event: MouseEvent<HTMLDivElement>, id: string) => {
      if ((event.target as HTMLElement).closest('a, button')) return;
      select(id);
    },
    [select],
  );

  const otherSport = sports.find((id) => id !== sport);
  const pendingCount = mine.length;

  return (
    <div>
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
          defaultSports={everySport ? sports : [sport]}
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
        <Pill on={!everySport} onClick={() => setEverySport(false)}>
          Good for {SPORTS[sport].short}
        </Pill>
        <Pill on={everySport} onClick={() => setEverySport(true)}>
          Every spot
        </Pill>
        {otherSport && !everySport && (
          <Pill onClick={() => setSport(otherSport)}>Switch to {SPORTS[otherSport].short}</Pill>
        )}

        <span className={styles.spacer} />

        {/*
          Standard 10 (plan §6.4). Off until this is pressed, asked for again on
          every visit, and announced while it is on — the chip below is the
          "visible indicator", and it carries the way to turn it off with it.
        */}
        {here.state === 'off' && (
          <Pill onClick={here.ask} className={styles.nearMe}>
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
          <div className={`lab ${styles.count}`}>
            {list.length} spot{list.length === 1 ? '' : 's'}
            {here.state === 'on' ? ' · nearest first' : ''}
            {more > 0 ? ` · showing ${visible.length}` : ''}
          </div>

          {visible.map((spot) => {
            const on = spot.id === selected?.id;
            const plottable = hasCoords(spot);
            const distance = here.point ? distanceLabelIn(here.point, spot, units) : null;
            return (
              <div
                key={spot.id}
                ref={(node) => {
                  if (node) cards.current.set(spot.id, node);
                  else cards.current.delete(spot.id);
                }}
                className={`panel flat ${styles.card} ${on ? styles.cardOn : ''} ${
                  plottable ? styles.cardTap : ''
                }`}
                onClick={plottable ? (event) => selectFromCard(event, spot.id) : undefined}
              >
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
                      <a
                        className={`cond ${styles.directions}`}
                        href={mapsLink(spot)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Directions
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => select(spot.id)}
                        aria-pressed={on}
                      >
                        {on ? 'On the map' : 'Show on map'}
                      </Button>
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
              onClick={() => setShown((count) => count + PAGE)}
              className={styles.more}
            >
              Show {Math.min(more, PAGE)} more
            </Button>
          )}

          {!list.length && !mine.length && (
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
        </div>

        <div className={styles.mapColumn}>
          <Panel className={styles.mapPanel}>
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
            </div>

            <SpotMap
              spots={plotted}
              selectedId={selected?.id ?? null}
              onSelect={select}
              here={here.point}
            />

            <div className={styles.mapFoot}>
              <p className={`cond ${styles.mapNote}`}>
                Every live spot on this list is on the map. Tap a pin or a card — they follow each
                other.
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
              <strong>Check before you travel:</strong> Sports may not be verified.
            </span>
            <span className={styles.noticeFull}>
              <strong>Check before you travel.</strong> Spots come from riders, councils and public
              listings, and we cannot check them all every day. Opening times, prices and which
              wheels are allowed change — some parks do not allow scooters or BMX. If a spot has a
              number, ring ahead.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
