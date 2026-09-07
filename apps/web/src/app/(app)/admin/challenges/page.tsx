import {
  SPORT_IDS,
  challengeRangeLabel,
  challengeState,
  challengeStateBounds,
  riderToday,
  type ChallengeState,
  type SportId,
} from '@landit/core';
import {
  challengeCounts,
  challengesFromRecords,
  featuredChallenge,
  listAdminChallengesPage,
  relationCountsFor,
  type ChallengesSport,
} from '@landit/db';
import type { Metadata } from 'next';

import { requireStaff } from '@/lib/staff';

import type { AdminChallengeRow } from '../view';

import { ChallengesScreen } from './ChallengesScreen';

/**
 * The Challenges tab (`landit-admin.jsx`, `AdminChallenges`).
 *
 * **State is derived here, never read.** `challenges` has no live column and
 * should not gain one: whether a week is running is a question its dates already
 * answer, and a stored flag would be a second answer able to disagree with the
 * first (plan §2.2, §3). `challengeState` is the same function the rider's
 * screen calls, so the two cannot say different things about the same week.
 *
 * **Paging made that awkward, and here is how it was resolved.** A page has to
 * be selected in the database, and the database cannot call `challengeState`.
 * `challengeStateBounds` in `@landit/core` gives the day comparisons that mean
 * the same thing, and `challenges.test.ts` holds the two equivalent. Both the
 * filter and every row's state chip are resolved against the **same** `today`,
 * computed once below — two clock reads either side of midnight would otherwise
 * select a week and then label it with a state the filter disagrees with.
 *
 * The log count on each row is what makes the delete honest — see
 * `deleteChallengeAction`. It is read in one grouped pass scoped to the ids on
 * the page, not one query per week and not the whole of `challenge_log`, which
 * is riders × weeks and outgrows this table by the size of the rider base
 * (issue #340).
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Challenges · Staff portal',
  robots: { index: false, follow: false },
};

const STATES: readonly ChallengeState[] = ['live', 'upcoming', 'past'];

/** A sport's calendar is about a year of weeks; two screens of them at a time. */
const PER_PAGE = 25;

export default async function AdminChallengesPage({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string; state?: string; page?: string }>;
}) {
  const staff = await requireStaff();
  const pb = staff.superuser;
  const params = await searchParams;

  // The tab has always been per-sport — it opened on the first sport and there
  // was no "every sport" view, because one live week per sport is the rule the
  // calendar is read against. Paging did not change that; it only moved which
  // sport into the URL.
  const sport = (SPORT_IDS.find((id) => id === params.sport) ?? SPORT_IDS[0]) as SportId;
  const state = STATES.find((s) => s === params.state);
  const pageNumber = Math.max(1, Number(params.page) || 1);

  // One clock read for the whole request, kept as the instant rather than only
  // as the day: the filter needs a day key and `challengeState` takes a clock,
  // and deriving both from one `now` is what stops a request that straddles
  // midnight from selecting a week and then labelling it with a state the
  // filter disagrees with.
  // `new Date().toISOString()` rather than `Date.now()`: the same instant, and
  // the shape every other page here uses (`riders/page.tsx`). `Date.now` also
  // trips `react-hooks/purity` in a component.
  const now = new Date().toISOString();
  const today = riderToday({ now });
  const boundsFor = (s: ChallengeState) => challengeStateBounds(s, today);

  const [page, counts, featured] = await Promise.all([
    listAdminChallengesPage(
      pb,
      { sport: sport as ChallengesSport, ...(state ? { bounds: boundsFor(state) } : {}) },
      { page: pageNumber, perPage: PER_PAGE },
    ),
    challengeCounts(pb, {
      // The sport pills count every week of that sport; the state pills count
      // within the sport being looked at, which is what the screen shows.
      ...Object.fromEntries(
        SPORT_IDS.map((id) => [`sport:${id}`, { sport: id as ChallengesSport }]),
      ),
      ...Object.fromEntries(
        STATES.map((s) => [
          `state:${s}`,
          { sport: sport as ChallengesSport, bounds: boundsFor(s) },
        ]),
      ),
    }),
    featuredChallenge(pb, sport as ChallengesSport, boundsFor('live'), boundsFor('upcoming')),
  ]);

  const logged = await relationCountsFor(
    pb,
    'challenge_log',
    'challenge',
    page.items.map((c) => c.id),
  );

  const rowFrom = (record: (typeof page.items)[number], loggedCount: number): AdminChallengeRow => {
    // The canonical shape, so `challengeState` and `challengeRangeLabel` are the
    // rider's own functions rather than this file re-deriving either.
    const challenge = challengesFromRecords([record])[0];

    return {
      id: record.id,
      slug: record.slug,
      sport: record.sport,
      week: record.week,
      title: record.title,
      blurb: record.blurb,
      range: challenge ? challengeRangeLabel(challenge) : '—',
      starts: record.starts.slice(0, 10),
      ends: record.ends.slice(0, 10),
      goal: record.goal,
      reward: record.reward,
      hue: record.hue || 'var(--sky)',
      ridersCopy: record.riders_copy,
      verb: record.verb,
      // Against the same instant the filter's day came from, never a second
      // clock read.
      state: challenge ? challengeState(challenge, { now }) : 'past',
      logged: loggedCount,
    };
  };

  const rows: AdminChallengeRow[] = page.items.map((record) =>
    rowFrom(record, logged[record.id] ?? 0),
  );

  return (
    <ChallengesScreen
      rows={rows}
      sport={sport}
      state={state ?? 'all'}
      counts={counts}
      featured={featured ? rowFrom(featured, 0) : null}
      page={page.page}
      totalPages={page.totalPages}
      totalItems={page.totalItems}
    />
  );
}
