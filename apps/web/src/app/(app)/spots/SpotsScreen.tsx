'use client';

import {
  SPORTS,
  distanceLabel,
  filterSpots,
  hasCoords,
  mapsLink,
  sortSpotsByDistance,
  type SportId,
} from '@landit/core';
import { Button, Empty, Icon, Panel, Pill, SportChip, Tag } from '@landit/ui-web';
import { useCallback, useMemo, useRef, useState } from 'react';

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
 * **The rider's location is opt-in, per use, and never leaves this component**
 * (plan §6.4, standard 10). It is asked for on a press, held in React state,
 * shown while it is held, and dropped on the next navigation — there is no
 * `localStorage` write, no cookie, no field on `users`, and nothing about it is
 * sent to the server. See `useHereOnce`.
 */
export function SpotsScreen({
  spots,
  signedIn,
}: {
  readonly spots: readonly SpotView[];
  readonly signedIn: boolean;
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
    return here.point ? sortSpotsByDistance(narrowed, here.point) : narrowed;
  }, [live, search, sport, everySport, here.point]);

  /** Only spots with a location can be plotted, and only the filtered ones are. */
  const plotted = useMemo(() => list.filter(hasCoords), [list]);

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
          <Pill onClick={here.ask} disabled={here.state !== 'off'}>
            Sort by nearest
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
          </div>

          {list.map((spot) => {
            const on = spot.id === selected?.id;
            const plottable = hasCoords(spot);
            const distance = here.point ? distanceLabel(here.point, spot) : null;
            return (
              <div
                key={spot.id}
                ref={(node) => {
                  if (node) cards.current.set(spot.id, node);
                  else cards.current.delete(spot.id);
                }}
                className={`panel flat ${styles.card} ${on ? styles.cardOn : ''}`}
              >
                <span className={styles.cardIcon}>
                  <Icon name="map" size={20} strokeWidth={2.2} />
                </span>
                <div className={styles.cardBody}>
                  <div className="d" style={{ fontSize: 19 }}>
                    {spot.name}
                  </div>
                  <div className={`lab ${styles.cardMeta}`}>
                    {[spot.town, spot.type, distance].filter(Boolean).join(' · ')}
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => select(spot.id)}
                        aria-pressed={on}
                      >
                        {on ? 'On the map' : 'Show on map'}
                      </Button>
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
        </div>
      </div>
    </div>
  );
}
