import { SPOT_TYPES, type SportId } from '@landit/core';
import { listAdminSpots } from '@landit/db';
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
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Spots · Staff portal',
  robots: { index: false, follow: false },
};

export default async function AdminSpotsPage() {
  const staff = await requireStaff();
  const spots = await listAdminSpots(staff.superuser);

  const rows: AdminSpotRow[] = spots.map((record) => ({
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

  return <SpotsScreen rows={rows} types={[...SPOT_TYPES]} />;
}
