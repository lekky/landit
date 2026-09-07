import {
  CATS,
  DEFAULT_TIMEZONE,
  NO_VIDEO_LINKS,
  SITE_URL,
  SPORTS,
  TIERS_LABEL,
  categoryLabel,
  computeStats,
  currentWeeklyStreak,
  firstLanded,
  fullPrereqChain,
  isTrickLanded,
  isTrickLocked,
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
import { Difficulty, Equipment, Icon, Panel, SportChip, Tag } from '@landit/ui-web';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { shortDate } from '@/lib/dates';
import { jsonLdText, trickHowToLd } from '@/lib/structuredData';
import { ROUTES, trickHref } from '@/lib/routes';
import { SPORT_LOOKS, lowerLabel } from '@/lib/sports';
import { anonymousClient, currentRider } from '@/lib/session';

import { AwardBadge } from './AwardBadge';
import { FactsStrip } from './FactsStrip';
import { GuardianLine } from './GuardianLine';
import { HistoryPanel } from './HistoryPanel';
import { LockedTrick } from './LockedTrick';
import { LogPanel, type NoteView } from './LogPanel';
import { PractiseLine } from './PractiseLine';
import { RoadPanel } from './RoadPanel';
import { SimilarTricks } from './SimilarTricks';
import { StagePanel, type TrickShareView } from './StagePanel';
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
 */

type Params = { params: Promise<{ slug: string }> };

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
  const sportInSentence = lowerLabel(trick.sport);

  /*
   * The award line, in two places that are never both on screen: the hero
   * subline above the breakpoint, the cream strip below it. `cond` is staff
   * copy — "Land the Tailwhip" — so a retune reaches this the way it reaches
   * the sticker wall, which is why it is read rather than written out here
   * (LESSONS §4). The award's *name* would be no use: every trick award is
   * named after its trick, and the name is already the heading above it and
   * lettered across the badge beside it.
   */
  const awardLine = data.award ? `The award · ${data.award.cond}` : null;

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
      <Link className={`cond ${styles.back}`} href={ROUTES.library}>
        <Icon name="back" size={16} /> All tricks
      </Link>

      <Panel className={styles.panel}>
        <div className={styles.header} style={{ background: category.color }}>
          {/*
            The badge overhangs the band below it. Nothing at all when the
            trick has no live award — a trick staff add tomorrow has none until
            one is seeded, and a hero missing a badge reads better than one
            holding a box that explains its own emptiness.
          */}
          {data.award?.img && (
            <AwardBadge
              name={data.award.name}
              img={data.award.img}
              earned={data.awardEarnedLabel !== null}
            />
          )}

          <div className={styles.headerText}>
            <div className={styles.headerTags}>
              <Tag color="var(--ink)">{categoryLabel(trick.cat, trick.sport)}</Tag>
              <SportChip sport={SPORT_LOOKS[trick.sport]} />
            </div>
            <h1 className={`d ${styles.name}`}>{trick.name}</h1>
            {awardLine && <div className={`cond ${styles.awardLine}`}>{awardLine}</div>}
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

        {/* Phone only (see `.awardStrip`): where the badge overhangs instead,
            so the ladder below can have the full width of the screen. */}
        {awardLine && (
          <div className={styles.awardStrip}>
            <div className="cond">{data.award?.cond}</div>
            {data.awardEarnedLabel && (
              <div className={`lab ${styles.awardStripEarned}`}>{data.awardEarnedLabel}</div>
            )}
          </div>
        )}

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
              <Link href={ROUTES.signIn}>Sign in</Link> to mark this one off — every trick you land
              is kept, and only you can see it.
            </p>
          </div>
        )}

        <div className={styles.grid}>
          <div className={styles.column}>
            <div className={styles.secLowdown}>
              <SectionHead color={category.color}>The lowdown</SectionHead>
              <p className={styles.prose}>{trick.about}</p>
            </div>

            <div className={`${styles.kit} ${styles.secKit}`}>
              <span className={styles.kitIcon} style={{ background: sport.color }}>
                <Equipment name={SPORT_LOOKS[trick.sport].icon} size={22} strokeWidth={2.3} />
              </span>
              <div className={styles.kitText}>
                <div className="lab" style={{ color: 'var(--ink-3)' }}>
                  What you need
                </div>
                <div className={`cond ${styles.kitCopy}`}>
                  {sport.kit}
                  {trick.diff >= 4 ? '. Learn this one into foam or resi first' : ''}
                </div>
              </div>
            </div>

            {/* Only on a trick staff have flagged; never inferred from `diff`. */}
            {trick.supervise && (
              <div className={styles.secGuardian}>
                <GuardianLine />
              </div>
            )}

            <div className={styles.secTips}>
              <SectionHead color={category.color}>Tips</SectionHead>
              <p className={styles.prose}>{trick.tips}</p>
            </div>

            <div
              className={`${styles.fact} ${styles.secFact}`}
              style={{ borderLeftColor: category.color }}
            >
              <span className={`d ${styles.factLabel}`} style={{ color: category.color }}>
                Fun fact
              </span>
              <p className={styles.factBody}>{trick.fact}</p>
            </div>

            {/*
              The road to it and what it opens up, then where to practise it.
              Under the copy rather than beside the log, which is where the
              pack puts them: these are links onward, and the end of the
              reading column is where a rider is ready for them.
            */}
            <div className={styles.secRoad}>
              <RoadPanel
                trick={trick}
                steps={road}
                byId={byId}
                plan={plan}
                unlocks={unlocks}
                unlockPlanName={data.unlockPlanName}
              />
            </div>

            <div className={styles.secPractise}>
              <PractiseLine slug={trick.id} cat={trick.cat} sport={trick.sport} />
            </div>
          </div>

          <div className={styles.column}>
            <div className={styles.secFacts}>
              <FactsStrip
                facts={facts}
                categoryLabel={categoryLabel(trick.cat, trick.sport)}
                sportLabel={sportInSentence}
              />
            </div>

            {/*
              The rider's own history with the trick. Signed in only, with no
              tease for a visitor: the band above already carries the one
              sign-in line this page needs, and "sign in to see your history"
              would suggest there is one waiting.
            */}
            {data.history && (
              <div className={styles.secHistory}>
                <HistoryPanel history={data.history} />
              </div>
            )}

            {/*
              Video links (T15b). Signed-in only: `clips` has no rule arm a
              guest can match, so there is nothing to draw for one and no
              "sign in to see videos" tease either — the trick page never
              suggests a rider has videos on it.
            */}
            {session && (
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
            )}
          </div>
        </div>

        <SimilarTricks trick={trick} tricks={similar} byId={byId} plan={plan} />
      </Panel>
    </div>
  );
}

/**
 * A reading-column heading as the 2026-09-07 pack draws it: a diamond in the
 * category colour, the title in Anton, and an ink rule taking the rest of the
 * row. T26's eleven-pixel "◆ The lowdown" label was fine for a column with
 * four sections; this page now has seven, and the rule is what separates them.
 */
function SectionHead({ color, children }: { color: string; children: string }) {
  return (
    <div className={styles.sectionHead}>
      <span className={styles.sectionDiamond} style={{ background: color }} aria-hidden="true" />
      <h2 className={`d ${styles.sectionTitle}`}>{children}</h2>
      <span className={styles.sectionRule} aria-hidden="true" />
    </div>
  );
}
