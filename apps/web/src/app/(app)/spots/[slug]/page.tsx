import {
  isIndexedSpotSource,
  SITE_URL,
  SPOT_SOURCES,
  distanceLabelIn,
  distanceMiles,
  hasCoords,
  mapsLink,
  regionFromAcceptLanguage,
  spotFeature,
  spotLatLng,
  unitsForCountry,
  type SportId,
} from '@landit/core';
import { getSpotBySlug, listSpotsNear, type SpotsRecord } from '@landit/db';
import { Icon, Panel, SportChip, Tag } from '@landit/ui-web';
import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { LogSessionLink } from '@/components/sessions/blocks/LogSessionLink';
import { SpotSessionsBlock } from '@/components/sessions/blocks/SpotSessionsBlock';
import { BackLink } from '@/components/shell/BackLink';
import { jsonLdText, spotPlaceLd } from '@/lib/structuredData';
import { ROUTES, libraryHref, reportHref, spotHref } from '@/lib/routes';
import { newSessionHref } from '@/lib/sessionRoutes';
import { sessionsEnabledForViewer } from '@/lib/sessionsPreview';
import { SPORT_LOOKS, sportsList } from '@/lib/sports';
import { anonymousClient, currentRider } from '@/lib/session';

import { toSpotView } from '../view';

import { SpotFave } from './SpotFave';
import { SpotPageOpened } from './SpotPageOpened';
import { SpotPin } from './SpotPin';
import styles from './spot.module.css';

/**
 * One spot, at its own address (design handoff "Screen 2 — Spot page").
 *
 * **Why a page exists for a record this thin.** A spot holds a name, a town, a
 * type, a coordinate pair and a handful of tags — call it twenty-five words.
 * Ninety-odd pages built from twenty-five words each is the doorway pattern,
 * and publishing them would earn the demotion it deserves. What makes this page
 * worth serving is the **"What's here" grid**: the tags stop being a filter
 * facet and become an explanation of what a bowl, a ledge or a spine actually
 * is, written once and held in `@landit/core` (`SPOT_FEATURES`). That is real
 * content, it is useful to a twelve-year-old who has never been to a park, and
 * it is the reason nothing else on this page is padded out to fill space.
 *
 * **Only approved spots get one** (Rachid, 2026-09-06, in chat: pages for spots
 * "confirmed by us only"). `getSpotBySlug` filters to `status = 'live'`, so a
 * rider's own pending submission — which they can still see on `/spots`,
 * exactly as before — answers here with a 404 and never reaches the sitemap.
 * That is what stops an unreviewed name a child typed becoming a public URL.
 *
 * **`submitted_by` is never rendered.** Not the name, not the handle, not the
 * id, not "submitted by a rider in Ventnor". The record carries it; nothing on
 * this page, in its metadata, or in its JSON-LD reads it, and the analytics
 * event does not either.
 *
 * **Readable signed out**, like `/spots` and the library: a spot is a public
 * place and there is nothing private here. Signing in changes one thing — the
 * yellow panel stops asking.
 */

type Params = { params: Promise<{ slug: string }> };

/** How many other spots the onward list shows. Enough to be a route out, not a directory. */
const NEARBY = 4;

/**
 * How close the nearest other spot has to be before the onward section is
 * allowed to call itself "near {town}".
 *
 * A round number rather than a researched one, and it exists because the list
 * is global and thin in most countries: Adelaide's closest neighbour in this
 * data is four hundred miles away, and a heading reading "other spots near
 * Adelaide" over that list is a claim its own rows disprove.
 */
const NEAR_ENOUGH_MILES = 50;

/**
 * "A concrete park in Ventnor", "A street spot in Ventnor".
 *
 * The three stored types are `Concrete`, `Street spot` and `Indoor park`, and
 * only the first needs a word adding to read as English mid-sentence. A spot
 * whose type is empty or is something else entirely gets the plain noun rather
 * than a guess — several rows predate the type list.
 */
function typePhrase(type: string): string {
  const known: Record<string, string> = {
    Concrete: 'concrete park',
    'Street spot': 'street spot',
    'Indoor park': 'indoor park',
  };
  return known[type] ?? (type ? type.toLowerCase() : 'spot');
}

/**
 * "a bowl, ledges and rails" — the tag list, as a clause in a sentence.
 *
 * The noun phrase comes from `SPOT_FEATURES`, because "with bowl and flat" is
 * not English and which article a feature wants is a fact about the feature
 * rather than about the sentence. A tag nobody has written an entry for falls
 * back to the tag itself, lowered: clumsier, and it never guesses.
 */
function featureClause(features: readonly string[]): string {
  const names = features.map((tag) => spotFeature(tag)?.phrase ?? tag.toLowerCase());
  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * The opening paragraph, built from the record and from nothing else.
 *
 * Every clause is dropped rather than filled when the field behind it is empty,
 * which is what stops this becoming the generated prose that made thin pages a
 * problem in the first place. The closing sentence is the design's, and it
 * changes with how much the record actually holds: a listing with two features
 * says two features is all it has, because a rider who travels across town for
 * it should have been told.
 */
function lede(spot: SpotsRecord, features: readonly string[]): string {
  const where = spot.town ? ` in ${spot.town}` : '';
  const what = features.length ? ` with ${featureClause(features)}` : '';
  const sports = (spot.sports ?? []) as SportId[];
  const ridden = sports.length ? ` Ridden by ${sportsList(sports)} riders.` : '';

  if (features.length === 0) {
    return `A ${typePhrase(spot.type)}${where}.${ridden} Nobody has told us what is here yet — the map pin and the town are all this listing holds.`;
  }
  if (features.length <= 2) {
    return `A ${typePhrase(spot.type)}${where}${what}.${ridden} ${
      features.length === 1 ? 'One feature is' : 'Two features are'
    } all this one has, and that is worth knowing before you travel across town for it.`;
  }
  return `A ${typePhrase(spot.type)}${where}${what}.${ridden} This page is built from what riders have told us about the spot — the features below are the whole of it.`;
}

/** The record, plus everything the page reads that is not on it. */
async function load(slug: string) {
  const session = await currentRider();
  const client = session?.client ?? anonymousClient();

  const spot = await getSpotBySlug(client, slug);
  if (!spot) return null;

  /*
   * The other spots, for the onward list at the foot of the page.
   *
   * **Never at the cost of this one.** A spot page that cannot be served
   * because a second query failed is a worse outcome than a page without its
   * "other spots near" section — the same rule the trick page reads its award
   * badge under.
   *
   * **Only the spots around this one** (`listSpotsNear`): since the world import
   * there are about thirty thousand live spots, and reading every one of them
   * to show the nearest few was a whole-table read on every page view.
   */
  const others = hasCoords(spot)
    ? await listSpotsNear(client, { lat: spot.lat, lng: spot.lng }).catch((): SpotsRecord[] => [])
    : [];

  /*
   * Miles or kilometres, settled here on the server from the same two signals
   * the spots list uses and in the same order: a signed-in rider's declared
   * country beats a browser setting, and neither is stored. Anything
   * locale-derived that renders on both sides is a hydration risk (LESSONS §5).
   */
  const region = session
    ? session.rider.country
    : regionFromAcceptLanguage((await headers()).get('accept-language'));

  return { spot, others, session, units: unitsForCountry(region) };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: 'Spot not found · Land The Trick' };

  const { spot } = data;
  const place = [spot.town, spot.country].filter(Boolean).join(', ');
  const title = `${spot.name}${spot.town ? `, ${spot.town}` : ''} · Land The Trick`;
  const features = (Array.isArray(spot.tags) ? (spot.tags as string[]) : []).filter((tag) =>
    tag.trim(),
  );

  /*
   * The description is the sentence a search result shows and the one an answer
   * engine reads to decide what this page is about, so it says what the place
   * *is* rather than restating its name. Built from the same fields the page
   * renders — never a claim the page does not carry.
   */
  const description = `${typePhrase(spot.type).replace(/^./, (c) => c.toUpperCase())}${
    place ? ` in ${place}` : ''
  }${features.length ? `, with ${featureClause(features)}` : ''}. What is there, where it is, and the tricks that suit it.`;

  const url = spotHref(spot.slug);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
    /*
     * The world import's pages stay out of search (the owner, 2026-09-11, in
     * chat). Most say a name, a town and a feature or two, and thirty thousand
     * pages like that are the thin, near-duplicate pattern search engines
     * demote a whole site for. The page still serves every rider who reaches
     * it from the map; `isIndexedSpotSource` in `@landit/core` is the rule,
     * and `listIndexedSpots` keeps the same pages out of the sitemap.
     */
    ...(isIndexedSpotSource(spot.source) ? {} : { robots: { index: false } }),
  };
}

export default async function SpotPage({ params }: Params) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();

  const { spot, others, session, units } = data;
  const sports = (spot.sports ?? []) as SportId[];
  const tags = (Array.isArray(spot.tags) ? (spot.tags as string[]) : [])
    .map((tag) => String(tag).trim())
    .filter(Boolean);
  const point = spotLatLng(spot);
  const maps = mapsLink(spot);
  const place = [spot.town, spot.country].filter(Boolean).join(', ');

  /*
   * "Sparse" is a description of the record, not a variant of the page. Two
   * features is a real street spot rather than a broken listing, so the only
   * thing it changes is that the map takes the room the missing cells left —
   * see the note at the head of `spot.module.css` about the band colour.
   */
  const sparse = tags.length <= 2;

  /*
   * The nearest other spots, for the onward list.
   *
   * **This is a distance between two places we both hold exactly**, which is a
   * different thing from the "about 4 miles away" on `/spots` — that one is
   * measured from the rider and needs their position. Nothing here reads or
   * asks for one; the note under the list says which of the two this is.
   */
  const near = point
    ? others
        .filter((other) => other.id !== spot.id && hasCoords(other))
        .map((other) => ({
          spot: other,
          miles: distanceMiles(point, { lat: other.lat, lng: other.lng }),
          away: distanceLabelIn(point, { lat: other.lat, lng: other.lng }, units),
        }))
        .sort((a, b) => a.miles - b.miles)
        .slice(0, NEARBY)
    : [];

  const ld = spotPlaceLd(
    {
      name: spot.name,
      town: spot.town || undefined,
      type: spot.type || undefined,
      lat: spot.lat,
      lng: spot.lng,
      tags,
      address: spot.address || undefined,
      phone: spot.phone || undefined,
      country: spot.country || undefined,
    },
    {
      url: `${SITE_URL}${spotHref(spot.slug)}`,
      description: `${typePhrase(spot.type).replace(/^./, (c) => c.toUpperCase())}${place ? ` in ${place}` : ''}.`,
    },
  );

  return (
    <>
      {/* The text is escaped by `jsonLdText`; a `<` in a spot's name cannot
          close the tag. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(ld) }} />
      <SpotPageOpened
        /*
         * Researched or rider-submitted, which is the question this page has to
         * earn an answer to. Never the spot's name and never its slug — see
         * `SpotPageOpened`.
         */
        origin={spot.submitted_by ? 'submitted' : 'researched'}
        /*
         * Only a catalogue id ever leaves: a value the column holds that the
         * catalogue does not know is reported as such, never forwarded. Rows
         * from before the column existed read '' and are what `origin` says.
         */
        source={
          spot.source in SPOT_SOURCES
            ? spot.source
            : spot.source
              ? 'unknown'
              : spot.submitted_by
                ? SPOT_SOURCES.rider.id
                : SPOT_SOURCES.researched.id
        }
        type={spot.type || 'unknown'}
        operating={spot.operating || 'unknown'}
        indoor={Boolean(spot.indoor)}
      />

      {/*
        "Spots", the group's back link (§2.3, T52), where a three-part
        breadcrumb used to be.

        The trail said `Spots / Great Britain / Corby` at 12.5px, and its two
        tail segments were plain text repeating the sub-line under the title,
        which already reads "Corby, Great Britain". What was load-bearing was
        the first segment — the way back to the list — and at 12.5px with no
        padding it was the smallest target on the page. `BackLink` is the
        product's one shape for that now, at §4's 44px.
      */}
      <BackLink href={ROUTES.spots} label="Spots" />

      <div className={styles.band}>
        <div className={styles.chips}>
          {spot.type ? <Tag color="var(--ink)">{spot.type}</Tag> : null}
          {sports.map((id) => (
            <SportChip key={id} sport={SPORT_LOOKS[id]} />
          ))}
        </div>
        <h1 className={styles.title}>
          {spot.name}
          {spot.town ? `, ${spot.town}` : ''}
        </h1>
        {place ? <p className={styles.sub}>{place}</p> : null}
      </div>

      <div className={styles.strip}>
        {spot.type ? (
          <div className={styles.stripItem}>
            <span className={`lab ${styles.stripLabel}`}>Type</span>
            <span className={styles.stripValue}>{typePhrase(spot.type)}</span>
          </div>
        ) : null}
        {spot.indoor ? (
          <div className={styles.stripItem}>
            <span className={`lab ${styles.stripLabel}`}>Cover</span>
            <span className={styles.stripValue}>Indoor</span>
          </div>
        ) : null}
        <div className={styles.stripItem}>
          <span className={`lab ${styles.stripLabel}`}>What&rsquo;s here</span>
          <span className={styles.stripValue}>
            {tags.length === 0
              ? 'Not listed'
              : `${tags.length} ${tags.length === 1 ? 'feature' : 'features'}`}
          </span>
        </div>
        {/*
          No distance line. Distance belongs to the reader, not to the spot, and
          this page is rendered on the server for a reader whose position we do
          not have and do not ask for (§6.4 standard 10). The design's "about 4
          miles away" is true on `/spots`, where the rider has pressed for it;
          printing a number here would mean either inventing one or asking a
          child for their location to fill a strip. Issue filed to bring the
          reader's own distance in from the list screen.
        */}
        {/*
          Fave, and Directions. Both are "what do I do with this place now",
          which is what the right-hand end of the strip is for.

          `SpotFave` is a client island and renders nothing at all for a reader
          with no account — which is what keeps this page's *server* render
          independent of who is reading it. A public, crawlable page whose HTML
          differed by rider would be a page no cache could hold.
        */}
        {/*
          The three actions (§3.10, T52): Faved · Directions · Log here.

          One place in the DOM, two shapes. Above 820px they sit at the
          right-hand end of the strip — the hero band's second half, which is
          where the design puts them on a desktop. Below it the strip's own
          `flex-wrap` drops them onto a line of their own under the hero, where
          they take equal thirds of the width and the whole row is a thumb's
          reach. Two copies of the same three buttons behind a media query would
          be two things to keep in step.

          Not all three are always there, which is why they share the width
          rather than each taking a third of it: `SpotFave` draws nothing at all
          for a reader with no account, and "Log here" is behind the sessions
          preview, so a signed-out visitor gets Directions alone and it fills the
          row rather than sitting in a third of it.
        */}
        <div className={styles.stripPush}>
          <SpotFave spot={toSpotView(spot)} signedIn={!!session} />
          {/*
            **The arrow becomes the external mark, and the name says Google
            Maps** (Rachid, 2026-09-17, in chat: "the directions should make
            more clear it opens google maps").

            `mapsLink` is `google.com/maps/search/?api=1&query=…` on every
            platform, so naming it is a fact rather than a guess.

            **The visible word stays "Directions" here, where the spots list
            card says "Directions in Google Maps" in full** *(added by the
            owner-pass-1 worker, 2026-09-17, pending owner confirmation)*. This
            is one of three actions sharing the width in equal thirds on a
            phone, `white-space: nowrap`, about 124px each at 390 — four words
            in caps do not go in it, and letting them wrap would make a
            three-line button beside two one-line ones. The list card's row
            wraps and has the room, so it carries the words. What both have in
            common is the part that does the work for everyone: the external
            glyph, and an accessible name that says where the link goes and that
            it opens a new tab.
          */}
          {maps ? (
            <a
              className={`btn sm ${styles.action}`}
              href={maps}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={`Directions to ${spot.name} in Google Maps, opens in a new tab`}
            >
              Directions
              <Icon name="external" size={14} strokeWidth={2.4} />
            </a>
          ) : null}
          {/*
            "Log here" goes where it went before: `newSessionHref({ spot })`,
            the same address as the "Log a session here" link inside "Your
            sessions here", counted through the same `LogSessionLink` with the
            same `source: 'spot'`. And behind the same gate — sessions are in
            owner-only preview (T41) — asked **exactly** as `riderFor` asks it
            for the block below: is there a rider, *and* is it on for them.

            Both halves, and through one named predicate rather than an `&&`
            somebody has to remember. `sessionsEnabledFor` answers `true` for a
            `null` rider once `LANDIT_SESSIONS_OPEN` is set, which is how a
            release will run it, so `sessionsEnabledFor(session?.rider ?? null)`
            put a "Log here" on a public spot page for a visitor with no account,
            pointing at a form that would bounce them to `/signin`. Caught by the
            signed-out case in `e2e/spot-page.spec.ts` rather than by the flag,
            which is off in most places this is run; `sessionsEnabledForViewer`
            is the expression `riderFor` has always used, with unit tests on the
            case the e2e cannot reach.
          */}
          {sessionsEnabledForViewer(session) ? (
            <LogSessionLink
              href={newSessionHref({ spot: spot.id })}
              source="spot"
              className={`btn sm ${styles.action}`}
            >
              Log here
            </LogSessionLink>
          ) : null}
        </div>
      </div>

      <div className={styles.cols}>
        <main className={styles.main}>
          {/*
            A closed park says so before the page says anything else, and it
            keeps its page rather than vanishing. A rider who has ridden here
            for years and finds the listing simply gone learns nothing; one who
            reads this does not make the journey. `'unknown'` and absent both
            render nothing at all — saying "we think it is open" on the strength
            of no evidence is the failure that sends a child to a building site.
          */}
          {spot.operating === 'closed' ? (
            <p className={styles.closed} role="status">
              <strong>This spot has closed.</strong> It is kept here so the name still finds
              something, but do not travel to it.
            </p>
          ) : null}
          <p className={styles.lede}>{lede(spot, tags)}</p>
          <SpotSessionsBlock spotId={spot.id} session={session} />

          <section>
            <div className={styles.sectionHead}>
              <h2>What&rsquo;s here</h2>
              <span className={styles.sectionRule} aria-hidden="true" />
              <span className={styles.sectionCount}>
                {tags.length === 0
                  ? 'Not listed'
                  : `${tags.length} ${tags.length === 1 ? 'feature' : 'features'}`}
              </span>
            </div>

            {tags.length === 0 ? (
              <Panel flat className={styles.flat2}>
                <div className={styles.panelBody}>
                  <span className={styles.nolisted}>No features listed</span>
                  <p className={styles.note}>
                    Nobody has told us what is at this one yet. The pin is exact, so it is still
                    worth a look — and if you have ridden it, the report link below reaches a human.
                  </p>
                </div>
              </Panel>
            ) : (
              /*
                Coloured cards, one per feature (§3.10, T52).

                They were paper cells in a hairline grid with a 9px accent bar
                above each name — the colour was a stripe on the card rather
                than the card. §3.10 asks for `LinkCard`s, which is Home's
                coloured card that is a link: the fill carries the colour, the
                whole box is the target, and an arrow at the bottom right says
                it goes somewhere.

                **The look, not the component.** Home's `LinkCard` fires
                `nav_clicked` `{ to, where: 'home-card' }`, and `to` is one of
                four route ids; a spot's feature is neither, so using it here
                would mean inventing a property value at the call site — the one
                thing `analytics.ts` forbids. These fire nothing, as T48 decided
                for the Find hub's section links, and what measures the screen is
                the `spot_page_opened` it already sends.

                **The fill is the design system's own tint recipe** —
                `color-mix(in oklab, <accent> 42%, #fff)`, which is what
                `StickerBadge` fills its disc with — rather than the accent at
                full strength. Eight accents reach this grid, `--violet` and
                `--blue` among them, and ink on either at full strength is the
                contrast failure `.btn`'s own note in `primitives.css` records.
                The tint keeps the colour-coding and keeps one text colour.
              */
              <div className={styles.whats}>
                {tags.map((tag) => {
                  const feature = spotFeature(tag);
                  const fill = {
                    background: `color-mix(in oklab, var(--${feature?.accent ?? 'wash'}) 42%, #fff)`,
                  };
                  const body = (
                    <>
                      <h3 className={styles.featureName}>{feature?.label ?? tag}</h3>
                      {/*
                        A tag nobody has written an explanation for is still
                        shown — it is on the record and a rider should see it —
                        but nothing here guesses at what an unknown word means.
                      */}
                      {feature ? <p className={styles.featureAbout}>{feature.about}</p> : null}
                    </>
                  );

                  /*
                    "Bowl tricks →" goes to the library narrowed to the category
                    those tricks are in. There is no feature-to-trick relation in
                    this product and this does not invent one; where no category
                    is honestly the answer — a pump track, moguls — there is
                    nowhere to go, so the card is a card rather than a link with
                    an arrow that lies.
                  */
                  return feature?.tricks ? (
                    <Link
                      key={tag}
                      className={`${styles.feature} ${styles.featureLinked}`}
                      style={fill}
                      href={libraryHref({ cat: feature.tricks })}
                    >
                      {body}
                      <span className={styles.featureGo}>{feature.label} tricks &rarr;</span>
                    </Link>
                  ) : (
                    <div className={styles.feature} style={fill} key={tag}>
                      {body}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {point ? (
            <Panel className={styles.mapPanel}>
              <div className={styles.panelHead}>
                <span className="lab">Where it is</span>
              </div>
              <div className={`${styles.mapStage} ${sparse ? styles.mapStageTall : ''}`}>
                <SpotPin id={spot.id} name={spot.name} lat={point.lat} lng={point.lng} />
              </div>
              <div className={styles.mapFoot}>
                {/*
                  The caption an event page may not use. A spot's coordinates
                  were read off a source and checked against the venue's own
                  page, so the pin is the spot rather than the town.
                */}
                <p className={styles.mapClaim}>The pin is exact</p>
                {maps ? (
                  <div className={styles.mapFootPush}>
                    <a className="btn sm" href={maps} target="_blank" rel="noreferrer noopener">
                      Open in maps &rarr;
                    </a>
                  </div>
                ) : null}
              </div>
            </Panel>
          ) : null}

          {near.length ? (
            <section>
              <div className={styles.sectionHead}>
                <h2>
                  {/*
                    "Near Adelaide" has to be true to be printed. Australia
                    holds four spots and the closest other one is four hundred
                    miles away, so the design's heading would be a claim the
                    list underneath it contradicts. The town appears only when
                    the nearest really is nearby; otherwise the heading says
                    exactly what the list is.
                  */}
                  {spot.town && near[0] && near[0].miles <= NEAR_ENOUGH_MILES
                    ? `Other spots near ${spot.town}`
                    : 'The nearest other spots'}
                </h2>
                <span className={styles.sectionRule} aria-hidden="true" />
                <Link className={styles.sectionMore} href={ROUTES.spots}>
                  Spots map
                </Link>
              </div>
              <div className={styles.olist}>
                {near.map(({ spot: other, away }) => {
                  const otherTags = (
                    Array.isArray(other.tags) ? (other.tags as string[]) : []
                  ).slice(0, 3);
                  return (
                    <Link className={styles.orow} key={other.id} href={spotHref(other.slug)}>
                      <span className={styles.orowKind}>{other.type || 'Spot'}</span>
                      <span className={styles.orowName}>
                        {other.name}
                        {other.town ? `, ${other.town}` : ''}
                      </span>
                      <span className={styles.orowMeta}>
                        {[...otherTags, away ? `about ${away}` : null].filter(Boolean).join(' · ')}
                      </span>
                    </Link>
                  );
                })}
              </div>
              {/* Distance between two spots, both of which we hold exactly —
                  not a distance from the reader, which this page never knows.
                  `miles` above is only the sort key. */}
              <p className={`${styles.note} ${styles.noteAfter}`}>
                Distances are from this spot, not from you.
              </p>
            </section>
          ) : null}
        </main>

        <aside className={styles.rail}>
          <Panel flat>
            <div className={styles.panelHead}>
              <span className="lab">The listing</span>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.rows}>
                {place ? (
                  <div className={styles.row}>
                    <span className={`lab ${styles.rowLabel}`}>Town</span>
                    <div className={styles.rowValue}>{place}</div>
                  </div>
                ) : null}
                {spot.type ? (
                  <div className={styles.row}>
                    <span className={`lab ${styles.rowLabel}`}>Type</span>
                    <div className={styles.rowValue}>{spot.type}</div>
                  </div>
                ) : null}
                <div className={styles.row}>
                  <span className={`lab ${styles.rowLabel}`}>Address</span>
                  <div className={styles.rowValue}>
                    {spot.address ? (
                      spot.address
                    ) : (
                      <>
                        <span className={styles.nolisted}>No address listed</span>
                        {point ? (
                          <p className={`${styles.note} ${styles.noteAfter}`}>
                            The map pin is exact, so directions still work.
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
                <div className={styles.row}>
                  <span className={`lab ${styles.rowLabel}`}>Phone</span>
                  <div className={styles.rowValue}>
                    {spot.phone ? (
                      <a className={styles.phone} href={`tel:${spot.phone.replace(/\s+/g, '')}`}>
                        {spot.phone}
                      </a>
                    ) : (
                      <span className={styles.nolisted}>
                        {spot.type === 'Street spot' ? 'No phone — street spot' : 'No phone listed'}
                      </span>
                    )}
                  </div>
                </div>
                {spot.indoor ? (
                  <div className={styles.row}>
                    <span className={`lab ${styles.rowLabel}`}>Cover</span>
                    <div className={styles.rowValue}>Indoor &mdash; under a roof</div>
                  </div>
                ) : null}
                {sports.length ? (
                  <div className={styles.row}>
                    <span className={`lab ${styles.rowLabel}`}>Good for</span>
                    <div className={`${styles.rowValue} ${styles.rowChips}`}>
                      {sports.map((id) => (
                        <SportChip key={id} sport={SPORT_LOOKS[id]} small />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </Panel>

          {sparse ? (
            <Panel flat className={styles.flat2}>
              <div className={styles.panelBody}>
                <span className="lab">Know this spot?</span>
                <p className={styles.note}>
                  If there is more here than {featureClause(tags) || 'the pin'}, tell us and
                  we&rsquo;ll add it. We never publish who sent a spot in.
                </p>
                <Link
                  className="btn sm ghost wide"
                  href={reportHref({ type: 'spot', id: spot.id })}
                >
                  Tell us what else is here
                </Link>
              </div>
            </Panel>
          ) : null}

          {/*
            The only marketing on the page, and it never gates anything: every
            word above is readable signed out and stays that way. Hidden from a
            rider who already has an account, because "Sign up free" to somebody
            signed in is noise.
          */}
          {session ? null : (
            <Panel className={styles.signup}>
              <div className={styles.panelBody}>
                <h2 className={styles.signupTitle}>Ridden here?</h2>
                <p className={styles.signupBody}>
                  Log the tricks you land, work through the stages and pick up awards. Free to start
                  — this page stays open either way.
                </p>
                <Link className="btn ink wide" href={ROUTES.signUp}>
                  Sign up free
                </Link>
              </div>
            </Panel>
          )}

          <Panel flat className={styles.flat2}>
            <div className={styles.panelBody}>
              <div className={styles.bulleted}>
                <i className={styles.bullet} aria-hidden="true" />
                <p className={styles.note}>
                  Spots are kept up by riders. Gates get locked, parks get resurfaced, ledges get
                  knobbed.
                </p>
              </div>
              <Link className={styles.reportLink} href={reportHref({ type: 'spot', id: spot.id })}>
                Report a problem with this spot
              </Link>
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}

/*
 * Read at request time rather than baked.
 *
 * Same reasoning as `app/sitemap.ts`: the spot list is a database read, and
 * pre-rendering would freeze these pages to whatever the collection held during
 * `docker build` — which on a box where the build has no database is nothing at
 * all. Staff approving a spot should make its page exist, not schedule a
 * deploy.
 */
export const dynamic = 'force-dynamic';
