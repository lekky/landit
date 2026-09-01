'use client';

import {
  SPORTS,
  distanceKm,
  distanceLabelIn,
  type DistanceUnits,
  type EventKind,
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
} from '@landit/ui-web';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { SectionTabs } from '@/components/shell/SectionTabs';
import { WHATS_ON_TABS } from '@/components/shell/nav';
import { SportSwitch } from '@/components/shell/SportSwitch';
import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { ROUTES, signInHref } from '@/lib/routes';
import { useModal } from '@/providers/modal';
import { useSport } from '@/providers/sport';
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
 * Events (screenshot 18).
 *
 * The filter row and the detail modal are the prototype's, with two
 * differences worth naming:
 *
 * - **The list is filtered in the browser**, over rows the server shaped. It is
 *   a few dozen events; a round trip per pill would make the row feel broken.
 * - **A past event is dimmed rather than dropped.** "What's coming up" is the
 *   heading, but a rider who said they were going to something last weekend
 *   should still see it — silently removing a row a child ticked reads as a
 *   bug. **Upcoming only is the state the page lands in**, and the pill now
 *   renders *on* while it is doing that: it was previously drawn in the off
 *   state while reading "Upcoming only", so an active filter looked like an
 *   available one, and the list looked short for no visible reason.
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
  const { sport } = useSport();
  const { openModal, closeModal } = useModal();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const here = useHereOnce({ resumeWhenGranted: true });

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

  const [kind, setKind] = useState<EventKind | null>(null);
  const [mySportOnly, setMySportOnly] = useState(true);
  const [showPast, setShowPast] = useState(false);
  const [country, setCountry] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [going, setGoing] = useState<ReadonlySet<string>>(
    () => new Set(view.events.filter((e) => e.going).map((e) => e.id)),
  );

  const list = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const narrowed = view.events.filter((event) => {
      if (kind && event.kind !== kind) return false;
      if (mySportOnly && !event.sportIds.includes(sport)) return false;
      if (!showPast && event.past) return false;
      if (country && event.country !== country) return false;
      if (needle) {
        const haystack =
          `${event.name} ${event.town} ${event.venue} ${event.country}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });

    // Nearest first only while the rider is actually sharing a position.
    // Without one the list stays in date order, which is the page's promise.
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
  }, [view.events, kind, mySportOnly, showPast, sport, country, search, here.point]);

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
      const result = await setAttendanceAction(event.id, next);
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

  const openDetails = (event: EventView) => {
    openModal(
      <EventDetail
        event={event}
        distance={here.point ? distanceLabelIn(here.point, event, units) : null}
        signedIn={signedIn}
        going={going.has(event.id)}
        onToggle={() => {
          toggle(event);
          closeModal();
        }}
        onClose={closeModal}
      />,
      { width: 460, label: event.name },
    );
  };

  const goingCount = going.size;

  return (
    <div className={styles.page}>
      <SectionTabs tabs={WHATS_ON_TABS} label="What’s on" />

      <SportSwitch note={(id) => `${view.countBySport[id] ?? 0} on`} label="Events by sport" />

      <div className={styles.headRow}>
        <div>
          <span className="eyebrow">Events</span>
          <h1 className={`d ${styles.head}`}>What&rsquo;s coming up</h1>
        </div>
        <p className={styles.lede}>
          Comps, coached sessions and one-skill classes near you. Staff add them, so the list stays
          real.
        </p>
      </div>

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
        {/*
          Two pills rather than one toggle. This filter is *on* when the page
          loads, and a single pill drawn in the off state while reading
          "Upcoming only" said the opposite — it read as a filter waiting to be
          applied, so a rider seeing a short list had no way to tell that past
          events were already hidden.
        */}
        <Pill on={!showPast} onClick={() => setShowPast(false)}>
          Upcoming only
        </Pill>
        <Pill on={showPast} onClick={() => setShowPast(true)}>
          Including past
        </Pill>
        <Pill on={mySportOnly} onClick={() => setMySportOnly((v) => !v)}>
          {mySportOnly ? `Good for ${SPORTS[sport].short}` : 'Every sport'}
        </Pill>
      </div>

      {list.length ? (
        <div className={styles.list}>
          {/*
            Said only while it is true, so the screen gains nothing in its
            ordinary state and says the one thing that changed when it changes.
            First child of the list, so it takes the list's own 12px gap.
          */}
          {here.state === 'on' && <div className={`lab ${styles.order}`}>Nearest first</div>}
          {shown.map((event) => (
            <Panel
              flat
              key={event.id}
              className={`${styles.row} ${event.past ? styles.rowPast : ''}`}
            >
              <div className={styles.date} style={{ background: event.kindColor }}>
                <span className={`d ${styles.dateDay}`}>{event.day}</span>
                <span className={`lab ${styles.dateMonth}`}>{event.month}</span>
              </div>

              <div className={styles.rowBody}>
                <div className={styles.rowMain}>
                  <div className={styles.chips}>
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
                    {event.past && <span className={`lab ${styles.muted}`}>Been and gone</span>}
                  </div>
                  <div className={`d ${styles.name}`}>{event.name}</div>
                  <div className={`lab ${styles.meta}`}>
                    {[event.venue, event.town, event.country, event.level]
                      .filter(Boolean)
                      .join(' · ')}
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
                  {signedIn ? (
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
          title="Nothing listed yet"
          sub={`No ${SPORTS[sport].short.toLowerCase()} events on the calendar for that filter. Try every sport, or check back.`}
          cta="Show everything"
          onCta={() => {
            setKind(null);
            setMySportOnly(false);
            setCountry('');
            setSearch('');
            setShowPast(false);
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

      {goingCount > 0 && (
        <Panel className={styles.tally}>
          <span className={styles.tallyIcon}>
            <Icon name="flag" size={21} strokeWidth={2.3} />
          </span>
          <div className={styles.tallyBody}>
            <div className={`cond ${styles.tallyHead}`}>
              You&rsquo;re down for {goingCount} event{goingCount === 1 ? '' : 's'}
            </div>
            <p className={styles.tallyNote}>
              Entry and payment happen at the venue for now. We&rsquo;ll add booking once organisers
              are on board.
            </p>
          </div>
        </Panel>
      )}
    </div>
  );
}

/**
 * The detail modal — the screen's decision point, and therefore where the
 * address, the phone number, the organiser's page and the caution all live.
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
function EventDetail({
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
  return (
    <div>
      <div className={styles.modalHead} style={{ background: event.kindColor }}>
        <div className={styles.chips}>
          <Tag color="var(--ink)">{event.kind}</Tag>
          {event.sports.map((s) => (
            <Tag key={s.id} color="var(--paper)" className={styles.tagInk}>
              {s.label}
            </Tag>
          ))}
        </div>
        <div className={`d ${styles.modalTitle}`}>{event.name}</div>
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
          {signedIn ? (
            <Button
              className={styles.push}
              onClick={onToggle}
              style={going ? { background: 'var(--green)' } : undefined}
            >
              {going ? "✓ You're going" : "I'm going"}
            </Button>
          ) : (
            <Link className={`btn ${styles.push}`} href={signInHref(ROUTES.events)}>
              Sign in to save
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
