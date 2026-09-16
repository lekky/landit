'use client';

import { distanceLabelIn, sortSpotsByDistance } from '@landit/core';
import { Icon, Panel, Pill, Tag } from '@landit/ui-web';
import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useMemo, useRef, useState } from 'react';

import { FindTabs } from '@/components/find/FindTabs';
import { ROUTES, eventHrefFrom, spotHref } from '@/lib/routes';
import { runActionOr } from '@/lib/runAction';
import { fetchSpotPoints } from '@/lib/spotsFetch';
import { mergePoints, type SpotPointsBody } from '@/lib/spotsWire';
import { useHereOnce } from '@/lib/useHereOnce';

import { spotsCardsAction } from '../spots/listActions';
import type { SpotView } from '../spots/view';
import type { EventView } from '../events/view';
import { HUB_SPOTS, type FindData } from './view';
import styles from './find.module.css';

/**
 * **Find / Where to ride** — the group's summary screen (D2, rethink §3.7).
 *
 * The bottom bar's fourth cell used to land on `/spots`, which answered one of
 * the three questions a rider presses Find with. This screen answers all three
 * in the order they are usually asked: *what am I doing next* (You're going),
 * *where can I ride* (Near you), *what is on* (Coming up) — with the tab row
 * above them as the way into the full list behind each.
 *
 * **It is a summary and nothing more.** Every section is four rows and a link
 * to the screen that holds the rest; there is no search, no filter and no sport
 * scope here, because a hub that grew those would be a fourth list to maintain
 * beside the two that already exist. `SportScopeSelect` lives on Spots and
 * Events (§3.7), where the list it narrows is.
 *
 * **Signed out it is the tab row and two sections**, Coming up and Near you, in
 * that order: a visitor has no attendance for the first section and none of the
 * faves or logged sessions "Near you" falls back to, so what is left is the
 * calendar and a button that finds the nearest park. Nothing on the screen
 * advertises a locked door.
 *
 * **The rider's position never leaves the browser** (plan §6.4, standard 10).
 * "Near me" is `useHereOnce`, the same hook `/spots` and `/events` use, with
 * the same four promises: the browser is prompted only on a press, the position
 * is held in React state and nowhere else, it is announced while it is held
 * with a way to end it, and the only thing that reaches our server is the *ids*
 * of the nearest spots — never a coordinate.
 */
export function FindScreen({ data }: { readonly data: FindData }) {
  const { signedIn, units, going, coming, comingCountry, known } = data;

  /*
   * `resumeWhenGranted`, matching `/spots` and `/events`. It reads a position
   * on load **only** where the Permissions API already answers `granted` — a
   * state the rider put their own browser into on an earlier press — so no
   * dialog is ever put in front of a child who has not asked for one, and this
   * screen adds no new prompt to the product. Where the browser would prompt,
   * nothing happens and the "Near me" button below is the way in.
   */
  const here = useHereOnce({ resumeWhenGranted: true });

  const [points, setPoints] = useState<SpotPointsBody | null>(null);
  const asked = useRef(false);

  /*
   * Every live spot's point, fetched the moment a position is being *read*
   * rather than once one has landed — the same overlap `/spots` makes, and for
   * the same reason: the fix is one to ten seconds on a phone and the download
   * has nothing to do with where the rider turns out to be. Nothing is fetched
   * on a plain visit, so a rider who never presses "Near me" never pays for it.
   *
   * The browser's own HTTP cache is what makes this cheap on a hub: the route
   * sets `Cache-Control` and an `ETag`, so a rider who came here from `/spots`
   * is answered out of their own store or with a 304.
   */
  useEffect(() => {
    if (points || asked.current) return;
    if (!here.reading && !here.point) return;
    asked.current = true;
    void (async () => {
      const result = await runActionOr<SpotPointsBody | { error: string }>(
        'spots_points',
        fetchSpotPoints,
        (error) => ({ error }),
      );
      if ('error' in result) {
        asked.current = false;
        return;
      }
      setPoints(result);
    })();
  }, [here.reading, here.point, points]);

  /** The nearest spots' ids, sorted here, in the browser, over the points. */
  const nearIds = useMemo(() => {
    if (!here.point || !points) return null;
    const { spots } = mergePoints(points, null);
    if (!spots) return null;
    return sortSpotsByDistance(spots, here.point)
      .slice(0, HUB_SPOTS)
      .map((spot) => spot.id);
  }, [here.point, points]);

  /*
   * The cards for those ids. **The ids are the only thing that travels** (plan
   * §6.4 standard 10 as amended 2026-09-08): the position chose them here, and
   * the server is asked for four rows without ever being told where the asking
   * happened.
   *
   * They are held **with the ids they answer**, so nothing has to be cleared
   * when the question changes. An effect that reset this on its own tick would
   * be a cascading render — the thing `react-hooks/set-state-in-effect` is
   * about — where a key compared during render is a fact already in state.
   */
  const [nearSpots, setNearSpots] = useState<{
    readonly key: string;
    readonly spots: readonly SpotView[];
  } | null>(null);
  const wanted = nearIds?.join(',') ?? '';
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    void (async () => {
      const result = await runActionOr(
        'spots_cards',
        () => spotsCardsAction(wanted.split(',')),
        () => ({ spots: [] as SpotView[] }),
      );
      if (live) setNearSpots({ key: wanted, spots: result.spots });
    })();
    return () => {
      live = false;
    };
  }, [wanted]);

  const nearby = wanted && nearSpots?.key === wanted ? nearSpots.spots : null;
  const spots = nearby ?? known;

  const eventsSection = (
    <Section
      key="coming"
      title="Coming up"
      more={{ label: 'All events', href: ROUTES.events }}
      note={comingCountry ? `In ${comingCountry}` : ''}
    >
      {coming.length ? (
        coming.map((event) => <EventRow key={event.id} event={event} />)
      ) : (
        <p className={styles.none}>
          Nothing on the calendar just yet. Staff add events, so the list stays real.
        </p>
      )}
    </Section>
  );

  const spotsSection = (
    <Section key="near" title="Near you" more={{ label: 'All spots', href: ROUTES.spots }}>
      <div className={styles.here}>
        {/*
          Standard 10's "visible indicator", and the press that is the only way
          the browser is ever asked. Identical in words and behaviour to the
          control on `/spots`, so a rider meets one feature and not two.
        */}
        {here.state === 'off' && (
          <Pill onClick={here.ask}>
            <Icon name="map" size={14} strokeWidth={2.6} />
            Near me
          </Pill>
        )}
        {here.state === 'asking' && (
          <span className={`cond ${styles.quiet}`}>Asking your browser…</span>
        )}
        {here.state === 'on' && (
          <span className={styles.on}>
            <span className={styles.dot} aria-hidden="true" />
            <span className="lab">Using your location</span>
            <button type="button" className={`cond ${styles.off}`} onClick={here.forget}>
              Turn off
            </button>
          </span>
        )}
        {here.state === 'refused' && <span className={`cond ${styles.quiet}`}>{here.message}</span>}
      </div>

      {spots.length ? (
        <>
          {!nearby && (
            <p className={`lab ${styles.quiet}`}>
              {signedIn ? 'Your faves and the spots you’ve ridden' : ''}
            </p>
          )}
          {spots.map((spot) => (
            <SpotRow
              key={spot.id}
              spot={spot}
              distance={here.point && nearby ? distanceLabelIn(here.point, spot, units) : null}
            />
          ))}
        </>
      ) : (
        <p className={styles.none}>
          {here.state === 'on'
            ? 'Looking for the closest parks…'
            : signedIn
              ? 'Press Near me, or star a spot and it will wait for you here.'
              : 'Press Near me to find the closest parks.'}
        </p>
      )}
    </Section>
  );

  return (
    <div>
      <div className={styles.head}>
        <span className="eyebrow">Find</span>
        <h1 className={`d ${styles.title}`}>Where to ride</h1>
      </div>

      <FindTabs current="for-you" className={styles.tabs} />

      <div className={styles.columns}>
        {signedIn ? (
          <>
            <Section title="You’re going" more={{ label: 'Mine', href: ROUTES.eventsMine }}>
              {going.length ? (
                going.map((event) => <EventRow key={event.id} event={event} />)
              ) : (
                <p className={styles.none}>
                  Nothing marked yet. Say you’re going on an event and it turns up here.
                </p>
              )}
            </Section>
            {spotsSection}
            {eventsSection}
          </>
        ) : (
          /*
           * A visitor gets the calendar first (§3.7). "Near you" has nothing to
           * fall back on for them — no faves, no logged sessions — so it is a
           * button and a sentence, and leading with it would open the hub on
           * the one section that is empty until something is pressed.
           */
          <>
            {eventsSection}
            {spotsSection}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * One section: a heading, a link to the screen that holds the rest, and rows.
 *
 * The "more" link is part of the heading rather than a footer, because on a
 * phone the three sections stack and a link below four rows is a link a rider
 * scrolls past on the way to the next heading.
 */
function Section({
  title,
  more,
  note,
  children,
}: {
  readonly title: string;
  readonly more: { readonly label: string; readonly href: Route };
  readonly note?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={`d ${styles.sectionTitle}`}>{title}</h2>
        {/*
          No analytics on this link, deliberately. `nav_clicked` is the bars and
          the account menu — its `to` is a group id and its `where` is one of
          four fixed places — and a route pushed into it from here would be the
          one thing the catalogue forbids: a property invented at the call site.
          What this screen is measured by is `tabs_switched { group: 'find' }`,
          which `TabRow` fires, plus the `spot_page_opened` and
          `event_page_opened` the rows themselves already land on.
        */}
        <Link className={`lab ${styles.more}`} href={more.href}>
          {more.label} →
        </Link>
      </div>
      {note && <p className={`lab ${styles.quiet}`}>{note}</p>}
      {children}
    </section>
  );
}

/** An event, as a hub row: the date block, the name, where it is. */
function EventRow({ event }: { readonly event: EventView }) {
  return (
    <Panel flat className={styles.row}>
      <div className={styles.date} style={{ background: event.kindColor }}>
        <span className={`d ${styles.dateDay}`}>{event.day}</span>
        <span className={`lab ${styles.dateMonth}`}>{event.month}</span>
      </div>
      <div className={styles.rowBody}>
        {/*
          `'list'`, the same source a row on `/events` sends. The hub is a list
          of events and the door it opens is the same one; a fourth value would
          be a catalogue change for a distinction nothing is asking about yet.
        */}
        <Link className={`d ${styles.rowName}`} href={eventHrefFrom(event.id, 'list')}>
          {event.name}
        </Link>
        <div className={`lab ${styles.rowMeta}`}>
          {[event.venue, event.town].filter(Boolean).join(' · ')}
        </div>
      </div>
    </Panel>
  );
}

/** A spot, as a hub row: its name, its town, and how far off it is if we know. */
function SpotRow({
  spot,
  distance,
}: {
  readonly spot: SpotView;
  readonly distance: string | null;
}) {
  const body = (
    <>
      <div className={styles.rowBody}>
        <span className={`d ${styles.rowName}`}>{spot.name}</span>
        <div className={`lab ${styles.rowMeta}`}>
          {spot.town}
          {distance && <> · about {distance} away</>}
        </div>
      </div>
      {spot.type && <Tag style={{ fontSize: 10 }}>{spot.type}</Tag>}
    </>
  );

  /*
   * A spot with no slug has no page — a rider's own pending submission — so it
   * is a row and not a dead link, the same rule the list cards follow.
   */
  return spot.slug ? (
    <Link className={`${styles.row} ${styles.rowLink}`} href={spotHref(spot.slug)}>
      {body}
    </Link>
  ) : (
    <Panel flat className={styles.row}>
      {body}
    </Panel>
  );
}
