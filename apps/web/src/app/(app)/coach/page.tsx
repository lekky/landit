import {
  CATS,
  DEFAULT_TIMEZONE,
  SPORTS,
  categoryLabel,
  currentWeeklyStreak,
  needsSupervision,
  rodeToday,
  sortTricks,
  supervisedTricks,
  weeklyProgress,
  type SportId,
  type StageId,
} from '@landit/core';
import { listTrickPrereqs, listTrickProgress, listTricks, tricksFromRecords } from '@landit/db';
import { Difficulty, Panel, SportChip, Tag } from '@landit/ui-web';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ROUTES, signInHref } from '@/lib/routes';
import { SPORT_LOOKS, sportsList } from '@/lib/sports';
import { currentRider } from '@/lib/session';

import styles from './coach.module.css';

export const metadata: Metadata = {
  title: 'Coach view · Land The Trick',
  description: 'A read-only summary of the week, for a parent or a coach.',
  robots: { index: false, follow: false },
};

/**
 * The coach / parent view (`landit-screens-c.jsx`, screenshot 24).
 *
 * **It is free, and that is a decision this task had to take.** The prototype
 * gates it behind the Crew Pass, and the Crew Pass was dropped in plan §2.4 —
 * so the gate had no plan left to hang on. Two things settled where it landed.
 * A parent-facing summary is part of the child-safety position (§6.1, §6.4),
 * and a safeguarding surface behind a paywall is the wrong shape whatever it
 * costs. And plan §1's "achievements are never for sale" has a mirror: neither
 * is a parent's sight of them. Recorded in plan §7 against T11; the owner can
 * move it, and moving it means adding an entitlement to the `plans` record the
 * way `includes_insights` and `includes_flair` are, never a `plan === 'x'`.
 *
 * **It shows the rider's own data to the rider.** There is no separate parent
 * login, no share link and no token — a child opens it and hands over the
 * screen. Every one of those alternatives is a new way to reach a rider's data
 * from outside their account, which is the thing this product spends its whole
 * design not having (§6.1).
 *
 * **It counts weeks, not days.** The prototype says "N days" because it predates
 * the weekly streak (plan §1). A page that quotes a rule has to be swept when
 * the rule changes (LESSONS §4), and this is that sweep.
 */
export default async function CoachViewPage() {
  const session = await currentRider();
  if (!session) redirect(signInHref(ROUTES.coach));
  if (!session.rider.onboarded) redirect(ROUTES.onboarding);

  const { client, rider } = session;
  const timezone = rider.timezone || DEFAULT_TIMEZONE;
  const clock = { timezone };

  const [trickRecords, prereqRecords, progress] = await Promise.all([
    listTricks(client),
    listTrickPrereqs(client),
    listTrickProgress(client, rider.id),
  ]);

  const tricks = tricksFromRecords(trickRecords, prereqRecords);
  const bySlug = new Map(tricks.map((t) => [t.id, t]));
  const slugOf = new Map(trickRecords.map((t) => [t.id, t.slug]));

  const stageBySlug = new Map<string, StageId>();
  for (const row of progress) {
    const slug = slugOf.get(row.trick);
    if (slug) stageBySlug.set(slug, row.stage);
  }

  const LANDED: readonly StageId[] = ['some', 'most', 'every'];
  const landedSlugs = [...stageBySlug.entries()]
    .filter(([, stage]) => LANDED.includes(stage))
    .map(([slug]) => slug);

  const working = sortTricks(
    [...stageBySlug.entries()]
      .filter(([, stage]) => stage === 'trying')
      .map(([slug]) => bySlug.get(slug))
      .filter((t): t is NonNullable<typeof t> => Boolean(t)),
    'easiest',
  );

  const riskyCount = supervisedTricks(
    landedSlugs
      .map((slug) => bySlug.get(slug))
      .filter((t): t is NonNullable<typeof t> => Boolean(t)),
  ).length;

  const sports = ((rider.sports ?? []) as SportId[]).filter((s) => SPORTS[s]);
  const streakState = {
    streak: rider.streak ?? 0,
    lastQualifyingWeek: rider.last_qualifying_week || null,
    weekStart: rider.week_start || null,
    ridesThisWeek: rider.rides_this_week ?? 0,
    lastRide: rider.last_ride || null,
  };
  const weeks = currentWeeklyStreak(streakState, clock);
  const week = weeklyProgress(streakState, clock);
  const rodeIt = rodeToday(streakState.lastRide, clock);

  const totalInSports = tricks.filter((t) => t.isLive && sports.includes(t.sport)).length;

  const cards: [string, string, string][] = [
    ['Rode today', rodeIt ? 'Yes' : 'Not yet', rodeIt ? 'var(--lime)' : 'var(--paper-2)'],
    ['Rides this week', `${week.rides} of ${week.target}`, 'var(--yellow)'],
    ['Streak', `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`, 'var(--paper-2)'],
    ['Rides', sports.length ? sportsList(sports) : 'Not set', 'var(--paper-2)'],
    ['Tricks landed', `${landedSlugs.length} of ${totalInSports}`, 'var(--sky)'],
    ['Tricks to supervise', String(riskyCount), riskyCount ? '#FFB3C9' : 'var(--paper-2)'],
  ];

  return (
    <div>
      <Link className={`cond ${styles.back}`} href={ROUTES.account}>
        ← Account
      </Link>
      <span className="eyebrow">Coach / parent view · read only</span>
      <h1 className={`d ${styles.head}`}>
        {(rider.name || 'This rider').split(' ')[0]}&rsquo;s week
      </h1>
      <p className={styles.lede}>
        Nothing on this page can be changed from here, and nothing on it is shared with anyone. It
        is the rider&rsquo;s own screen, for showing to a grown-up.
      </p>

      <div className={styles.cards}>
        {cards.map(([label, value, hue]) => (
          <Panel flat key={label} className={styles.card} style={{ background: hue }}>
            <div className={`lab ${styles.cardLabel}`}>{label}</div>
            <div
              className={`d ${styles.cardValue}`}
              style={{ fontSize: value.length > 12 ? 19 : 28 }}
            >
              {value}
            </div>
          </Panel>
        ))}
      </div>

      <Panel className={styles.working}>
        <div className="lab">Currently working on</div>
        {working.length === 0 ? (
          <p className={styles.empty}>Nothing logged as in progress this week.</p>
        ) : (
          <div className={styles.workingList}>
            {working.map((trick) => (
              <div key={trick.id} className={styles.workingRow}>
                <Tag color={CATS[trick.cat].color}>{categoryLabel(trick.cat, trick.sport)}</Tag>
                <span className={`cond ${styles.workingName}`}>{trick.name}</span>
                <SportChip sport={SPORT_LOOKS[trick.sport]} small />
                <span className={styles.rule} />
                <Difficulty value={trick.diff} small />
                {needsSupervision(trick) ? (
                  <span className={`lab ${styles.supervise}`}>Supervise</span>
                ) : null}
              </div>
            ))}
          </div>
        )}
        <p className={styles.note}>
          A trick is flagged &ldquo;Supervise&rdquo; when the rider goes upside down, commits to a
          drop they cannot step out of, or the trick should be learned into a foam pit or a resi
          ramp first. That is marked per trick rather than read off the difficulty, so it is not the
          same list as &ldquo;the hardest tricks&rdquo;. Each trick&rsquo;s own page carries the
          tips for learning it safely.
        </p>
      </Panel>
    </div>
  );
}
