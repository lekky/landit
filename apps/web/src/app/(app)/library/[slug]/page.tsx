import {
  CATS,
  DEFAULT_TIMEZONE,
  NO_VIDEO_LINKS,
  SPORTS,
  TIERS_LABEL,
  categoryLabel,
  computeStats,
  currentWeeklyStreak,
  firstLanded,
  isTrickLanded,
  isTrickLocked,
  isTrickUnlocked,
  prereqTricks,
  trickById,
  tricksUnlockedBy,
  videoLinkAllowance,
  weeklyStreakLabel,
  type Plan,
  type PlanId,
  type StageId,
  type Trick,
} from '@landit/core';
import {
  countVideoLinks,
  getRiderSticker,
  getTrickAward,
  getTrickNote,
  listPlans,
  listTrickLog,
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
import { Difficulty, Icon, Panel, SportChip, Tag } from '@landit/ui-web';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { shortDate } from '@/lib/dates';
import { ROUTES, trickHref } from '@/lib/routes';
import { SPORT_LOOKS } from '@/lib/sports';
import { anonymousClient, currentRider } from '@/lib/session';

import { AwardBadge } from './AwardBadge';
import { LockedTrick } from './LockedTrick';
import { NotesPanel } from './NotesPanel';
import { StagePanel, type TrickShareView } from './StagePanel';
import { VideosPanel } from './VideosPanel';
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
    return {
      session,
      client,
      tricks,
      trick,
      record,
      byId,
      landedLabel: null,
      note: '',
      share: null,
      award,
      awardEarnedLabel: null,
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

  const [progress, log, noteRecord, snapshot, videoRecords, heldTotal, plans, held] =
    await Promise.all([
      listTrickProgress(client, session.rider.id),
      listTrickLog(client, session.rider.id),
      getTrickNote(client, session.rider.id, record.id),
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
  const landed = firstLanded(trickLogEntries(log, trickRecords))[slug];
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
    note: noteRecord?.body ?? '',
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
  return {
    title: `${data.trick.name} · Land The Trick`,
    description: `${categoryLabel(data.trick.cat, data.trick.sport)} · ${SPORTS[data.trick.sport].label} · difficulty ${TIERS_LABEL[data.trick.diff - 1]}.`,
  };
}

export default async function TrickPage({ params }: Params) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();

  const { trick, record, byId, landedLabel, note, session, tricks } = data;
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
  const unlocked = isTrickUnlocked(trick, byId);
  const stage = byId[trick.id] ?? null;

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

  return (
    <div>
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

          <div style={{ minWidth: 0 }}>
            <div className={styles.headerTags}>
              <Tag color="var(--ink)">{categoryLabel(trick.cat, trick.sport)}</Tag>
              <SportChip sport={SPORT_LOOKS[trick.sport]} />
            </div>
            <h1 className={`d ${styles.name}`}>{trick.name}</h1>
            {awardLine && <div className={`cond ${styles.awardLine}`}>{awardLine}</div>}
          </div>
          <div className={styles.difficulty}>
            <div className="lab" style={{ color: 'var(--ink)' }}>
              Difficulty · {TIERS_LABEL[trick.diff - 1]}
            </div>
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
            <div>
              <div className={`lab ${styles.sectionLabel}`} style={{ color: category.color }}>
                ◆ The lowdown
              </div>
              <p className={styles.prose}>{trick.about}</p>
            </div>

            <div className={styles.kit}>
              <span className={styles.kitIcon} style={{ background: sport.color }}>
                <Icon name={SPORT_LOOKS[trick.sport].icon} size={19} strokeWidth={2.3} />
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

            <div>
              <div className={`lab ${styles.sectionLabel}`} style={{ color: category.color }}>
                ◆ Tips
              </div>
              <p className={styles.prose}>{trick.tips}</p>
            </div>

            <div className={styles.fact} style={{ borderLeftColor: category.color }}>
              <span className={`d ${styles.factLabel}`} style={{ color: category.color }}>
                Fun fact
              </span>
              <p className={styles.factBody}>{trick.fact}</p>
            </div>

            {/*
              What this trick is built on and what it opens up. Under the copy
              rather than beside the videos, which is where the pack puts it:
              these are links onward, and the end of the reading column is
              where a rider is ready for them.
            */}
            {(prereqs.length > 0 || unlocks.length > 0) && (
              <Panel flat className={styles.sidePanel}>
                {prereqs.length > 0 && (
                  <>
                    <div className="lab">{unlocked ? 'Built on' : 'Get these first'}</div>
                    <div className={styles.pillRow}>
                      {prereqs.map((prereq) => {
                        const landed = landedIds.includes(prereq.id);
                        return (
                          <Link
                            key={prereq.id}
                            href={trickHref(prereq.id)}
                            className={`pill ${styles.pillLink}${landed ? ` ${styles.pillLanded}` : ''}`}
                          >
                            {landed && <Icon name="check" size={12} strokeWidth={3} />}
                            {prereq.name}
                          </Link>
                        );
                      })}
                    </div>
                  </>
                )}
                {unlocks.length > 0 && (
                  <>
                    {/* "You unlocked" once it is landed, which is the pack's
                        wording and the honest tense for it. */}
                    <div className={`lab ${prereqs.length ? styles.unlocksLabel : ''}`}>
                      {isTrickLanded(byId, trick.id) ? 'You unlocked' : 'Land this and you unlock'}
                    </div>
                    <div className={styles.pillRow}>
                      {unlocks.map((next) => {
                        const locked = isTrickLocked(next, plan);
                        const landed = isTrickLanded(byId, next.id);
                        return (
                          <Link
                            key={next.id}
                            href={trickHref(next.id)}
                            className={`pill ${styles.pillLink}${locked ? ` ${styles.pillLocked}` : ''}${landed ? ` ${styles.pillLanded}` : ''}`}
                          >
                            {locked && <Icon name="lock" size={11} strokeWidth={2.8} />}
                            {landed && <Icon name="check" size={12} strokeWidth={3} />}
                            {next.name}
                          </Link>
                        );
                      })}
                    </div>
                  </>
                )}
              </Panel>
            )}
          </div>

          <div className={styles.column}>
            {/*
              Video links (T15b). Signed-in only: `clips` has no rule arm a
              guest can match, so there is nothing to draw for one and no
              "sign in to see videos" tease either — the trick page never
              suggests a rider has videos on it.
            */}
            {session && (
              <VideosPanel
                trickId={record.id}
                slug={trick.id}
                trickName={trick.name}
                initial={data.videos}
                allowance={data.allowance}
                heldTotal={data.heldTotal}
              />
            )}

            {session && <NotesPanel trickId={record.id} slug={trick.id} initial={note} />}
          </div>
        </div>
      </Panel>
    </div>
  );
}
