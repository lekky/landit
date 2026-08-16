import { SPORT_IDS } from '@landit/core';

import { e2eSuperuser } from './seed-library';

/**
 * A challenge and an event for every sport, dated relative to **today**.
 *
 * The canonical seed is not usable here, and the reason is worth keeping: the
 * shipped challenges run weeks 30–35 of 2026 because that is what the design
 * pack transcribed. "Which week is live" is derived from those dates, so a spec
 * asserting "Live now" against them passes in August 2026 and fails in
 * September — a test with an expiry date, which is worse than no test because
 * it fails long after the change that would have justified it.
 *
 * So the schedule is written by the spec, around `Date.now()`, and the
 * assertions are true whenever they run.
 *
 * **One live challenge per sport is enforced by a hook**, so these have to be
 * scheduled as carefully as staff would: one live week and one finished week
 * per sport, with a gap between them. Slugs are namespaced `e2e-` so a re-run
 * against a warm database updates rather than collides.
 */

const DAY = 86_400_000;
const day = (offset: number): string =>
  new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);

export interface SeededSchedule {
  /** Slug of the live challenge for each sport. */
  readonly live: Readonly<Record<string, string>>;
  /** Slug of the finished challenge for each sport. */
  readonly finished: Readonly<Record<string, string>>;
  readonly liveGoal: number;
  /** Slug of the event every sport is good for. */
  readonly sharedEvent: string;
}

export const LIVE_GOAL = 3;

export async function seedSchedule(): Promise<SeededSchedule> {
  const client = await e2eSuperuser();

  const upsert = async (
    collection: 'challenges' | 'events',
    slug: string,
    body: Record<string, unknown>,
  ) => {
    const existing = await client
      .collection(collection)
      .getFirstListItem(client.filter('slug = {:slug}', { slug }))
      .catch(() => null);
    if (existing) await client.collection(collection).update(existing.id, { slug, ...body });
    else await client.collection(collection).create({ slug, ...body });
  };

  const live: Record<string, string> = {};
  const finished: Record<string, string> = {};

  for (const sport of SPORT_IDS) {
    const liveSlug = `e2e-live-${sport}`;
    const pastSlug = `e2e-past-${sport}`;

    await upsert('challenges', liveSlug, {
      sport,
      week: 'This week',
      title: `Live ${sport} week`,
      blurb: `The ${sport} challenge running right now.`,
      starts: day(-3),
      ends: day(3),
      goal: LIVE_GOAL,
      reward: 'Challenger sticker',
      hue: '#3AC0FF',
      riders_copy: '',
      verb: `Log a ${sport} thing`,
    });

    await upsert('challenges', pastSlug, {
      sport,
      week: 'A while back',
      title: `Finished ${sport} week`,
      blurb: 'This one is over.',
      starts: day(-40),
      ends: day(-34),
      goal: LIVE_GOAL,
      reward: 'Challenger sticker',
      hue: '#9CE05B',
      riders_copy: '',
      verb: 'Log it',
    });

    live[sport] = liveSlug;
    finished[sport] = pastSlug;
  }

  // One event good for every sport, so the "good for X" filter has something to
  // find whichever tab the rider is on, and one that is over, so "upcoming
  // only" has something to hide.
  await upsert('events', 'e2e-jam', {
    name: 'E2E Northern Jam',
    kind: 'Comp',
    town: 'Manchester',
    venue: 'Projekts MCR',
    date: day(14),
    sports: [...SPORT_IDS],
    level: 'All levels',
    price: '£8 entry',
    spots_copy: '40 riders',
    blurb: 'Jam format, open practice all day, best trick at four.',
    is_live: true,
  });

  await upsert('events', 'e2e-gone', {
    name: 'E2E Last Month Session',
    kind: 'Session',
    town: 'Sheffield',
    venue: 'Hillside Bowl',
    date: day(-20),
    sports: [...SPORT_IDS],
    level: 'Beginner friendly',
    price: 'Free',
    spots_copy: 'Drop in',
    blurb: 'Already happened.',
    is_live: true,
  });

  return { live, finished, liveGoal: LIVE_GOAL, sharedEvent: 'e2e-jam' };
}
