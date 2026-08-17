import { EVENT_KIND_IDS, eventDateBlock, eventKindColor, type SportId } from '@landit/core';
import { listAdminEvents, records } from '@landit/db';
import type { Metadata } from 'next';

import { SPORT_LOOKS } from '@/lib/sports';
import { requireStaff } from '@/lib/staff';

import type { AdminEventRow } from '../view';

import { EventsScreen } from './EventsScreen';

/**
 * The Events tab (`landit-admin.jsx`, `AdminEvents`).
 *
 * The attendance count is read in one grouped pass rather than one query per
 * row, for the same reason `landedCountsFor` exists: a calendar page is a table
 * of events and a per-row read is a query per row that gets slower as the
 * calendar fills. It is on the screen because it is the number that makes
 * "take this off the calendar" a decision rather than a click — an event with
 * forty riders going is not the same thing as one with none.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Events · Staff portal',
  robots: { index: false, follow: false },
};

export default async function AdminEventsPage() {
  const staff = await requireStaff();
  const pb = staff.superuser;

  const events = await listAdminEvents(pb);
  const attendance = await records(pb, 'event_attendance').list({ fields: 'event' });

  const going = new Map<string, number>();
  for (const row of attendance) going.set(row.event, (going.get(row.event) ?? 0) + 1);

  const rows: AdminEventRow[] = events.map((record) => {
    const day = record.date ? record.date.slice(0, 10) : '';
    // `eventDateBlock` is `@landit/core`'s, so the staff table and the rider's
    // calendar say the same words about the same date — and neither goes near
    // `toLocaleDateString`, which disagrees between Node and the browser
    // (LESSONS §3a).
    const block = day ? eventDateBlock(day) : null;

    return {
      id: record.id,
      slug: record.slug,
      name: record.name,
      kind: record.kind || '',
      kindColor: record.kind ? eventKindColor(record.kind) : 'var(--ink)',
      when: block ? `${block.day} ${block.month}` : '—',
      date: day,
      town: record.town,
      venue: record.venue,
      level: record.level,
      price: record.price,
      spotsCopy: record.spots_copy,
      blurb: record.blurb,
      sports: [...(record.sports ?? [])],
      sportLooks: (record.sports ?? [])
        .map((id) => SPORT_LOOKS[id as SportId])
        .filter((look) => look !== undefined),
      isLive: record.is_live,
      attending: going.get(record.id) ?? 0,
    };
  });

  return <EventsScreen rows={rows} kinds={[...EVENT_KIND_IDS]} />;
}
