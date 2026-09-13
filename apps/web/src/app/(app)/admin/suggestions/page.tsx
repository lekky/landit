import { listSuggestions, suggestionCounts, type SuggestionsStatus } from '@landit/db';
import { suggestionTopicLabel } from '@landit/core';
import type { Metadata } from 'next';

import { shortDateTime } from '@/lib/dates';
import { requireStaff } from '@/lib/staff';

import type { AdminSuggestionRow, AdminSuggestionStatus } from '../view';

import { SuggestionsScreen } from './SuggestionsScreen';

/**
 * The ideas queue (2026-09-12).
 *
 * The eleventh tab, and the sibling of Moderation rather than a part of it.
 * They are two screens over two collections because `suggestions` has its own
 * rate limits: if ideas and reports shared a table, a rider who sent their
 * hourly allowance of ideas could not then file a safeguarding report, and a
 * moderator would be reading past trick requests to find the thing they were
 * looking for. See `pocketbase/hooks/97_suggestions.pb.js`.
 *
 * **It is a much less careful screen than Moderation, and that is correct.** A
 * report carries an accusation about a person, so that screen refuses to
 * resolve a subject, refuses to show a reporter's id, and keeps triage away
 * from the account. A suggestion carries somebody's idea about a website. There
 * is no subject to protect and nothing here that could become a way to read a
 * child's account by asking.
 *
 * One thing it does share: **the rider who sent it is not named.** Not for
 * safety — for the same reason the moderation queue does not name a reporter.
 * Staff are reading the idea, and whose it was is not part of judging it.
 *
 * Paged, because a suggestion box is a thing riders enjoy using.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ideas · Staff portal',
  robots: { index: false, follow: false },
};

const STATUSES: readonly SuggestionsStatus[] = ['new', 'reviewing', 'accepted', 'declined'];

const PER_PAGE = 25;

export default async function AdminSuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const staff = await requireStaff();
  const pb = staff.superuser;
  const params = await searchParams;

  // A status from the query string is honoured only if it names a real one.
  // Anything else shows the whole queue rather than an empty screen that reads
  // as "nothing to read".
  const status = STATUSES.find((s) => s === params.status);
  const pageNumber = Math.max(1, Number(params.page) || 1);

  const [page, counts] = await Promise.all([
    listSuggestions(pb, { status }, { page: pageNumber, perPage: PER_PAGE }),
    suggestionCounts(pb, STATUSES),
  ]);

  const rows: AdminSuggestionRow[] = page.items.map((record) => ({
    id: record.id,
    status: (record.status || 'new') as AdminSuggestionStatus,
    topic: record.topic,
    // The label comes from `@landit/core`, so the queue and the form cannot
    // drift into calling the same topic two different things.
    topicLabel: suggestionTopicLabel(record.topic),
    detail: record.detail,
    note: record.note,
    sent: record.created ? shortDateTime(record.created) : '—',
    updated: record.updated ? shortDateTime(record.updated) : '—',
  }));

  return (
    <SuggestionsScreen
      rows={rows}
      counts={counts}
      status={status ?? 'all'}
      page={page.page}
      totalPages={page.totalPages}
      totalItems={page.totalItems}
    />
  );
}
