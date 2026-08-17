import { challengeRangeLabel, challengeState } from '@landit/core';
import { challengesFromRecords, listChallenges, records } from '@landit/db';
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
 * The log count on each row is what makes the delete honest — see
 * `deleteChallengeAction`. It is read in one grouped pass, not one query per
 * week.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Challenges · Staff portal',
  robots: { index: false, follow: false },
};

export default async function AdminChallengesPage() {
  const staff = await requireStaff();
  const pb = staff.superuser;

  const [challengeRecords, log] = await Promise.all([
    listChallenges(pb),
    records(pb, 'challenge_log').list({ fields: 'challenge' }),
  ]);

  const logged = new Map<string, number>();
  for (const row of log) logged.set(row.challenge, (logged.get(row.challenge) ?? 0) + 1);

  const bySlug = new Map(challengesFromRecords(challengeRecords).map((c) => [c.id, c]));

  const rows: AdminChallengeRow[] = challengeRecords.map((record) => {
    const challenge = bySlug.get(record.slug);

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
      state: challenge ? challengeState(challenge) : 'past',
      logged: logged.get(record.id) ?? 0,
    };
  });

  return <ChallengesScreen rows={rows} />;
}
