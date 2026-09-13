'use client';

import {
  distanceKm,
  distanceLabelIn,
  type DistanceUnits,
  type EventKind,
  type SportId,
} from '@landit/core';
import {
  Button,
  Empty,
  foregroundFor,
  Icon,
  type IconName,
  Panel,
  Pill,
  SportChip,
  Tag,
  useModalLayer,
} from '@landit/ui-web';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { SportFilter } from '@/components/filters/SportFilter';
import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { runActionOr } from '@/lib/runAction';
import { sportFilterProperty } from '@/lib/sportFilter';
import { ROUTES, eventHrefFrom, pastEventsHref, signInHref } from '@/lib/routes';
import { useToast } from '@/providers/toast';

// The spots screen's hook, unchanged and unmoved. It is the whole of Children's
// code standard 10 (plan §6.4) and re-implementing it here would be a second
// copy of a promise that must hold identically on both screens. It lives in the
// spots folder because that is where it was written; promoting it to a shared
// component means editing `SpotsScreen.tsx`, which another session owns.
import { useHereOnce } from '@/lib/useHereOnce';
import { setAttendanceAction } from './actions';

import styles from './events.module.css';
import type { EventsView, EventView } from './view';

/**
 * Events (screenshot 18; `design-handoff/event-spot-pages`, "Screen 3").
 *
 * The filter row and the detail modal are the prototype's, with three
 * differences worth naming:
 *
 * - **The list is filtered in the browser**, over rows the server shaped. It is
 *   a few dozen events; a round trip per pill would make the row feel broken.
 * - **The two halves of the calendar are two routes**, `/events` and
 *   `/events/past`, switched by the segmented control below the heading. It
 *   used to be a pair of pills over one list. The archive is the half worth
 *   *arriving* on — somebody looking up what happened at their park last summer
 *   comes from a search result — and a pill has no address. It also closes the
 *   bug the design handoff records: a view that cannot express "both" cannot
 *   leak a finished event into the calendar, and the split is made once, in
 *   `@landit/core` (`upcomingEvents` / `pastEvents`), with a property test
 *   beside it rather than two filters that have to stay in step.
 * - **The Details modal has a URL** (Rachid, 2026-09-06, in chat). It is still
 *   the quick look and it still holds "I'm going", so the common case never
 *   leaves the list; what it gained is `?event=slug`, which makes it shareable
 *   and closes on Back. See `EventDetailModal`.
 *
 * **Distances are approximate, and say so.** Organisers publish addresses, not
 * coordinates, so an event's point comes from looking its address or town up in
 * OpenStreetMap — sometimes the venue, often the town centre. That orders the
 * list correctly, which is what "near me" is for when the calendar spans
 * twenty-six countries, but it does not support "0.4 mi away". Every distance
 * here is worded "about", because the data cannot back the precise reading.
 *
 * **Three separate location controls, because they answer three questions.**
 * Country is a `<select>` and not a row of pills — a pill per country is a
 * hundred pills once the calendar is worldwide. The text box is a plain
 * substring search over city, venue, name and country, run in this browser and
 * sent nowhere. "Near me" is the spots screen's hook, on the same terms:
 * never prompted for unless a rider presses, announced while on, never stored,
 * never transmitted.
 *
 * **The country control opens on the reader's own country** (Rachid,
 * 2026-09-12, in chat), on both halves. "What's coming up" is only a useful
 * sentence if it means near me, and the calendar is two hundred and twenty-one
 * events across thirty countries — a reader in Sweden should not have to find a
 * `<select>` below the fold before the first screen is about them. The answer
 * is resolved on the server (`eventCountryForRegion`, via `view.defaultCountry`)
 * from the same signal the units use, in the same order: a signed-in rider's
 * declared country, then `Accept-Language` for a visitor. It is never worked
 * out here, because a filter whose starting value is decided in the browser
 * makes the first paint disagree with the second (LESSONS §3a).
 *
 * **It only ever names a country with events actually in it.** The
 * code-to-name join reaches two hundred and fifty countries and the calendar is
 * in thirty, so most of the planet has nothing on — those readers open on
 * Everywhere, exactly as before, and no neighbour is guessed for them. The
 * default is also never something the `<select>` cannot show, so a rider can
 * always choose their way back out of it; the line above the list is the other
 * half of that, and `events_country_defaulted` is what says whether any of it
 * is landing.
 *
 * **This screen opens nearest-first when the browser already allows it**
 * (Rachid, 2026-08-30, in chat; §6.4 standard 10 as amended), on the same terms
 * as `/spots`: `resumeWhenGranted` reads a position on load *only* where the
 * Permissions API already answers `granted`, and does nothing at all where it
 * answers `prompt` or `denied` or refuses the question. No dialog is put in
 * front of a rider who did not press for one.
 *
 * **One thing this screen owes that `/spots` did not.** A spot list reordered
 * by distance still reads as a list of spots, but a *calendar* in date order is
 * a promise, and distance order quietly breaks it — an event in June above one
 * next week. So when a position is held the list says "Nearest first" above it.
 * That line is not decoration: on a resume the rider pressed nothing, and the
 * location badge alone tells them their position is in use without telling them
 * their calendar has been re-sorted.
 *
 * **A visitor sees the whole calendar and cannot save any of it.** Every filter,
 * the detail modal and both organiser links work signed out; "I'm going" is the
 * one control that needs an account, and it is replaced by a sign-in link that
 * comes back here rather than left in place to fail on click.
 *
 * Nobody else's attendance is anywhere on this screen, by design: there is no
 * stranger-contact surface in this product (plan §6.1), and a list of who else
 * is going to a park on Saturday would be one.
 */

/**
 * How many events a page shows.
 *
 * The calendar is worldwide and runs to dozens of rows; rendering all of them
 * put a rider on a page they had to scroll past to reach anything else, and
 * buried the "you're down for N events" panel under it. Twenty is roughly two
 * screens on a phone — enough that paging is rare once a country or a sport is
 * chosen, few enough that the page ends somewhere.
 */
const PER_PAGE = 20;

export function EventsScreen({
  view,
  units,
  signedIn,
}: {
  readonly view: EventsView;
  readonly units: DistanceUnits;
  /**
   * Whether "I'm going" is offered at all. A visitor gets a sign-in link in its
   * place rather than a button that looks live and bounces them off the page
   * mid-click — the server action still refuses on its own, but by then the
   * rider has lost their filters.
   */
  readonly signedIn: boolean;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const here = useHereOnce({ resumeWhenGranted: true });
  const pathname = usePathname();
  const params = useSearchParams();
  const past = view.scope === 'past';

  /*
   * Nearest-first happened — counted once per position held, and tagged with
   * the screen so the two lists' funnels do not merge into one unreadable
   * number. `source` separates a press on this visit from a standing browser
   * permission served silently, which is the only evidence there is about
   * whether the resume earns its place. The position itself is never a
   * property (§6.4 standard 10).
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
      screen: 'events',
      source: here.resumed ? 'resumed' : 'pressed',
    });
  }, [here.state, here.resumed]);

  /*
   * Whether the calendar could open on the reader's own country. Counted once
   * per load, off the server's answer rather than off `country`, so a rider
   * changing the filter is not counted as a second default. Neither the country
   * nor the signal behind it is a property — see the catalogue.
   */
  useEffect(() => {
    capture(ANALYTICS_EVENTS.eventsCountryDefaulted, {
      outcome: view.defaultCountry ? 'home' : 'everywhere',
      scope: view.scope,
    });
  }, [view.defaultCountry, view.scope]);

  const [kind, setKind] = useState<EventKind | null>(null);
  /*
   * Which sports the calendar is narrowed to. **Empty is every sport, and empty
   * is where it opens** (Rachid, 2026-09-12, in chat).
   *
   * It used to be `mySportOnly`, a boolean starting `true`, which meant the
   * calendar opened hiding every event that was not for the one sport the
   * global switch happened to be on. On a rider whose profile records a single
   * sport that switch is not even rendered (`SportSwitch` needs two), so the
   * hidden events had no control that could bring them back. See `SportFilter`.
   */
  const [sports, setSports] = useState<readonly SportId[]>([]);
  /*
   * Opens on the reader's own country where the calendar has events in it, and
   * on Everywhere where it does not (`eventCountryForRegion`). The value comes
   * from the server rather than being worked out here: this component renders
   * on both sides of a hydration boundary, and a filter whose starting value is
   * decided in the browser gives a first paint that disagrees with the second
   * (LESSONS §3a).
   *
   * It is a *starting* value and nothing more — `setCountry` owns it from the
   * first change, so choosing Everywhere sticks for the rest of the visit.
   */
  const [country, setCountry] = useState(view.defaultCountry);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [going, setGoing] = useState<ReadonlySet<string>>(
    () => new Set(view.events.filter((e) => e.going).map((e) => e.id)),
  );

  const list = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const narrowed = view.events.filter((event) => {
      if (kind && event.kind !== kind) return false;
      // Any of the chosen sports, not all of them: a rider who picks scooter
      // and BMX is asking for both calendars at once, and an event good for
      // either belongs in that list.
      if (sports.length && !event.sportIds.some((id) => sports.includes(id))) return false;
      if (country && event.country !== country) return false;
      if (needle) {
        const haystack =
          `${event.name} ${event.town} ${event.venue} ${event.country}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });

    // Nearest first only while the rider is actually sharing a position.
    // Without one the list stays in the order the server shaped — soonest first
    // on the calendar, most recent first in the archive.
    if (!here.point) return narrowed;
    const from = here.point;
    return [...narrowed]
      .map((event, index) => ({ event, index }))
      .sort((a, b) => {
        const aHas = a.event.lat !== undefined && a.event.lng !== undefined;
        const bHas = b.event.lat !== undefined && b.event.lng !== undefined;
        // An event nobody has plotted cannot be near anything, so it keeps its
        // date position at the back rather than being dropped.
        if (!aHas && !bHas) return a.index - b.index;
        if (!aHas) return 1;
        if (!bHas) return -1;
        const gap =
          distanceKm(from, { lat: a.event.lat as number, lng: a.event.lng as number }) -
          distanceKm(from, { lat: b.event.lat as number, lng: b.event.lng as number });
        return gap === 0 ? a.index - b.index : gap;
      })
      .map((entry) => entry.event);
  }, [view.events, kind, sports, country, search, here.point]);

  const pageCount = Math.max(1, Math.ceil(list.length / PER_PAGE));

  /*
   * The page a rider is actually on, clamped as the list shrinks under them.
   *
   * Narrowing a seventy-nine-event list to one country while on page 3 would
   * otherwise land on an empty page that reads as "no events in France" — the
   * filter worked, and the page was simply past the end. Clamped here, during
   * render, rather than corrected afterwards in an effect: the effect version
   * renders the empty page first and then fixes it, which is a visible flicker
   * and a cascading render. `page` stays as the rider left it, so widening the
   * filter again puts them back where they were.
   */
  const current = Math.min(page, pageCount - 1);
  const shown = list.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);

  const toggle = (event: EventView) => {
    const next = !going.has(event.id);
    // Optimistic, then reconciled: the server action is the authority and puts
    // it back if the consent gate refuses.
    setGoing((current) => {
      const copy = new Set(current);
      if (next) copy.add(event.id);
      else copy.delete(event.id);
      return copy;
    });

    startTransition(async () => {
      const result = await runActionOr(
        'event_attendance',
        () => setAttendanceAction(event.id, next),
        (error) => ({ error }),
      );
      if (!result.error)
        capture(ANALYTICS_EVENTS.eventAttendanceSet, { event: event.id, going: next });
      if (result.error) {
        setGoing((current) => {
          const copy = new Set(current);
          if (next) copy.delete(event.id);
          else copy.add(event.id);
          return copy;
        });
        toast(result.error, 'var(--red)');
        return;
      }
      toast(next ? `You're down for ${event.name}.` : `Taken off ${event.name}.`, event.kindColor);
    });
  };

  /*
   * The modal's open/closed state is the URL's `?event=`, and nothing else
   * holds it.
   *
   * **Why the History API rather than `router.push`.** Both give a shareable
   * address and a working Back button; `router.push` also asks the server for a
   * fresh render of this route, which for a quick look at a row already on
   * screen is a network round trip a rider waits through. Next.js reflects a
   * native `pushState` in `useSearchParams`, so the modal opens in the same
   * frame and the address bar still changes. `openedHere` is what keeps Close
   * honest: it goes *back* when this session pushed the entry, and replaces the
   * address when the rider arrived on the link, so Close never walks somebody
   * off the site.
   */
  const openSlug = params.get('event');
  const openedHere = useRef(false);
  const open = useMemo(
    () => (openSlug ? (view.events.find((event) => event.id === openSlug) ?? null) : null),
    [openSlug, view.events],
  );

  const openDetails = useCallback(
    (event: EventView) => {
      openedHere.current = true;
      window.history.pushState(null, '', `${pathname}?event=${encodeURIComponent(event.id)}`);
    },
    [pathname],
  );

  const closeDetails = useCallback(() => {
    if (openedHere.current) {
      openedHere.current = false;
      window.history.back();
      return;
    }
    window.history.replaceState(null, '', pathname);
  }, [pathname]);

  const goingCount = going.size;
  const archive = view.archive;
  const where = archive?.where ?? null;

  /*
   * The archive's empty state, which is a real answer rather than a 404: a
   * reader can type `/events/past/2024/ventnor` and the corner may hold
   * nothing. The page it sits on carries `robots: index: false` in that case,
   * so an empty corner can never become an indexed thin page.
   */
  const emptyCorner = past && where !== null && view.events.length === 0;

  return (
    <div className={styles.page}>
      {/*
        There is no `SportSwitch` here any more, and that is the point.

        The global sport switch used to sit above this heading and decide what
        the one sport pill below filtered to. It is a *preference* — which sport
        you ride — and it is shared with home, the library, progress and
        stickers, so looking up a BMX jam changed all four. Browsing what is on
        is not a statement about what you ride, and a rider who records one
        sport never saw the row at all. The filter row now carries every sport
        itself (`SportFilter`), so this screen no longer reads or writes the
        preference. Recorded in plan §7 T13, which put the row on `/spots`
        deliberately in 2026-08-31.
      */}
      <div className={styles.headRow}>
        <div>
          <span className="eyebrow">{past ? 'The archive' : 'Events'}</span>
          <h1 className={`d ${styles.head}`}>
            {past ? 'Events that have already happened' : 'What’s coming up'}
          </h1>
        </div>
        <p className={styles.lede}>
          {past
            ? 'Nothing here is happening. Kept online because riders still look these up.'
            : 'Comps, coached sessions and one-skill classes near you. Staff add them, so the list stays real.'}
        </p>
      </div>

      {/*
        The two halves, as two links.

        Links rather than buttons because they are two addresses: a crawler
        follows them, a rider can middle-click them, and the archive has a page
        to be shared. `aria-current="page"` is what says which half you are on,
        so the ink fill is not carrying the meaning on its own.
      */}
      <nav className={styles.viewSwitch} aria-label="Upcoming or past events">
        <Link
          href={ROUTES.events}
          className={`cond ${styles.viewSwitchItem}`}
          aria-current={past ? undefined : 'page'}
          onClick={() => capture(ANALYTICS_EVENTS.eventsViewSwitched, { view: 'upcoming' })}
        >
          Upcoming <span className={styles.viewSwitchCount}>{view.upcomingCount}</span>
        </Link>
        <Link
          href={pastEventsHref()}
          className={`cond ${styles.viewSwitchItem}`}
          aria-current={past ? 'page' : undefined}
          onClick={() => capture(ANALYTICS_EVENTS.eventsViewSwitched, { view: 'past' })}
        >
          Past <span className={styles.viewSwitchCount}>{view.pastCount}</span>
        </Link>
      </nav>

      <div className={`search ${styles.search}`}>
        <Icon name="search" size={19} strokeWidth={2.6} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="City, venue or event name…"
          aria-label="Search events by city, venue or name"
        />
        {search && (
          <button type="button" className={`cond ${styles.clear}`} onClick={() => setSearch('')}>
            Clear
          </button>
        )}
      </div>

      <div className={styles.filters}>
        {/*
          A `<select>`, not a row of pills. The calendar is worldwide, so a pill
          per country is a wall of pills that pushes the list off the screen —
          and the options come from the events actually present, so no country
          here can find nothing.
        */}
        <label className={styles.countryPick}>
          <span className="lab" style={{ color: 'var(--ink-3)' }}>
            Country
          </span>
          <select
            className="cond"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            aria-label="Filter events by country"
          >
            <option value="">Everywhere</option>
            {view.countries.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <span className={styles.spacer} />

        {/*
          Standard 10 (plan §6.4), on the same terms as `/spots`: off until this
          is pressed, asked for again on every visit, announced while it is on,
          and the way to turn it off travels with the indicator.
        */}
        {here.state === 'off' && <Pill onClick={here.ask}>Sort by nearest</Pill>}
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

      <div className={styles.filters}>
        <Pill on={kind === null} onClick={() => setKind(null)}>
          Everything
        </Pill>
        {view.kinds.map((k) => (
          <Pill
            key={k.id}
            on={kind === k.id}
            onClick={() => setKind(k.id)}
            style={
              kind === k.id
                ? { background: k.color, color: foregroundFor(k.color) ?? 'var(--on-dark)' }
                : undefined
            }
          >
            {k.id}
          </Pill>
        ))}
        <span className={styles.spacer} />
        <SportFilter
          value={sports}
          onChange={(next) => {
            setSports(next);
            // Catalogue facts only: which screen, and which sports. Never the
            // rider's own sports, and never what else the row was filtered to.
            capture(ANALYTICS_EVENTS.sportFilterSet, {
              screen: 'events',
              sports: sportFilterProperty(next),
            });
          }}
          everyLabel="Every sport"
          note={(id) => String(view.countBySport[id] ?? 0)}
          label="Filter events by sport"
        />
      </div>

      {archive && <ArchiveIndex archive={archive} />}

      {/*
        Which country the list is narrowed to, said out loud above the results
        (Rachid, 2026-09-12, in chat).

        It exists because this screen now *opens* narrowed. The country control
        is a `<select>` below a row of pills, which on a phone is off the bottom
        of the first screen — so without this line a rider in Sweden meets five
        events where there are two hundred and twenty-one, with nothing on
        screen to say a filter is on. A short list that does not explain itself
        reads as an empty product.

        Rendered outside the list rather than beside "Nearest first", because it
        has to survive the list being empty: a filter narrow enough to find
        nothing is exactly when a rider most needs telling which filter it was.
        And the way out travels with it, as it does on the location badge.
      */}
      {country && (
        <p className={styles.showing}>
          <span className="lab">Showing {country}</span>
          <button
            type="button"
            className={`cond ${styles.showingAll}`}
            onClick={() => setCountry('')}
          >
            See everywhere
          </button>
        </p>
      )}

      {emptyCorner ? (
        <EmptyCorner town={where?.town ?? ''} year={where?.year ?? 0} narrowedTo={Boolean(where)} />
      ) : list.length ? (
        <div className={styles.list}>
          {/*
            How the list is ordered, said only where it is not the obvious
            thing. "Nearest first" is the one that matters — on a resume the
            rider pressed nothing, so the badge alone would not tell them their
            calendar had been re-sorted — and the archive says its own order
            because "most recent first" is the opposite of the calendar's.
          */}
          {here.state === 'on' ? (
            <div className={`lab ${styles.order}`}>Nearest first</div>
          ) : past ? (
            <div className={`lab ${styles.order}`}>
              Most recent first
              {where && where.town ? ` · ${where.town}, ${where.year}` : ''}
            </div>
          ) : null}
          {shown.map((event) => (
            <Panel
              flat
              key={event.id}
              className={`${styles.row} ${event.past ? styles.rowPast : ''}`}
            >
              {/*
                The date block wears the kind's colour — except on a finished
                event, where the design drops it to ink so the row reads as done
                before a word of it is read.
              */}
              <div
                className={styles.date}
                style={{ background: event.past ? 'var(--ink)' : event.kindColor }}
              >
                <span className={`d ${styles.dateDay}`}>{event.day}</span>
                <span className={`lab ${styles.dateMonth}`}>{event.month}</span>
              </div>

              <div className={styles.rowBody}>
                <div className={styles.rowMain}>
                  <div className={styles.chips}>
                    {/*
                      "Over" first, in red, on a finished event. Colour never
                      carries the meaning on its own here — the word is the
                      signal and the red is the emphasis.
                    */}
                    {event.past && (
                      <Tag color="var(--red)" style={{ fontSize: 10 }}>
                        Over
                      </Tag>
                    )}
                    <Tag color={event.kindColor} style={{ fontSize: 10 }}>
                      {event.kind}
                    </Tag>
                    {event.sports.map((s) => (
                      <SportChip
                        key={s.id}
                        small
                        sport={{ label: s.label, color: s.color, icon: s.icon as IconName }}
                      />
                    ))}
                  </div>
                  {/*
                    The event's name is a link to its own page.

                    That is the one change to a row design that is otherwise
                    exactly as it shipped, and it buys three things a `<button>`
                    could not: a URL on hover, a middle-click, and a path a
                    crawler can follow into `/events/[slug]`. `?from=list`
                    is how `event_page_opened` tells this door from the modal's
                    — three fixed strings decided on the server, never anything
                    a reader typed (`sourceOf` in the page).
                  */}
                  <Link
                    className={`d ${styles.name}`}
                    href={eventHrefFrom(event.id, 'list')}
                    onClick={(clicked) => clicked.stopPropagation()}
                  >
                    {event.name}
                  </Link>
                  <div className={`lab ${styles.meta}`}>
                    {[event.venue, event.town, event.country, event.level]
                      .filter(Boolean)
                      .join(' · ')}
                    {event.past && event.ago && <> · {event.ago}</>}
                    {here.point && distanceLabelIn(here.point, event, units) && (
                      <> · about {distanceLabelIn(here.point, event, units)} away</>
                    )}
                  </div>
                </div>

                <div className={styles.money}>
                  <div className={`cond ${styles.price}`}>{event.price}</div>
                  <div className={`lab ${styles.muted}`}>{event.places}</div>
                </div>

                <div className={styles.actions}>
                  <Button size="sm" variant="ghost" onClick={() => openDetails(event)}>
                    Details
                  </Button>
                  {/*
                    "I'm going" is meaningless once an event is over, so a
                    finished row offers the page instead — which is where the
                    archive actually leads somebody: what is on at that venue
                    next, and what else is near.
                  */}
                  {event.past ? (
                    <Link className="btn sm ink" href={eventHrefFrom(event.id, 'list')}>
                      Full page →
                    </Link>
                  ) : signedIn ? (
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() => toggle(event)}
                      style={going.has(event.id) ? { background: 'var(--green)' } : undefined}
                      aria-pressed={going.has(event.id)}
                    >
                      {going.has(event.id) ? '✓ Going' : "I'm going"}
                    </Button>
                  ) : (
                    <Link className="btn sm" href={signInHref(ROUTES.events)}>
                      Sign in to save
                    </Link>
                  )}
                </div>
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <Empty
          icon="flag"
          title={past ? 'Nothing in the archive for that' : 'Nothing listed yet'}
          /*
           * The copy no longer names a sport, because the filter no longer has
           * exactly one to name — it can be every sport, or two of the three.
           * "That filter" covers all of it and stays true whatever was pressed.
           */
          sub={
            past
              ? 'Nothing in the archive matches that filter. Try widening it.'
              : 'Nothing on the calendar matches that filter. Try widening it, or check back.'
          }
          cta="Show everything"
          onCta={() => {
            setKind(null);
            setSports([]);
            setCountry('');
            setSearch('');
          }}
        />
      )}

      {pageCount > 1 && (
        <nav className={styles.pager} aria-label="Events pages">
          <Button
            size="sm"
            variant="ghost"
            disabled={current === 0}
            onClick={() => setPage(Math.max(0, current - 1))}
          >
            ← Previous
          </Button>
          {/*
            A count, not a row of numbered buttons. Twenty-six countries of
            events make for a lot of pages, and a rider looking for a comp near
            them reaches it by filtering rather than by hunting page seven.
          */}
          <span className={`cond ${styles.pageCount}`} aria-live="polite">
            Page {current + 1} of {pageCount} · {list.length} event
            {list.length === 1 ? '' : 's'}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={current >= pageCount - 1}
            onClick={() => setPage(Math.min(pageCount - 1, current + 1))}
          >
            Next →
          </Button>
        </nav>
      )}

      {/*
        The listing is researched, not submitted by organisers, and this says so
        in the same words `/spots` uses. It sits under the list rather than above
        it because it is what a rider needs *after* picking a row and before
        acting on it — and it is repeated inside the detail modal, which is where
        the decision to travel is actually made.
      */}
      <p className={styles.sourceNote}>
        We research these listings from organisers&rsquo; own pages. Details change — check the
        organiser&rsquo;s link before you set off, and ring ahead where there is a number.
      </p>

      {!past && goingCount > 0 && (
        <Panel className={styles.tally}>
          <span className={styles.tallyIcon}>
            <Icon name="flag" size={21} strokeWidth={2.3} />
          </span>
          <div className={styles.tallyBody}>
            <div className={`cond ${styles.tallyHead}`}>
              You&rsquo;re down for {goingCount} event{goingCount === 1 ? '' : 's'}
            </div>
            <p className={styles.tallyNote}>Entry and payment happen at the venue.</p>
          </div>
        </Panel>
      )}

      {open && (
        <EventDetailModal
          event={open}
          distance={here.point ? distanceLabelIn(here.point, open, units) : null}
          signedIn={signedIn}
          going={going.has(open.id)}
          onToggle={() => {
            toggle(open);
            closeDetails();
          }}
          onClose={closeDetails}
        />
      )}
    </div>
  );
}

/**
 * "Browse by year and town" — the archive's index panel.
 *
 * **Only corners that hold events** (Rachid, 2026-09-06, in chat). The
 * prototype draws a year row crossed with a town row, and taken literally that
 * is a cross-product: eighty towns over four years is three hundred and twenty
 * addresses of which two dozen hold anything, and the rest are thin pages a
 * search engine reads as a doorway pattern. So the panel keeps the design's
 * shape — a year label with a row of town pills beside it — and repeats it per
 * year, with every pill pointing at a page that genuinely has events on it.
 * `eventArchiveIndex` is the single list behind both this panel and
 * `sitemap.ts`, so the two cannot drift into disagreeing about what exists.
 */
function ArchiveIndex({ archive }: { readonly archive: NonNullable<EventsView['archive']> }) {
  const { index, where } = archive;
  if (!index.combinations.length) return null;

  return (
    <Panel className={styles.archive}>
      <div className={styles.archiveHead}>
        <h2 className={`d ${styles.archiveTitle}`}>Browse by year and town</h2>
        <p className={styles.archiveNote}>
          The archive is a real index, not just a search result. Past events never appear in the
          upcoming calendar.
        </p>
      </div>

      {index.years.map((year) => (
        <div key={year} className={styles.archiveRow}>
          <span className={`lab ${styles.archiveYear}`}>{year}</span>
          {index.combinations
            .filter((combination) => combination.year === year)
            .map((combination) => {
              const on = where?.year === year && where.townSlug === combination.townSlug;
              return (
                <Link
                  key={combination.townSlug}
                  href={pastEventsHref({ year, townSlug: combination.townSlug })}
                  className={`pill ${on ? 'on' : ''} ${styles.archivePill}`}
                  aria-current={on ? 'page' : undefined}
                >
                  {combination.town}{' '}
                  <span className={styles.archiveCount}>{combination.count}</span>
                </Link>
              );
            })}
        </div>
      ))}

      {where && (
        <div className={styles.archiveRow}>
          <Link href={pastEventsHref()} className={`pill ${styles.archivePill}`}>
            All past events →
          </Link>
        </div>
      )}
    </Panel>
  );
}

/**
 * A year and town corner of the archive with nothing in it.
 *
 * A real answer rather than a 404 — a reader can reasonably type one, and a
 * page that explains itself and offers two ways on is better than an error. The
 * page carrying it is `noindex`, so this can never become an indexed thin page.
 *
 * **The town is named only where we hold it.** `where.town` comes from an event
 * in the archive, never from the URL segment, so nothing a reader typed is
 * echoed back into the page's own copy.
 */
function EmptyCorner({
  town,
  year,
  narrowedTo,
}: {
  readonly town: string;
  readonly year: number;
  readonly narrowedTo: boolean;
}) {
  if (!narrowedTo) return null;
  return (
    <Panel flat className={styles.emptyCorner}>
      <span className="eyebrow">{town ? `${town} · ${year}` : String(year)}</span>
      <h2 className={`d ${styles.emptyCornerTitle}`}>
        {town ? `No past events listed in ${town} for ${year}` : `Nothing listed for ${year} there`}
      </h2>
      <p className={styles.emptyCornerNote}>
        The archive only holds what we have listed, and this corner of it is empty. Try another year
        or town from the index above, or look at what is coming up instead.
      </p>
      <div className={styles.emptyCornerActions}>
        <Link className="btn sm" href={ROUTES.events}>
          See upcoming events
        </Link>
        <Link className="btn sm ghost" href={pastEventsHref()}>
          All past events
        </Link>
      </div>
    </Panel>
  );
}

/**
 * The detail modal — the screen's decision point, and therefore where the
 * address, the phone number, the organiser's page and the caution all live.
 *
 * **It has its own dialog rather than the shell's `useModal`**, and the reason
 * is the URL. This modal's open state is `?event=slug` (see `openDetails`), so
 * it is rendered from the list's own tree rather than pushed into a host that
 * knows nothing about the address bar. Owning the element is also what lets it
 * put `aria-labelledby` on the real title.
 *
 * **What a dialog does to the page behind it comes from `useModalLayer`**, the
 * hook the shared `Modal` runs, so this one behaves like every other (issue
 * #372): the page is held still and made inert, Escape closes it, and focus
 * goes back to the Details button that opened it. It used to do the focus half
 * by hand, and focused Close on open — but Close is at the foot of a modal
 * taller than a phone, so the browser scrolled the modal to its bottom half and
 * the title and the date opened off the top. The hook focuses the dialog
 * itself, without scrolling, so it opens at its head. The hand-written Tab trap
 * went with it: with the page inert there is nowhere else for Tab to go.
 *
 * Every row here is conditional on having a value. An event researched without
 * a phone renders no phone row rather than a "Call" label with nothing after
 * it, which is the shape the migration's optional fields were chosen for.
 *
 * **Both outbound links are already checked.** `sourceUrl` arrives
 * scheme-checked from `buildEventsView` and is `''` unless it is a real
 * http(s) URL, so an `href` here can never carry a `javascript:` URI typed into
 * the staff editor. `rel="noreferrer"` keeps the rider's page out of the
 * organiser's referrer log — this is a children's product, and where a child
 * browsed from is not the organiser's business.
 */
function EventDetailModal({
  event,
  distance,
  signedIn,
  going,
  onToggle,
  onClose,
}: {
  readonly event: EventView;
  /** "2.4 mi", only while the rider is sharing a position. */
  readonly distance: string | null;
  readonly signedIn: boolean;
  readonly going: boolean;
  readonly onToggle: () => void;
  readonly onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = `event-modal-${event.id}`;

  useModalLayer(panel, onClose);

  return (
    <div className="scrim" onClick={onClose}>
      <div
        ref={panel}
        className={`modal ${styles.modal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(clicked) => clicked.stopPropagation()}
      >
        <div className={styles.modalHead} style={{ background: event.kindColor }}>
          <div className={styles.chips}>
            <Tag color="var(--ink)">{event.kind}</Tag>
            {event.sports.map((s) => (
              <Tag key={s.id} color="var(--paper)" className={styles.tagInk}>
                {s.label}
              </Tag>
            ))}
          </div>
          {/*
            The title is the link to the full page as well as the dialog's
            accessible name — the design's "modal title as a link", so the
            biggest thing in the dialog is also a way to the thing it is about.
          */}
          <h2 id={titleId} className={`d ${styles.modalTitle}`}>
            <Link className={styles.modalTitleLink} href={eventHrefFrom(event.id, 'modal_cta')}>
              {event.name}
            </Link>
          </h2>
          <div className={`lab ${styles.modalDate}`}>{event.fullDate}</div>
        </div>

        <div className={styles.modalBody}>
          {event.blurb && <p className={styles.modalBlurb}>{event.blurb}</p>}
          <div className={styles.facts}>
            {(
              [
                ['Where', [event.venue, event.town, event.country].filter(Boolean).join(', ')],
                ['Who for', event.level],
                ['Cost', event.price],
                ['Places', event.places],
                ...(distance ? ([['Distance', `About ${distance} away`]] as const) : []),
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <div className={`lab ${styles.muted}`}>{label}</div>
                <div className={`cond ${styles.factValue}`}>{value}</div>
              </div>
            ))}
          </div>

          {(event.address || event.phone || event.sourceUrl) && (
            <div className={styles.contact}>
              {event.address && (
                <div className={styles.contactRow}>
                  <span className={`lab ${styles.muted}`}>Address</span>
                  <span className={styles.contactValue}>
                    {event.address}
                    {event.mapsUrl && (
                      <>
                        {' '}
                        <a
                          href={event.mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={`cond ${styles.contactLink}`}
                        >
                          Open in maps
                        </a>
                      </>
                    )}
                  </span>
                </div>
              )}

              {event.phone && (
                <div className={styles.contactRow}>
                  <span className={`lab ${styles.muted}`}>Phone</span>
                  <span className={styles.contactValue}>
                    {/* Shown exactly as the venue publishes it; only the href is normalised. */}
                    {event.phoneLink ? (
                      <a href={event.phoneLink} className={`cond ${styles.contactLink}`}>
                        {event.phone}
                      </a>
                    ) : (
                      event.phone
                    )}
                  </span>
                </div>
              )}

              {event.sourceUrl && (
                <div className={styles.contactRow}>
                  <span className={`lab ${styles.muted}`}>Listing</span>
                  <span className={styles.contactValue}>
                    <a
                      href={event.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`cond ${styles.contactLink}`}
                    >
                      {event.sourceHost || 'Organiser’s page'}
                    </a>
                  </span>
                </div>
              )}
            </div>
          )}

          <p className={styles.verifyNote}>
            We researched this from the organiser&rsquo;s own page, and details change. Check the
            listing before you set off — dates, prices and age limits move, and a session can be
            cancelled without us knowing.
          </p>
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <span className={`${styles.push} ${styles.modalRight}`}>
              {/*
                The full-page CTA the design puts beside "I'm going". `?from=`
                is the only way `event_page_opened` can tell this door from the
                row's link — the two answer opposite questions about whether the
                modal is enough on its own.
              */}
              <Link className={styles.fullCta} href={eventHrefFrom(event.id, 'modal_cta')}>
                View full page →
              </Link>
              {event.past ? null : signedIn ? (
                <Button
                  onClick={onToggle}
                  style={going ? { background: 'var(--green)' } : undefined}
                  aria-pressed={going}
                >
                  {going ? "✓ You're going" : "I'm going"}
                </Button>
              ) : (
                <Link className="btn" href={signInHref(ROUTES.events)}>
                  Sign in to save
                </Link>
              )}
            </span>
            <p className={styles.ctaHint}>
              The full page adds the map, what else is on nearby, other events at this venue, and a
              link you can share.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
