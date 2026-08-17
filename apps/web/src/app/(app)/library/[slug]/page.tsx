import {
  CATS,
  DEFAULT_TIMEZONE,
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
  weeklyStreakLabel,
  type PlanId,
  type StageId,
  type Trick,
} from '@landit/core';
import {
  getTrickNote,
  listTrickLog,
  listTrickPrereqs,
  listTrickProgress,
  listTricks,
  riderSnapshot,
  trickLogEntries,
  trickProgressById,
  tricksFromRecords,
  type UsersRecord,
} from '@landit/db';
import { Difficulty, Icon, Panel, Slot, SportChip, Tag } from '@landit/ui-web';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { shortDate } from '@/lib/dates';
import { ROUTES, trickHref } from '@/lib/routes';
import { SPORT_LOOKS } from '@/lib/sports';
import { anonymousClient, currentRider } from '@/lib/session';

import { LockedTrick } from './LockedTrick';
import { NotesPanel } from './NotesPanel';
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

  const [trickRecords, prereqRecords] = await Promise.all([
    listTricks(client),
    listTrickPrereqs(client),
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
    };
  }

  const [progress, log, noteRecord, snapshot] = await Promise.all([
    listTrickProgress(client, session.rider.id),
    listTrickLog(client, session.rider.id),
    getTrickNote(client, session.rider.id, record.id),
    riderSnapshot(client, session.rider.id),
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
      `${landed} tricks down. Tracked on Land It.`,
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: 'Trick not found · Land It' };
  return {
    title: `${data.trick.name} · Land It`,
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

  return (
    <div>
      <Link className={`cond ${styles.back}`} href={ROUTES.library}>
        <Icon name="back" size={16} /> All tricks
      </Link>

      <Panel className={styles.panel}>
        <div className={styles.header} style={{ background: category.color }}>
          <div style={{ minWidth: 0 }}>
            <div className={styles.headerTags}>
              <Tag color="var(--ink)">{categoryLabel(trick.cat, trick.sport)}</Tag>
              <SportChip sport={SPORT_LOOKS[trick.sport]} />
            </div>
            <h1 className={`d ${styles.name}`}>{trick.name}</h1>
          </div>
          <div className={styles.difficulty}>
            <div className="lab" style={{ color: 'var(--ink)' }}>
              Difficulty · {TIERS_LABEL[trick.diff - 1]}
            </div>
            <Difficulty value={trick.diff} />
          </div>
        </div>

        <div className={styles.grid}>
          <div className={styles.column}>
            <Slot label="Trick photo: drop a shot of this trick" minHeight={200} />

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
          </div>

          <div className={styles.column}>
            {session ? (
              <StagePanel
                trickId={record.id}
                slug={trick.id}
                stage={stage}
                landedLabel={landedLabel}
                share={data.share}
              />
            ) : (
              <Panel flat className={styles.stagePanel}>
                <div className="lab">Can you do it?</div>
                <p className={styles.signIn}>
                  <Link href={ROUTES.signIn}>Sign in</Link> to mark this one off — every trick you
                  land is kept, and only you can see it.
                </p>
              </Panel>
            )}

            {session && <NotesPanel trickId={record.id} slug={trick.id} initial={note} />}

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
                    <div className={`lab ${prereqs.length ? styles.unlocksLabel : ''}`}>
                      Land this and you unlock
                    </div>
                    <div className={styles.pillRow}>
                      {unlocks.map((next) => {
                        const locked = isTrickLocked(next, plan);
                        return (
                          <Link
                            key={next.id}
                            href={trickHref(next.id)}
                            className={`pill ${styles.pillLink}${locked ? ` ${styles.pillLocked}` : ''}`}
                          >
                            {locked && <Icon name="lock" size={11} strokeWidth={2.8} />}
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
        </div>
      </Panel>
    </div>
  );
}
