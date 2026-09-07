import { SPOT_TYPES, type SportId } from '@landit/core';
import { listAdminSpotsPage, spotCounts, type SpotsStatus } from '@landit/db';
import type { Metadata } from 'next';

import { shortDate } from '@/lib/dates';
import { SPORT_LOOKS } from '@/lib/sports';
import { requireStaff } from '@/lib/staff';

import type { AdminSpotRow, AdminSpotStatus } from '../view';

import { SpotsScreen } from './SpotsScreen';

/**
 * The Spots tab (`landit-admin.jsx`, `AdminSpots`).
 *
 * The one tab whose queue is invisible to every other client in the product:
 * `spots` is filtered by an API rule to `status = 'live'` or your own
 * submissions, which is the rule that makes "a rider submission reaches nobody
 * until a human approves it" true (plan §6.1). The superuser client is the only
 * one that sees the pending pile, which is why this screen exists at all.
 *
 * The submitter is shown as an id and nothing else. Resolving it to a name and
 * a handle would be a second read per row and would turn the queue into a way
 * to browse rider records sideways — staff who need the rider open the Riders
 * tab, which is the screen that is allowed to know about riders.
 *
 * **Paged, and the status is a filter rather than three headings.** The screen
 * used to render every spot at once under Waiting / Live / Rejected, which was
 * right for a seeded map and stops being right the moment riders submit: this
 * is the collection strangers write to, so it grows the way `users` and
 * `reports` do, and those are the two tabs that were already paged. Status and
 * search go in the URL for the reason the riders table does — the query runs in
 * SQLite over an index instead of shipping the whole map to a staff laptop, and
 * a staff member can send somebody a link to what they are looking at.
 *
 * What the three headings were *for* is kept: the counts ride on the filter
 * pills, so "twelve waiting" is legible from whichever status is on screen. A
 * queue whose length you can only discover by clicking into it is a queue
 * people stop working.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Spots · Staff portal',
  robots: { index: false, follow: false },
};

const STATUSES: readonly SpotsStatus[] = ['pending', 'live', 'rejected'];

/** One page of the table. Spot rows are short, so this is about two screens. */
const PER_PAGE = 40;

export default async function AdminSpotsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const staff = await requireStaff();
  const pb = staff.superuser;
  const params = await searchParams;

  const query = (params.q ?? '').slice(0, 60);
  const pageNumber = Math.max(1, Number(params.page) || 1);
  // A status from the query string is honoured only if it names a real one.
  // Anything else shows every status rather than an empty screen that reads as
  // "no spots", which on this tab would read as "the map is empty".
  const status = STATUSES.find((s) => s === params.status);

  const [page, counts] = await Promise.all([
    listAdminSpotsPage(pb, { query, status }, { page: pageNumber, perPage: PER_PAGE }),
    spotCounts(pb, STATUSES, { query }),
  ]);

  const rows: AdminSpotRow[] = page.items.map((record) => ({
    id: record.id,
    name: record.name,
    town: record.town,
    type: record.type,
    tags: Array.isArray(record.tags) ? (record.tags as string[]) : [],
    sports: [...(record.sports ?? [])],
    sportLooks: (record.sports ?? [])
      .map((id) => SPORT_LOOKS[id as SportId])
      .filter((look) => look !== undefined),
    status: (record.status || 'pending') as AdminSpotStatus,
    lat: record.lat,
    lng: record.lng,
    submittedBy: record.submitted_by || '',
    submitted: record.created ? shortDate(record.created) : '—',
  }));

  return (
    <SpotsScreen
      rows={rows}
      types={[...SPOT_TYPES]}
      counts={counts}
      query={query}
      status={status ?? 'all'}
      page={page.page}
      totalPages={page.totalPages}
      totalItems={page.totalItems}
    />
  );
}
