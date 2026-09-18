import { DEFAULT_TIMEZONE, LANDED_STAGES, toDayKey, type SportId } from '@landit/core';
import {
  DEFAULT_RIDER_SORT,
  isAdminRiderSort,
  landedCountsFor,
  listAdminRiders,
  listPlans,
  relationCountsFor,
} from '@landit/db';
import type { Metadata } from 'next';

import { monthYear, relativeTime } from '@/lib/dates';
import { SPORT_LOOKS } from '@/lib/sports';
import { requireStaff } from '@/lib/staff';

import { bandLabel, riderStatus, type AdminPlanOption, type AdminRiderRow } from '../view';

import { RidersScreen } from './RidersScreen';

/**
 * The Riders tab (`landit-admin.jsx`, `AdminRiders`).
 *
 * Search and the plan filter are in the **URL**, not in component state, which
 * is the one place this departs from the prototype's shape and the reason is
 * the data: the prototype filtered fourteen mock riders in the browser, and
 * `users` is the collection with no upper bound on it. Filtering here means the
 * query runs in SQLite over an index instead of shipping the whole rider base
 * to a staff laptop to be filtered with `.includes`, and it means a staff
 * member can send somebody a link to what they are looking at.
 *
 * The sort (added 2026-09-18) is in the URL under the same rule and gains most
 * from it: "riders who have not been back in a month" is a thing one staff
 * member wants to hand another, and a link is how they do that.
 */
export const dynamic = 'force-dynamic';

/** On the page, not the layout — see `../layout.tsx` for why that matters. */
export const metadata: Metadata = {
  title: 'Riders · Staff portal',
  robots: { index: false, follow: false },
};

/** One page of the table. Forty rows is about two screens at this row height. */
const PER_PAGE = 40;

export default async function AdminRidersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; plan?: string; page?: string; sort?: string }>;
}) {
  const staff = await requireStaff();
  const pb = staff.superuser;
  const params = await searchParams;

  const query = (params.q ?? '').slice(0, 60);
  const pageNumber = Math.max(1, Number(params.page) || 1);
  // Narrowed against the db package's own vocabulary rather than passed
  // through: the sort reaches PocketBase in the same request as the filter,
  // and that filter language is where the privacy rules are written. An
  // unrecognised `?sort=` falls back to the default, for the same reason a
  // mangled `?plan=` shows the whole table.
  const sort = isAdminRiderSort(params.sort) ? params.sort : DEFAULT_RIDER_SORT;

  const plans = await listPlans(pb);
  // A plan slug from the query string is only honoured if it names a real plan.
  // Anything else is treated as "all", so a mangled link shows the whole table
  // rather than an empty one that looks like a rider base of nobody.
  const plan = plans.some((p) => p.slug === params.plan) ? params.plan : undefined;

  // `matchEmail` is this screen's own opt-in, not the filter's default — see
  // `AdminRiderFilter`. It is what makes a support mail findable: staff paste
  // the address they were written from and get the rider, instead of asking
  // somebody with database access. The address still never reaches the table.
  const page = await listAdminRiders(
    pb,
    { query, plan, matchEmail: true },
    { page: pageNumber, perPage: PER_PAGE, sort },
  );

  const ids = page.items.map((r) => r.id);

  // Three reads for the whole page, not three per row. Each is scoped to the
  // forty ids on screen and returns one column, so paging the table makes
  // these cheaper too — the shape `landedCountsFor` established and
  // `relationCountsFor` generalised. In parallel because none of them needs
  // another's answer, and serially they are three round trips of latency on
  // the screen staff open first.
  const [landed, sessions, crews] = await Promise.all([
    landedCountsFor(pb, ids, LANDED_STAGES),
    relationCountsFor(pb, 'sessions', 'user', ids),
    relationCountsFor(pb, 'crew_members', 'user', ids),
  ]);

  const now = new Date().toISOString();

  const rows: AdminRiderRow[] = page.items.map((rider) => {
    // `|| DEFAULT_TIMEZONE`, as every rider-facing screen already does it:
    // `toDayKey`'s default parameter only fires on `undefined`, so an empty
    // `users.timezone` reaches `Intl.DateTimeFormat` as `''` and throws a
    // RangeError. That was survivable while this column read `last_ride`,
    // which is empty on most rows and so never reached the formatter; with
    // `last_seen` set for everyone who has ever signed in, one erased account
    // (erasure clears `timezone`) would 500 the whole staff table.
    const zone = rider.timezone || DEFAULT_TIMEZONE;

    // `last_seen`, not `last_ride`: this column says when the rider last used
    // the app, and a rider who never taps "I rode today" still uses it daily.
    const seen = rider.last_seen ? relativeTime(rider.last_seen, now, zone) : '—';
    // Compared as day keys in the **rider's** timezone, not by reading the
    // sentence above: "3 days ago" and "20 min ago" both end in "ago", and a
    // string test that got that wrong would paint a third of the table green.
    const seenToday = rider.last_seen
      ? toDayKey(rider.last_seen, zone) === toDayKey(now, zone)
      : false;
    return {
      id: rider.id,
      name: rider.name || rider.handle || 'Rider',
      handle: rider.handle,
      avatarKey: rider.avatar_key || null,
      sports: (rider.sports ?? []).map((id) => SPORT_LOOKS[id as SportId]).filter(Boolean),
      landed: landed[rider.id] ?? 0,
      // Absent from the tally means no rows, which is zero — see
      // `relationCountsFor`.
      sessions: sessions[rider.id] ?? 0,
      crews: crews[rider.id] ?? 0,
      joined: rider.created ? monthYear(rider.created) : '—',
      seen,
      seenToday,
      ageBand: bandLabel(rider.age_band),
      plan: rider.plan,
      status: riderStatus(rider),
      isMe: rider.id === staff.rider.id,
    };
  });

  const planOptions: AdminPlanOption[] = plans.map((p) => ({
    slug: p.slug,
    name: p.name,
    hue: p.hue || 'var(--ink-3)',
  }));

  return (
    <RidersScreen
      rows={rows}
      plans={planOptions}
      query={query}
      plan={plan ?? 'all'}
      sort={sort}
      page={page.page}
      totalPages={page.totalPages}
      totalItems={page.totalItems}
    />
  );
}
