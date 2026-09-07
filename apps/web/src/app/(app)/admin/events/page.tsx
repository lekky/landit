import { EVENT_KIND_IDS, eventDateBlock, eventKindColor, type SportId } from '@landit/core';
import { listAdminEventsPage, relationCountsFor } from '@landit/db';
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
 *
 * **That pass is now scoped to the page, and this is the half of the change
 * that actually mattered.** It used to read `event_attendance` in full — every
 * "I am going" ever marked, by every rider, for every event — to put one number
 * on each of a few hundred rows. That collection is riders × events, so it
 * outgrows the table it decorates by the size of the rider base, and no amount
 * of paging the rows would have touched it. `relationCountsFor` takes the
 * twenty-five ids on screen and asks about those, so the read shrinks with the
 * page instead of the page getting cheaper to render and no cheaper to build.
 *
 * Paged and searchable because the calendar is the collection that only ever
 * grows: an event that has happened is never deleted (`event_attendance`
 * cascades from it), so every season adds rows and none leave.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Events · Staff portal',
  robots: { index: false, follow: false },
};

/** Event rows are tall — a name, a venue and five chips — so fewer than Spots'. */
const PER_PAGE = 25;

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; show?: string; page?: string }>;
}) {
  const staff = await requireStaff();
  const pb = staff.superuser;
  const params = await searchParams;

  const query = (params.q ?? '').slice(0, 60);
  const pageNumber = Math.max(1, Number(params.page) || 1);
  // Three states, and "both" is the default the tab has always had. An event
  // taken off the calendar has to stay findable from the screen that took it
  // down, or "Remove" becomes a delete with extra steps.
  const show = params.show === 'live' || params.show === 'hidden' ? params.show : undefined;

  const page = await listAdminEventsPage(
    pb,
    { query, ...(show ? { live: show === 'live' } : {}) },
    { page: pageNumber, perPage: PER_PAGE },
  );

  const going = await relationCountsFor(
    pb,
    'event_attendance',
    'event',
    page.items.map((e) => e.id),
  );

  const rows: AdminEventRow[] = page.items.map((record) => {
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
      country: record.country,
      address: record.address,
      phone: record.phone,
      sourceUrl: record.source_url,
      // Blank rather than "0": the editor's boxes are strings, and an empty box
      // is how staff say "this venue has no pin" (`coordinate` in
      // `content-actions.ts` reads it back the same way).
      lat: record.lat ? String(record.lat) : '',
      lng: record.lng ? String(record.lng) : '',
      level: record.level,
      price: record.price,
      spotsCopy: record.spots_copy,
      blurb: record.blurb,
      sports: [...(record.sports ?? [])],
      sportLooks: (record.sports ?? [])
        .map((id) => SPORT_LOOKS[id as SportId])
        .filter((look) => look !== undefined),
      isLive: record.is_live,
      attending: going[record.id] ?? 0,
    };
  });

  return (
    <EventsScreen
      rows={rows}
      kinds={[...EVENT_KIND_IDS]}
      query={query}
      show={show ?? 'all'}
      page={page.page}
      totalPages={page.totalPages}
      totalItems={page.totalItems}
    />
  );
}
