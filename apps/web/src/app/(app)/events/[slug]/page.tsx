import {
  DEFAULT_TIMEZONE,
  SITE_URL,
  eventBySlug,
  type LandItEvent,
  type Spot,
  type SportId,
} from '@landit/core';
import { eventsFromRecords, listEventAttendance, listEvents, listSpots } from '@landit/db';
import { Panel, SportChip, Tag, type IconName } from '@landit/ui-web';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ROUTES, eventHref, reportHref, signInHref } from '@/lib/routes';
import { anonymousClient, currentRider } from '@/lib/session';
import { eventLd, jsonLdText } from '@/lib/structuredData';

import { EventArea } from './EventArea';
import { GoingToggle } from './GoingToggle';
import { PageOpened } from './PageOpened';
import { buildEventPageView, type EventPageView, type OnwardBlock } from './view';
import styles from './event.module.css';

/**
 * One event, at its own address (design-handoff/event-spot-pages, "Screen 1").
 *
 * Until now an event's detail existed only inside a modal on `/events`, which
 * meant it had no URL: nothing to share, nothing to crawl, nothing to link a
 * spot or another listing at. This is that content promoted to a page — the
 * modal's design is good and is the starting point — plus the four things a
 * modal cannot carry: a real `<h1>`, the map and its caption, a rail, and
 * somewhere to go next when the answer is "not this one".
 *
 * **The map is the real one** (`EventArea`), drawn as an area rather than a
 * pin, because an event's coordinates are its town and not its gate.
 *
 * **Readable signed out**, on exactly the terms `/events` already is: the
 * `events` collection's list rule is `is_live = true` with no auth arm, so a
 * live event has always been public data. What signing in adds is "I'm going".
 *
 * **Nobody else's attendance is on this page and never can be.**
 * `event_attendance` is `OWN_AND_CONSENTED`, so there is no count to render, no
 * list to withhold and nothing a crawler could scrape — a list of children who
 * will be at a park on Saturday is the stranger-contact surface this product
 * does not have (plan §6.1). The rail says so in a sentence, and the sentence
 * is load-bearing rather than decorative.
 *
 * **There is no Distance fact cell, and its absence is the privacy position.**
 * The design's fact grid has six cells and the sixth is "about 4 miles away",
 * computed from where the reader is. This page is rendered on the server for a
 * crawler as much as for a rider, and a rider's position never reaches the
 * server (plan §6.4 standard 10) — "Near me" is asked for, and answered,
 * entirely in the browser on `/events`. So the grid has five cells and the last
 * one spans, rather than a cell that quietly asks a child's browser where they
 * are in order to fill a hole in a layout.
 */

export const dynamic = 'force-dynamic';

/*
 * `force-dynamic`, for the same reason `sitemap.ts` and `robots.ts` carry it,
 * and for one more that is specific to this page.
 *
 * The shared reason: this route reads the events collection at request time,
 * and baking it would freeze the listing to whatever the database held during
 * `docker build` — which, on a box where the build has no database at all, is
 * nothing.
 *
 * The reason that is this page's own: **the date state is in the markup.** A
 * crawler and a link preview only ever see what the server rendered, so an
 * "over" badge painted after hydration would be indexed as "upcoming" forever;
 * and a statically cached page would still be saying "3 days away" next year,
 * to everyone, having been correct exactly once. The state is derived per
 * request from the reader's own clock (`eventDateState`), which only means
 * anything if there is a request.
 */

type Params = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string }>;
};

/**
 * Where the reader came from, for `event_page_opened`.
 *
 * A value we do not recognise reads as `direct`, which is also what a shared
 * link, a search result and a typed address are. Nothing a reader can put in
 * the query string reaches the analytics property — the three strings are
 * chosen here (`analytics.ts`: catalogue facts, never rider facts).
 */
function sourceOf(from: string | undefined): 'list' | 'modal_cta' | 'direct' {
  if (from === 'list') return 'list';
  if (from === 'modal_cta') return 'modal_cta';
  return 'direct';
}

async function load(slug: string) {
  const session = await currentRider();
  const client = session?.client ?? anonymousClient();

  /*
   * A visitor has no attendance to fetch, and asking anyway would be a request
   * the `OWN` rule can only answer with an empty list. Spots ride along for the
   * "spots near" block; `listSpots` returns live spots plus the caller's own
   * pending ones, so the filter below is what keeps somebody's unchecked
   * submission off a public page.
   */
  const [eventRecords, spotRecords, attendance] = await Promise.all([
    listEvents(client),
    listSpots(client),
    session ? listEventAttendance(client, session.rider.id) : Promise.resolve([]),
  ]);

  const events: readonly LandItEvent[] = eventsFromRecords(eventRecords);
  const event = eventBySlug(slug, events);
  if (!event) return null;

  const record = eventRecords.find((row) => row.slug === slug);
  if (!record) return null;

  const spots: (Spot & { slug: string })[] = spotRecords
    .filter((row) => row.status === 'live')
    .map((row) => ({
      // The slug is the row's, not the place's: `Spot` in `@landit/core` has no
      // such field, and the "spots near" block needs one to link with.
      slug: row.slug,
      name: row.name,
      town: row.town,
      type: row.type,
      lat: row.lat,
      lng: row.lng,
      sports: (row.sports ?? []) as SportId[],
      tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
      status: row.status,
      ...(row.country ? { country: row.country } : {}),
    }));

  const going = attendance.some((row) => row.event === record.id);

  const view = buildEventPageView({
    event,
    events,
    spots,
    clock: { timezone: session?.rider.timezone || DEFAULT_TIMEZONE },
  });

  return { view, event, recordId: record.id, going, signedIn: Boolean(session) };
}

/** `text`, cut to at most `max` characters on a word boundary. */
function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:]$/, '')}…`;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: 'Event not found · Land The Trick' };

  const { view } = data;
  const where = [view.town, view.country].filter(Boolean).join(', ');
  const title = `${view.name}, ${view.town} · Land The Trick`;
  /*
   * The date and the place first, then the organiser's own blurb. That order is
   * the point: this is the sentence a search result shows and the one an answer
   * engine reads, and "a jam in Ventnor on Saturday 26 September" is what
   * somebody was searching for. Trimmed to roughly what a result will show, on
   * a word so it never ends mid-syllable.
   */
  const description = view.blurb
    ? `${view.kind} at ${view.venue}, ${where}, on ${view.longDate}. ${clamp(view.blurb, 120)}`
    : `${view.kind} at ${view.venue}, ${where}, on ${view.longDate}.`;
  const url = eventHref(view.slug);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
  };
}

export default async function EventPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();

  const { view, event, recordId, going, signedIn } = data;
  const source = sourceOf((await searchParams).from);
  const near = view.onward.find((block) => block.id === 'near');
  const venueBlock = view.onward.find((block) => block.id === 'venue');

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        // Escaped by `jsonLdText`, so a `<` in staff copy cannot close this tag.
        // There is no other way to put JSON-LD on a page.
        dangerouslySetInnerHTML={{
          __html: jsonLdText(eventLd(event, { url: `${SITE_URL}${eventHref(view.slug)}` })),
        }}
      />
      <PageOpened source={source} kind={view.kind} />

      <nav className={styles.crumb} aria-label="Breadcrumb">
        <Link href={ROUTES.events}>Events</Link>
        {view.country && (
          <>
            <span aria-hidden="true">/</span>
            <span>{view.country}</span>
          </>
        )}
        <span aria-hidden="true">/</span>
        <span>{view.town}</span>
      </nav>

      <Panel className={styles.head}>
        <div
          className={`${styles.band}${view.state === 'over' ? ` ${styles.bandOver}` : ''}`}
          style={{ background: view.state === 'over' ? 'var(--ink)' : view.kindColor }}
        >
          <div className={styles.chips}>
            {/* Ink on a colour band; the kind's own colour once the band drops
                to ink, where an ink tag would simply disappear. */}
            <Tag color={view.state === 'over' ? view.kindColor : 'var(--ink)'}>{view.kind}</Tag>
            {view.state === 'over' && <Tag color="var(--red)">Over</Tag>}
            {view.sports.map((sport) => (
              <SportChip
                key={sport.id}
                small
                sport={{ label: sport.label, color: sport.color, icon: sport.icon as IconName }}
              />
            ))}
          </div>
          <h1 className={`d ${styles.title}`}>{view.heading}</h1>
          <div className={styles.sub}>{view.subLine}</div>
        </div>

        <StatusBand view={view} hasNear={Boolean(near)} hasVenue={Boolean(venueBlock)} />
      </Panel>

      <div className={styles.cols}>
        {/* A `div`, not a second `<main>`: the shell already owns `<main
            id="main">` and one page may only have one. This is the reading
            column beside the rail. */}
        <div className={`${styles.main}${view.state === 'over' ? ` ${styles.mainOver}` : ''}`}>
          {view.state === 'over' && (
            <div className={`d ${styles.stamp}`}>
              Kept online for the record. Nothing here is happening.
            </div>
          )}

          {view.blurb && <p className={styles.lede}>{view.blurb}</p>}

          <div className={styles.facts}>
            <Fact
              label="Where"
              value={view.venue}
              note={[view.town, view.country].filter(Boolean).join(', ')}
            />
            <Fact label="Who for" value={view.level} />
            <Fact label="Cost" value={view.price} note="As listed by the organiser" />
            <Fact label="Places" value={view.places} />
            <Fact label="Date" value={view.dateValue} note={view.dateQualifier} />
          </div>

          <Panel flat>
            <div className={styles.panelHead}>
              <span className="lab">Getting there &amp; who runs it</span>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.rows}>
                <div className={styles.row}>
                  <span className="lab" style={{ color: 'var(--ink-3)' }}>
                    Address
                  </span>
                  <div className={styles.rowValue}>
                    {view.address ? (
                      <>
                        {view.address}
                        {/*
                          On its own line rather than trailing the address.
                          Inline, it read as the last clause of the street —
                          "…, M5 4BE Open in maps →" — and on a phone the arrow
                          wrapped away from its own words.
                        */}
                        {view.mapsUrl && (
                          <a
                            className={`cond ${styles.und} ${styles.rowAction}`}
                            href={view.mapsUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open in maps &rarr;
                          </a>
                        )}
                      </>
                    ) : (
                      <span className={styles.notListed}>No address listed</span>
                    )}
                  </div>
                </div>

                <div className={styles.row}>
                  <span className="lab" style={{ color: 'var(--ink-3)' }}>
                    Phone
                  </span>
                  <div className={styles.rowValue}>
                    {view.phone ? (
                      /* Shown exactly as the venue publishes it; only the href
                         is normalised (`eventPhoneLink`). */
                      view.phoneLink ? (
                        <a className={`cond ${styles.und}`} href={view.phoneLink}>
                          {view.phone}
                        </a>
                      ) : (
                        view.phone
                      )
                    ) : (
                      <span className={styles.notListed}>No phone listed</span>
                    )}
                  </div>
                </div>

                <div className={styles.row}>
                  <span className="lab" style={{ color: 'var(--ink-3)' }}>
                    Listing
                  </span>
                  <div className={styles.rowValue}>
                    {view.sourceUrl ? (
                      <>
                        <a
                          className={`cond ${styles.und}`}
                          href={view.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {view.sourceHost || 'The organiser’s page'}
                        </a>{' '}
                        <span style={{ color: 'var(--ink-3)' }}>
                          — the organiser&rsquo;s own page
                        </span>
                      </>
                    ) : (
                      <span className={styles.notListed}>No listing link</span>
                    )}
                  </div>
                </div>
              </div>

              <p className={`${styles.note} ${styles.noteSpaced}`}>
                Every detail here comes from the organiser&rsquo;s listing. We add nothing they
                haven&rsquo;t published, so some rows read &ldquo;not listed&rdquo;. Check with them
                before travelling.
              </p>
            </div>
          </Panel>

          {view.onward.length > 0 && (
            <div className={styles.onward}>
              {view.onward.map((block) => (
                <Onward key={block.id} block={block} />
              ))}
            </div>
          )}
        </div>

        <aside className={styles.rail}>
          {(signedIn || view.state !== 'over') && (
            <Panel>
              <div className={styles.panelHead}>
                <span className="lab">Your own note</span>
              </div>
              <div className={`${styles.panelBody} ${styles.stack}`}>
                {view.state === 'over' ? (
                  <>
                    <div className={styles.wentRow}>
                      {going ? (
                        <>
                          <Tag color="var(--ink)">Went</Tag>
                          <span className={`cond ${styles.wentNote}`}>You marked this one</span>
                        </>
                      ) : (
                        <span className={`cond ${styles.wentNote}`}>
                          You didn&rsquo;t mark this one
                        </span>
                      )}
                    </div>
                    <p className={styles.privateNote}>
                      <span className={styles.privateDot} aria-hidden="true" />
                      <span>
                        <strong>Private.</strong> Still only visible to you.
                      </span>
                    </p>
                    <Link className="btn sm ghost wide" href={ROUTES.library}>
                      Log what you landed
                    </Link>
                  </>
                ) : signedIn ? (
                  <>
                    <GoingToggle
                      slug={view.slug}
                      name={view.name}
                      kindColor={view.kindColor}
                      initial={going}
                    />
                    <p className={styles.privateNote}>
                      <span className={styles.privateDot} aria-hidden="true" />
                      <span>
                        <strong>Private.</strong> Only you can see this. Land The Trick has no
                        attendee list and never shows who is going.
                      </span>
                    </p>
                  </>
                ) : (
                  <>
                    <Link className="btn sm wide" href={signInHref(eventHref(view.slug))}>
                      Sign in to save this
                    </Link>
                    <p className={styles.privateNote}>
                      <span className={styles.privateDot} aria-hidden="true" />
                      <span>
                        <strong>Private.</strong> Only you would see it. Land The Trick has no
                        attendee list and never shows who is going.
                      </span>
                    </p>
                  </>
                )}
              </div>
            </Panel>
          )}

          {view.point && (
            <Panel className={styles.mapPanel}>
              <div className={styles.panelHead}>
                <span className="lab">Roughly here</span>
              </div>
              <div className={styles.mapStage}>
                <EventArea lat={view.point.lat} lng={view.point.lng} town={view.town} />
              </div>
              {/*
                Under the map rather than floating on it. The claim is the
                design (`view.mapCaption`), and a caption sitting over the
                bottom of a live map is a caption a rider can pan the ground
                out from under — and one that covers the attribution the tiles
                are used on condition of.
              */}
              <p className={styles.mapCaption}>{view.mapCaption}</p>
              <div className={`${styles.panelBody} ${styles.tight} ${styles.stack}`}>
                <a
                  className="btn sm ghost wide"
                  href={view.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in maps &rarr;
                </a>
                <p className={styles.note}>
                  We hold the town, not a pin. The circle is the area, not the gate.
                </p>
              </div>
            </Panel>
          )}

          {/* The only marketing on the page, and only where it means anything —
              a signed-in rider is not asked to sign up. Nothing on this page is
              behind it either way. */}
          {!signedIn && (
            <Panel className={styles.signup}>
              <div className={styles.panelBody}>
                <h2 className={`d ${styles.signupHead}`}>Track what you land</h2>
                <p className={styles.signupCopy}>
                  Riders use Land The Trick to log tricks, work through stages and collect awards.
                  Free to start, and nothing on this page is behind it.
                </p>
                <Link className="btn ink wide" href={ROUTES.signUp}>
                  Sign up free
                </Link>
              </div>
            </Panel>
          )}

          <Panel flat className={styles.report}>
            <div className={`${styles.panelBody} ${styles.tight} ${styles.stack}`}>
              <span className="lab" style={{ color: 'var(--ink-3)' }}>
                Something wrong?
              </span>
              <p className={styles.note}>Date moved, event cancelled, wrong address?</p>
              {/*
                `other` because the report form has no "an event" subject yet —
                its four are profile, spot, video and something else. Sending an
                event under `spot` would file it in the wrong queue; `other`
                carries the record id and lets staff resolve it.
              */}
              <Link
                className={styles.reportLink}
                href={reportHref({ type: 'other', id: recordId })}
              >
                Report a problem with this listing
              </Link>
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

/** One cell of the fact grid: a label, a value, and an optional qualifier. */
function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={styles.fact}>
      <div className="lab" style={{ color: 'var(--ink-3)' }}>
        {label}
      </div>
      <div className={styles.factValue}>{value}</div>
      {note && <p className={styles.factNote}>{note}</p>}
    </div>
  );
}

/**
 * The state machine, in a strip under the band.
 *
 * Each state changes three things at once — the band's colour, this strip, and
 * the rail — so which one it is can be read in a thumbnail. Colour never
 * carries it alone: every state is also stated in words.
 */
function StatusBand({
  view,
  hasNear,
  hasVenue,
}: {
  readonly view: EventPageView;
  readonly hasNear: boolean;
  readonly hasVenue: boolean;
}) {
  if (view.state === 'today') {
    return (
      <div className={`${styles.status} ${styles.statusToday}`}>
        <div className={`d ${styles.big}`}>Happening today</div>
        <div className={styles.when}>{view.longDate} · All day</div>
        {view.mapsUrl && (
          <div className={styles.push}>
            <a className="btn sm ink" href={view.mapsUrl} target="_blank" rel="noreferrer">
              Open in maps
            </a>
          </div>
        )}
      </div>
    );
  }

  if (view.state === 'over') {
    return (
      <div className={`${styles.status} ${styles.statusOver}`}>
        <div>
          <div className={`d ${styles.big}`}>This event has finished</div>
          <div className={styles.when}>
            Was {view.longDate}
            {view.agoLabel ? ` · ${view.agoLabel}` : ''}
          </div>
        </div>
        {(hasNear || hasVenue) && (
          <div className={styles.push}>
            {hasNear && (
              <a className={styles.onwardLink} href="#near">
                What&rsquo;s on near {view.town} &rarr;
              </a>
            )}
            {hasVenue && (
              <a className={styles.onwardLink} href="#venue">
                Next at this venue &rarr;
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`${styles.status} ${styles.statusUpcoming}`}>
      <div className={styles.count}>
        <span className={`d ${styles.countN}`}>{view.daysAway}</span>
        <div>
          <div className={`d ${styles.countLabel}`}>
            {view.daysAway === 1 ? 'Day away' : 'Days away'}
          </div>
          <div className={styles.when}>{view.longDate}</div>
        </div>
      </div>
      <div className={styles.push}>
        <span className="lab" style={{ color: 'var(--ink-3)' }}>
          {[view.price, view.places].filter(Boolean).join(' · ')}
        </span>
      </div>
    </div>
  );
}

/**
 * One onward block: a section head with its rule, a list of rows, and the note
 * the list needs to be honest about what "near" means here.
 */
function Onward({ block }: { readonly block: OnwardBlock }) {
  return (
    <section id={block.id}>
      <div className="sechead">
        <h2>{block.heading}</h2>
        <span className="rule" />
        {block.more && (
          <Link className="more" href={block.more.href}>
            {block.more.label}
          </Link>
        )}
      </div>
      <div className={styles.olist}>
        {block.rows.map((row) =>
          row.href ? (
            <Link key={row.key} className={styles.olistRow} href={row.href}>
              <span className={styles.lead}>{row.lead}</span>
              <span className={styles.olistName}>{row.name}</span>
              <span className={styles.olistMeta}>{row.meta}</span>
            </Link>
          ) : (
            /* No page to send anybody to yet, so it is a row and not a link
               (LESSONS §3a). `/spots/[slug]` is being built beside this one. */
            <div key={row.key} className={styles.olistRow}>
              <span className={styles.lead}>{row.lead}</span>
              <span className={styles.olistName}>{row.name}</span>
              <span className={styles.olistMeta}>{row.meta}</span>
            </div>
          ),
        )}
      </div>
      {block.note && <p className={styles.blockNote}>{block.note}</p>}
    </section>
  );
}
