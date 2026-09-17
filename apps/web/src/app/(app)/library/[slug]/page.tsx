import {
  CATS,
  DEFAULT_TIMEZONE,
  NO_VIDEO_LINKS,
  SITE_URL,
  SPORTS,
  STAGE,
  TIERS_LABEL,
  categoryLabel,
  computeStats,
  crossSportEquivalents,
  currentWeeklyStreak,
  firstLanded,
  fullPrereqChain,
  isTrickLanded,
  isTrickLocked,
  lowdownTeaser,
  prereqTricks,
  similarTricks,
  trickById,
  trickHistory,
  trickPositionFacts,
  tricksUnlockedBy,
  videoLinkAllowance,
  weeklyStreakLabel,
  type Plan,
  type PlanId,
  type StageId,
  type Trick,
  type TrickHistory,
} from '@landit/core';
import {
  countVideoLinks,
  getRiderSticker,
  getTrickAward,
  listPlans,
  listTrickLog,
  listTrickNotes,
  listTrickPrereqs,
  listTrickProgress,
  listTricks,
  riderSnapshot,
  trickLogEntries,
  trickProgressById,
  tricksFromRecords,
  videoLinksFromRecords,
  listVideoLinks,
  type PlansRecord,
  type UsersRecord,
} from '@landit/db';
import { Accordion, Difficulty, Equipment, Panel, SportChip, Tag } from '@landit/ui-web';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';

import { GlossaryText } from '@/components/glossary/GlossaryText';
import { TrickSessionsBlock } from '@/components/sessions/blocks/TrickSessionsBlock';
import { shortDate } from '@/lib/dates';
import { jsonLdText, trickHowToLd } from '@/lib/structuredData';
import { practiseAdvice } from '@/lib/practise';
import { ROUTES, trickHref } from '@/lib/routes';
import { SPORT_LOOKS, lowerLabel } from '@/lib/sports';
import { anonymousClient, currentRider } from '@/lib/session';

import { AwardBadge } from './AwardBadge';
import { BackToLibrary } from './BackToLibrary';
import { CrossSportPanel } from './CrossSportPanel';
import { FactsStrip } from './FactsStrip';
import { GuardianLine } from './GuardianLine';
import { HistoryPanel } from './HistoryPanel';
import { LockedTrick } from './LockedTrick';
import { LogPanel, type NoteView } from './LogPanel';
import { MistakesList } from './MistakesList';
import { PractiseLine } from './PractiseLine';
import { RoadPanel } from './RoadPanel';
import { SimilarTricks } from './SimilarTricks';
import { StagePanel, type TrickShareView } from './StagePanel';
import { WatchPanel } from './WatchPanel';
import styles from './trick.module.css';

/**
 * One trick (screenshot 09), or the locked page in its place (screenshot 10).
 *
 * Which of the two a rider gets is `isTrickLocked` — the same rule the library
 * grid draws its hatched cards from and the same rule the `trick_progress` hook
 * enforces on write (plan §3, guarantee 3). One definition in `@landit/core`,
 * two expressions of it, and only the server-side one is a boundary.
 *
 * Readable signed out, like the library: a visitor gets the trick and its
 * lowdown, and is asked to sign in where the tracking would be.
 *
 * T31 (2026-09-07) added everything the page could say from data it already
 * held: the rider's history with the trick, the whole road of prerequisites,
 * where the trick sits in its library, a guardian line on supervised tricks,
 * four tricks like it, and where to practise it. Each is a pure rule in
 * `@landit/core` and a small component beside this file; this file wires them
 * and formats every date on the server (LESSONS §3a).
 *
 * T32 (2026-09-08) drew the four things T31 left for its sibling sessions to
 * land: "Why it isn't working" from T28's `mistakes`, the "Why it's Spicy"
 * sentence from T28's `hard`, "Same trick, other sports" from T28's
 * `crossSportEquivalents`, and T29's `GlossaryText` over the body copy. Still
 * nothing a rider would notice as a new request — every one of them is read
 * off the trick record the page already had.
 */

type Params = { params: Promise<{ slug: string }> };

/**
 * The width past which the sections stop being disclosure rows (§3.8: "Desktop
 * does not use it: the page keeps its two columns and plain panels").
 *
 * 820, because that is where `.grid` already becomes two columns — one number
 * for "is this the wide page", not two that could disagree by a pixel and give
 * a 821px window a one-column stack of plain panels.
 */
const PLAIN_ABOVE = 820;

/** "2 Apr 2026". Formatted here, on the server, and passed down as a string —
 * anything locale-derived that renders on both sides is a hydration risk, and a
 * hydration mismatch throws away what the rider typed (LESSONS §3a). */
function formatDate(at: number, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: timezone,
  }).format(new Date(at));
}

async function load(slug: string) {
  const session = await currentRider();
  const client = session?.client ?? anonymousClient();

  const [trickRecords, prereqRecords, award] = await Promise.all([
    listTricks(client),
    listTrickPrereqs(client),
    /*
     * Keyed by slug, so it needs nothing from the trick record and rides along
     * here. `stickers` is listable to anyone while it is live, which is why a
     * signed-out visitor gets the badge too — locked, like every rider who has
     * not landed it.
     *
     * **The `.catch` is about the database rather than the code.** This
     * filters on `kind` and `trick`, columns migration `1788048000` added; a
     * database without them answers a filter on an unknown field with **400**,
     * and `first()` only swallows 404. Production already carries that
     * migration and its seed, so this is not guarding a deploy anybody is
     * about to make — it guards the databases that are not production: a fresh
     * clone, a rollback, whatever a PR preview ends up pointing at. Same rule
     * the dashboard's crew board is read under: a decoration that will not
     * load is a smaller page, not a broken one.
     */
    getTrickAward(client, slug).catch(() => null),
  ]);
  const tricks = tricksFromRecords(trickRecords, prereqRecords);
  const trick = trickById(slug, tricks);
  const record = trickRecords.find((row) => row.slug === slug);
  if (!trick || !record) return null;

  if (!session) {
    const byId: Record<string, StageId> = {};
    // The road names the plan that opens a paywalled step, and a visitor sees
    // that too: it is a catalogue fact, and the visitor is the reader most
    // likely to be deciding whether it is worth having.
    const plans = await listPlans(client);
    return {
      session,
      client,
      tricks,
      trick,
      record,
      byId,
      landedLabel: null,
      notes: [] as NoteView[],
      todayLabel: '',
      share: null,
      award,
      awardEarnedLabel: null,
      history: null as TrickHistory | null,
      unlockPlanName: unlockPlanName(plans),
      // A signed-out visitor gets no video surface at all, and it is worth being
      // precise about why: not because this branch chooses to hide one, but
      // because there is nothing for it to show. The `clips` view rule has no arm
      // an anonymous request can match (plan §3 guarantee 2) — a video is
      // `private` or `members` and never `public` — so a guest asking for any
      // rider's videos gets an empty list from the API, whatever this page does.
      videos: [],
      heldTotal: 0,
      allowance: NO_VIDEO_LINKS,
    };
  }

  const [progress, log, noteRecords, snapshot, videoRecords, heldTotal, plans, held] =
    await Promise.all([
      listTrickProgress(client, session.rider.id),
      listTrickLog(client, session.rider.id),
      // Newest first — the log panel's order (T30).
      listTrickNotes(client, session.rider.id, record.id),
      riderSnapshot(client, session.rider.id),
      listVideoLinks(client, { userId: session.rider.id, trickId: record.id }),
      // Across every trick, because the cap is per rider and not per trick — the
      // same number `45_video_links.pb.js` counts before it refuses a write.
      countVideoLinks(client, session.rider.id),
      listPlans(client),
      // The narrow read, not the whole wall: one row, and `null` when the rider
      // has not earned it. Skipped entirely when the trick has no award.
      award ? getRiderSticker(client, session.rider.id, award.id) : null,
    ]);

  const byId: Record<string, StageId> = trickProgressById(progress, trickRecords);
  const entries = trickLogEntries(log, trickRecords);
  const landed = firstLanded(entries)[slug];
  const timezone = session.rider.timezone || DEFAULT_TIMEZONE;

  return {
    session,
    client,
    tricks,
    trick,
    record,
    byId,
    landedLabel: landed
      ? `${formatDate(landed.at, timezone)}${landed.estimated ? ' (estimated)' : ''}`
      : null,
    /*
     * The log (T30): every note dated here, on the server, in the rider's
     * timezone — `shortDate`, the no-ICU helper the sticker wall uses, so it
     * reads "2 Sep 2026" the way the rest of the product does (LESSONS §3a).
     * The stage is read straight off the row: it is the stage they were at when
     * they wrote it, not the one they are at now. `todayLabel` is for the note
     * the panel shows before the server has dated it.
     */
    notes: noteRecords.map((row): NoteView => ({
      id: row.id,
      body: row.body,
      stage: row.stage || null,
      dateLabel: shortDate(row.created, timezone),
    })),
    todayLabel: shortDate(new Date(), timezone),
    share: buildShare(trick, session.rider, snapshot, tricks, timezone),
    award,
    /*
     * `shortDate`, the same helper and the same wording as the sticker wall —
     * one badge should not be dated two ways depending on which screen a rider
     * is looking at. It is also the no-ICU path (LESSONS §3a). `null` is the
     * whole of "not earned": there is no second flag for the badge to
     * disagree with.
     */
    awardEarnedLabel:
      held && held.earned_at ? `Earned ${shortDate(held.earned_at, timezone)}` : null,
    // Every date and the summary line formatted here, in the rider's zone,
    // from the same log rows `landedLabel` is read from (LESSONS §3a).
    history: trickHistory(entries, slug, { timezone }) as TrickHistory | null,
    unlockPlanName: unlockPlanName(plans),
    videos: videoLinksFromRecords(videoRecords),
    heldTotal,
    // The allowance from **our own plan record** (plan §2.4), matched by slug —
    // never `plan === 'legend'`. A plan the list does not carry resolves to
    // `undefined` and `videoLinkAllowance` reads that as no links, which is the
    // same fail-closed answer the hook gives.
    allowance: videoLinkAllowance(
      planFromRecord(plans.find((row) => row.slug === session.rider.plan)),
    ),
  };
}

/**
 * The name of the cheapest live plan that unlocks paid tricks — what the road
 * writes beside a paywalled step. `listPlans` sorts by clip cap, which is the
 * plans' price order; "Shredder" is the fallback for a database whose plans
 * have not been seeded, so the step still says something true.
 */
function unlockPlanName(plans: readonly PlansRecord[]): string {
  return plans.find((row) => row.unlocks_paid_tricks)?.name ?? 'Shredder';
}

/**
 * A `plans` record as `@landit/core`'s `Plan`, for the two fields the allowance
 * needs.
 *
 * Narrow on purpose: this exists so `videoLinkAllowance` can be the single
 * definition of "what does this plan grant", rather than the page reading two
 * columns and deciding for itself. Everything else on `Plan` is padded with
 * values nothing here reads.
 */
function planFromRecord(record: PlansRecord | undefined): Plan | null {
  if (!record) return null;
  return {
    id: record.slug as PlanId,
    name: record.name,
    hue: record.hue,
    pitch: record.pitch,
    perks: [],
    missing: [],
    priceMonthlyPence: 0,
    priceYearlyPence: 0,
    clipCapBytes: record.clip_cap_bytes,
    unlocksPaidTricks: record.unlocks_paid_tricks,
    includesInsights: record.includes_insights,
    includesFlair: record.includes_flair,
    videoLinkCap: record.video_link_cap,
    videoLinksUnlimited: record.video_links_unlimited,
  };
}

/**
 * Everything the share card needs, formatted on the server (issue #51).
 *
 * The card itself is `@landit/ui-web`'s `ShareCard` and it takes a `kind` —
 * T7 left this button out precisely so the sticker wall and the trick page
 * would end up sharing one component rather than two (plan §7, T7).
 *
 * Every string is built here for the reason the whole file already formats its
 * dates here: the card renders inside a client component, and a value produced
 * by ICU on one side of hydration and not the other is a mismatch that throws
 * the tree away (LESSONS §3a). The streak reads "3 weeks", never "3 days" —
 * the unit belongs to `weeklyStreakLabel` (plan §1).
 */
function buildShare(
  trick: Trick,
  rider: UsersRecord,
  snapshot: Parameters<typeof computeStats>[0],
  tricks: readonly Trick[],
  timezone: string,
): TrickShareView {
  const landed = computeStats(snapshot, null, { tricks }).landed;
  const weeks = currentWeeklyStreak(
    {
      streak: rider.streak ?? 0,
      lastQualifyingWeek: rider.last_qualifying_week || null,
      weekStart: rider.week_start || null,
      ridesThisWeek: rider.rides_this_week ?? 0,
      lastRide: rider.last_ride || null,
    },
    { timezone },
  );
  const name = (rider.name || 'Rider').split(' ')[0] || 'Rider';
  const sportLabel = SPORTS[trick.sport].label;

  return {
    name: trick.name,
    categoryLabel: categoryLabel(trick.cat, trick.sport),
    sportLabel,
    difficulty: trick.diff,
    hue: CATS[trick.cat].color,
    headline: `Landed the ${trick.name}`,
    meta: `${name} · ${landed} tricks landed · ${weeklyStreakLabel(weeks)}`,
    dateLabel: shortDate(new Date(), timezone).replace(/ \d{4}$/, ''),
    caption:
      `Landed the ${trick.name} on ${sportLabel.toLowerCase()}. ` +
      `${landed} tricks down. Tracked on Land The Trick.`,
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: 'Trick not found · Land The Trick' };
  const { trick } = data;
  // `diff` is 1-5 by its type, so the index is always in range; the fallback is
  // what `noUncheckedIndexedAccess` wants said out loud rather than asserted.
  const tier = (TIERS_LABEL[trick.diff - 1] ?? '').toLowerCase();
  return {
    title: `${trick.name} · Land The Trick`,
    /*
     * The lowdown, not the spec line.
     *
     * This used to read "Flat · Scooter · difficulty Rookie." — three facts
     * that are all on the page already, in the tag, the chip and the meter
     * beside the heading. It is also the sentence a search result shows and the
     * one an answer engine reads to decide what this page is about, and on that
     * job it says nothing: it does not tell anybody what a Bunny Hop *is*.
     *
     * `about` is staff copy and already does the work — "The foundation under
     * every trick. Crouch, explode upward and pull the bars to your hips…" — so
     * the sport and the difficulty become the frame around it rather than the
     * whole of it. Trimmed to roughly what a result will show; the cut is on a
     * word so it never ends mid-syllable.
     */
    description: `${trick.name} on a ${lowerLabel(trick.sport)}, ${tier} level. ${clamp(trick.about, 150)}`,
    alternates: { canonical: trickHref(trick.id) },
  };
}

/** `text`, cut to at most `max` characters on a word boundary. */
function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:]$/, '')}…`;
}

export default async function TrickPage({ params }: Params) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();

  const { trick, record, byId, landedLabel, session, tricks } = data;
  const plan = (session?.rider.plan ?? 'rookie') as PlanId;
  const prereqs = prereqTricks(trick, tricks);
  const landedIds = prereqs.filter((p) => isTrickLanded(byId, p.id)).map((p) => p.id);

  if (isTrickLocked(trick, plan)) {
    return (
      <LockedTrick
        trick={trick}
        prereqs={prereqs}
        landedIds={landedIds}
        lockedPrereqIds={prereqs.filter((p) => isTrickLocked(p, plan)).map((p) => p.id)}
      />
    );
  }

  const category = CATS[trick.cat];
  const sport = SPORTS[trick.sport];
  const unlocks = tricksUnlockedBy(trick.id, tricks);
  const stage = byId[trick.id] ?? null;

  // The three catalogue readings T31 added, each a pure rule over the live
  // trick list. None of them reads the rider.
  const road = fullPrereqChain(trick, tricks);
  const facts = trickPositionFacts(trick, tricks);
  const similar = similarTricks(trick, tricks);
  const equivalents = crossSportEquivalents(trick.id, tricks);
  const sportInSentence = lowerLabel(trick.sport);
  /*
   * `mistakes` is optional on `Trick` for the reason `supervise` is: a
   * database older than the column returns nothing, and nothing here means
   * "not written yet", never "there are none" (plan §7, T28). Either way the
   * section is not drawn — an empty "Why it isn't working" would be a claim.
   */
  const mistakes = trick.mistakes && trick.mistakes.length > 0 ? trick.mistakes : null;

  /*
   * The staff-picked tutorial, or nothing (T35).
   *
   * `hidden` is the second half of the same condition, and it is checked here
   * rather than in the mapping because the staff portal reads tricks through
   * that mapping and has to be able to see a hidden video in order to put it
   * back. A hidden video renders exactly like no video: no card, no gap, no
   * hint that other tricks have one. That is what makes the nightly liveness
   * check safe to let run unattended — the worst it can do is return a trick
   * to the state most of the library is already in.
   */
  const video = trick.video && !trick.video.hidden ? trick.video : null;

  /*
   * What this page is, said in schema.org rather than left to be inferred
   * (`lib/structuredData.ts`). It is the same lowdown, tips and kit line the
   * page renders below — a description of the page, not an addition to it — so
   * a retune of staff copy reaches both at once.
   *
   * A locked trick never reaches here: the branch above returned `LockedTrick`,
   * and a `HowTo` describing instructions the visitor was not shown would be
   * exactly the mismatch the guidelines are about.
   */
  const howTo = trickHowToLd(trick, {
    url: `${SITE_URL}${trickHref(trick.id)}`,
    equipment: sport.kit,
  });

  return (
    <div>
      <script
        type="application/ld+json"
        // The text is escaped by `jsonLdText`; a `<` from staff copy cannot
        // close this tag. There is no other way to put JSON-LD on a page.
        dangerouslySetInnerHTML={{ __html: jsonLdText(howTo) }}
      />
      {/*
        Not a plain `<Link href={ROUTES.library}>`: it goes to the library
        address the rider left and leaves the scroll to them
        (`BackToLibrary`, `lib/libraryPlace.ts`).
      */}
      <BackToLibrary />

      <Panel className={styles.panel}>
        <div className={styles.header} style={{ background: category.color }}>
          <div className={styles.headerText}>
            <div className={styles.headerTags}>
              <Tag color="var(--ink)">{categoryLabel(trick.cat, trick.sport)}</Tag>
              <SportChip sport={SPORT_LOOKS[trick.sport]} />
            </div>
            <h1 className={`d ${styles.name}`}>{trick.name}</h1>
            {/*
              The one-line lowdown (rethink §3.8). `lowdownTeaser` is the same
              rule the locked page teases with and the same one the library
              card shows — the first sentence of the staff copy, or a cut of it
              on a trick whose lowdown is one long sentence. It is here because
              the full lowdown is now behind a closed row on a phone, and a
              hero that says the trick's name and nothing about it would be a
              page a rider has to open something to understand.
            */}
            <p className={`cond ${styles.heroTeaser}`}>{lowdownTeaser(trick.about)}</p>
          </div>
          {/*
            The first-landed date, as an ink chip in the hero — desktop only
            (see `.heroLanded`), where it saves the band a whole row. On a phone
            `StagePanel` carries it under the ladder instead. One source, one of
            them on screen at a time.
          */}
          {landedLabel && (
            <div className={styles.heroLanded}>
              <div className="lab">First landed</div>
              <div className={`cond ${styles.heroLandedDate}`}>{landedLabel}</div>
            </div>
          )}

          {/*
            Stacked rather than "Difficulty · Rookie" on one line (owner,
            2026-08-31). The hero's right-hand column has height to spare at
            every width, and the tier is the half a rider actually reads — on
            one line it was the tail of a label, here it is a word.
          */}
          <div className={styles.difficulty}>
            <div className="lab" style={{ color: 'var(--ink)' }}>
              Difficulty
            </div>
            <div className={`d ${styles.difficultyTier}`}>{TIERS_LABEL[trick.diff - 1]}</div>
            <Difficulty value={trick.diff} />
          </div>
        </div>

        {/*
          The sticker and the video, one row directly under the name (D7,
          rethink §3.8). The badge used to overhang the hero into the band
          below it and the award's condition was repeated twice — once in the
          hero on desktop, once in a cream strip on a phone — because neither
          place had room for both it and the earned date. A card of its own has
          room for both, at both widths, and it is what the row is for.

          With no video the sticker card takes the row on its own (§3.8); with
          no award the video does; with neither there is no row, which is most
          of the library on both counts.
        */}
        {(data.award || video) && (
          <div className={styles.stickerVideo}>
            {data.award && (
              <section
                id="sticker"
                className={`${styles.stickerCard}${video ? '' : ` ${styles.cardWide}`}`}
                aria-label="The sticker"
              >
                {data.award.img && (
                  <AwardBadge
                    name={data.award.name}
                    img={data.award.img}
                    earned={data.awardEarnedLabel !== null}
                  />
                )}
                <div className={styles.stickerText}>
                  {/* Staff copy — "Land the Tailwhip" — so a retune reaches
                      this the way it reaches the sticker wall (LESSONS §4). */}
                  <div className={`cond ${styles.stickerCond}`}>{data.award.cond}</div>
                  {/*
                    Earned says when; unearned says what to do, in the stage's
                    own word rather than a second name for it. `STAGE.some` is
                    where the hook stamps a trick award, so the sentence and the
                    rule cannot drift apart.
                  */}
                  <div className={`lab ${styles.stickerState}`}>
                    {data.awardEarnedLabel ?? `Land it at ${STAGE.some.label}`}
                  </div>
                </div>
              </section>
            )}

            {/*
              The staff-picked tutorial (T35), unchanged in what it is and what
              it costs: still click-to-play, so nothing reaches Google before
              the press, still absent entirely on a trick nobody has picked one
              for, and still never another sport's video. What moved is where it
              sits — out of the top of the reading column and into the row the
              owner's layout A puts it in.
            */}
            {video && (
              <section
                id="watch"
                className={`${styles.videoCard}${data.award ? '' : ` ${styles.cardWide}`}`}
                aria-labelledby="watch-it"
              >
                <h2 id="watch-it" className={`lab ${styles.cardLabel}`}>
                  Watch it
                </h2>
                <WatchPanel trick={trick} video={video} />
              </section>
            )}
          </div>
        )}

        {/*
          `#ladder` — where the Log sheet's "Log a trick" lands (§3.5). On the
          wrapper rather than inside `StagePanel` so the anchor exists for a
          visitor too: a signed-out rider who follows a shared link with the
          hash still arrives at the band, which is where the sign-in line is.
        */}
        <div id="ladder" className={styles.ladderAnchor}>
          {session ? (
            <StagePanel
              trickId={record.id}
              slug={trick.id}
              stage={stage}
              landedLabel={landedLabel}
              share={data.share}
            />
          ) : (
            /* The same band, with the one thing a visitor can do in it. The page
               keeps its shape signed out — the loudest strip on it does not
               quietly disappear for someone who has not signed in yet. */
            <div className={styles.band}>
              <div className={styles.bandHead}>
                <span className={`lab ${styles.bandTitle}`}>Can you do it?</span>
              </div>
              <p className={styles.signIn}>
                <Link href={ROUTES.signIn}>Sign in</Link> to mark this one off — every trick you
                land is kept, and only you can see it.
              </p>
            </div>
          )}
        </div>

        {/*
          The three short ways down the page (§3.8), phone only — the sections
          below are closed rows there, and a rider who came for their own videos
          should not have to read the list of names to find them. Ordinary
          fragment links: the browser scrolls, and the row that is named opens
          itself off the hash (`Accordion`). Each one is drawn only when there
          is something at the other end of it.

          **"Video", where §3.8 writes "Clip".** The fragment is still `#clips`
          — that is T45's, and it is an address rather than a word anybody
          reads — but the word on the page is the page's own. Plan §6.6
          withdrew the clip vocabulary from this screen when hosting was
          reversed, T15b's panel came back as "Your videos" rather than "Your
          clips", and `library.spec.ts` has guarded the absence of the word
          here ever since. Reintroducing it for a 44px button would mean
          loosening that guard to gain nothing a rider would notice.
        */}
        {(data.award || video || session) && (
          <nav className={styles.jump} aria-label="Jump to a section">
            {data.award && (
              <a className={`cond ${styles.jumpBtn}`} href="#sticker">
                Sticker
              </a>
            )}
            {video && (
              <a className={`cond ${styles.jumpBtn}`} href="#watch">
                Watch
              </a>
            )}
            {session && (
              <a className={`cond ${styles.jumpBtn}`} href="#clips">
                Video
              </a>
            )}
          </nav>
        )}

        {/*
          Only on a trick staff have flagged; never inferred from `diff`.

          Outside the rows rather than inside one: it is the one thing on this
          page a grown-up is meant to read, and a safety note behind a chevron
          is a safety note nobody opened. It was in the reading column beside
          the kit; full width under the band is where it is now on-screen at
          both widths without anybody pressing anything.
        */}
        {trick.supervise && (
          <div className={styles.guardianRow}>
            <GuardianLine />
          </div>
        )}

        {/*
          The sections. One row each on a phone and a plain panel above 820px,
          from one piece of markup: `Accordion` takes `plainAbove` and holds
          itself open past that width, and `.section` below repaints its head as
          this page's diamond-and-rule heading (rethink §3.8).

          The columns still exist, because the desktop page still has two of
          them; on a phone `.column` is `display: contents` and `order` puts the
          rows in the order §3.8 asks for, which is the mechanism the page has
          used since T31 rather than a new one.

          The body copy — the lowdown, the tips, the fun fact and each mistake's
          fix — goes through `GlossaryText` (T29), which links the first mention
          of a glossary word to `/glossary?from=<slug>` as a dotted underline
          and changes nothing else. It is a pure function of the string, so the
          page stays a server component and there is nothing for a hydration
          mismatch to throw away.
        */}
        <div className={styles.grid} style={{ '--acc-accent': category.color } as CSSProperties}>
          <div className={styles.column}>
            {/*
              The fun fact rides in the lowdown's body rather than taking a row
              of its own. It is two lines about the trick, which is what the
              lowdown is; a closed row named "Fun fact" would be a chevron
              guarding a sentence.
            */}
            <Accordion
              plainAbove={PLAIN_ABOVE}
              className={`${styles.section} ${styles.secLowdown}`}
              title="The lowdown"
            >
              <p className={styles.prose}>
                <GlossaryText text={trick.about} from={trick.id} sport={trick.sport} />
              </p>
              <div className={styles.fact} style={{ borderLeftColor: category.color }}>
                <span className={`d ${styles.factLabel}`} style={{ color: category.color }}>
                  Fun fact
                </span>
                <p className={styles.factBody}>
                  <GlossaryText text={trick.fact} from={trick.id} sport={trick.sport} />
                </p>
              </div>
            </Accordion>

            <Accordion
              plainAbove={PLAIN_ABOVE}
              className={`${styles.section} ${styles.secTips}`}
              title="Tips"
            >
              <p className={styles.prose}>
                <GlossaryText text={trick.tips} from={trick.id} sport={trick.sport} />
              </p>
            </Accordion>

            {/* Section D, between the tips and the kit, as it is on desktop. */}
            {mistakes && (
              <Accordion
                plainAbove={PLAIN_ABOVE}
                className={`${styles.section} ${styles.secMistakes}`}
                title="Why it isn't working"
                sub={
                  mistakes.length === 1 ? '1 common mistake' : `${mistakes.length} common mistakes`
                }
              >
                <MistakesList mistakes={mistakes} slug={trick.id} sport={trick.sport} />
              </Accordion>
            )}

            <Accordion
              plainAbove={PLAIN_ABOVE}
              className={`${styles.section} ${styles.secKit}`}
              title="What you need"
            >
              <div className={styles.kit}>
                <span className={styles.kitIcon} style={{ background: sport.color }}>
                  <Equipment name={SPORT_LOOKS[trick.sport].icon} size={22} strokeWidth={2.3} />
                </span>
                <div className={styles.kitText}>
                  <div className={`cond ${styles.kitCopy}`}>
                    {sport.kit}
                    {trick.diff >= 4 ? '. Learn this one into foam or resi first' : ''}
                  </div>
                </div>
              </div>
            </Accordion>

            {/*
              The road to it and what it opens up, then where to practise it.
              After the copy rather than beside the log, which is where the
              pack puts them: these are links onward, and the end of the
              reading column is where a rider is ready for them.
            */}
            <Accordion
              plainAbove={PLAIN_ABOVE}
              className={`${styles.section} ${styles.ownTitle} ${styles.secRoad}`}
              title="The road to it"
              sub={road.length === 1 ? '1 step' : `${road.length} steps`}
            >
              <RoadPanel
                trick={trick}
                steps={road}
                byId={byId}
                plan={plan}
                unlocks={unlocks}
                unlockPlanName={data.unlockPlanName}
              />
            </Accordion>

            {/* `practiseAdvice` has no honest answer for `hybrid`, and the line
                draws nothing for it — so the row is not offered either. */}
            {practiseAdvice(trick.cat) && (
              <Accordion
                plainAbove={PLAIN_ABOVE}
                className={`${styles.section} ${styles.ownTitle} ${styles.secPractise}`}
                title="Where to practise"
              >
                <PractiseLine slug={trick.id} cat={trick.cat} sport={trick.sport} />
              </Accordion>
            )}
          </div>

          <div className={styles.column}>
            <Accordion
              plainAbove={PLAIN_ABOVE}
              className={`${styles.section} ${styles.secFacts}`}
              title="Where it sits"
            >
              <FactsStrip
                facts={facts}
                categoryLabel={categoryLabel(trick.cat, trick.sport)}
                sportLabel={sportInSentence}
                hard={trick.hard}
              />
            </Accordion>

            {/*
              Section G, under the facts as the pack's 1d artboard has it. The
              row is conditional as well as the panel, so a trick with no
              equivalent leaves no empty chevron behind.
            */}
            {equivalents.length > 0 && (
              <Accordion
                plainAbove={PLAIN_ABOVE}
                className={`${styles.section} ${styles.ownTitle} ${styles.secCrossSport}`}
                title="Same trick, other sports"
                sub={
                  equivalents.length === 1 ? '1 other sport' : `${equivalents.length} other sports`
                }
              >
                <CrossSportPanel trick={trick} equivalents={equivalents} />
              </Accordion>
            )}

            {/*
              Everything on this page that is the rider's own, in one row
              (§3.8: "Your history / notes / clips"). Signed in only, with no
              tease for a visitor: the band above already carries the one
              sign-in line this page needs, and "sign in to see your history"
              would suggest there is one waiting. `clips` has no rule arm a
              guest can match either (plan §3 guarantee 2), so there is nothing
              to draw for one.

              `#clips` is where the Log sheet's "Add a clip link" lands (§3.5),
              and `Accordion` opens the row the fragment names rather than
              scrolling a shut box into view. The three panels inside are
              unchanged: the rider's sessions on the trick, the timeline, and
              the notes-and-videos panel with its own two tabs.
            */}
            {session && (
              <Accordion
                id="clips"
                plainAbove={PLAIN_ABOVE}
                className={`${styles.section} ${styles.secMine}`}
                title="Your history, notes and videos"
                sub="Only you can see these"
              >
                <div className={styles.mine}>
                  <TrickSessionsBlock
                    trickId={record.id}
                    trickName={trick.name}
                    session={session}
                  />

                  {data.history && (
                    <HistoryPanel
                      history={data.history}
                      /* Only when the band is not already carrying it: a rider on a
                         stage resets through "Stop tracking", and a rider who
                         stopped first would otherwise have no way back to rows they
                         never meant to write. */
                      clear={
                        !stage && data.history.entries.length > 0
                          ? {
                              trickId: record.id,
                              slug: trick.id,
                              count: data.history.entries.length,
                              holdsBadge: data.awardEarnedLabel !== null,
                            }
                          : null
                      }
                    />
                  )}

                  <LogPanel
                    trickId={record.id}
                    slug={trick.id}
                    sport={trick.sport}
                    trickName={trick.name}
                    stage={stage}
                    notes={data.notes}
                    todayLabel={data.todayLabel}
                    videos={data.videos}
                    allowance={data.allowance}
                    heldTotal={data.heldTotal}
                  />
                </div>
              </Accordion>
            )}
          </div>
        </div>

        <SimilarTricks trick={trick} tricks={similar} byId={byId} plan={plan} />
      </Panel>
    </div>
  );
}
