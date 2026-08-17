import { listReports, reportCounts, type ReportsStatus } from '@landit/db';
import type { Metadata } from 'next';

import { shortDateTime } from '@/lib/dates';
import { requireStaff } from '@/lib/staff';

import type { AdminReportRow, AdminReportStatus } from '../view';

import { ModerationScreen } from './ModerationScreen';

/**
 * The moderation queue over `reports` (plan §7, T17; §6.1/§6.5).
 *
 * The tab the prototype has no counterpart for. `landit-admin.jsx` predates the
 * collection, and the collection exists because the Online Safety Act wants a
 * reporting route that works for someone who is not a signed-up rider — hence a
 * nullable `reporter`, an open create rule, and an `outcome` a moderator writes.
 *
 * Three things about what this screen is allowed to know, and they are the whole
 * reason it is a separate screen rather than a table on Riders:
 *
 * - **The subject is an id and a type, never a resolved account.** Following a
 *   report into a rider's record here would make "report this profile" a way to
 *   get a child's account rendered on a staff screen by asking. Staff open the
 *   Riders tab, deliberately, when they need the person.
 * - **The reporter is shown as an address or as nothing.** A signed-in rider's
 *   id is not put on the screen: the moderator's job is the report, and a reply
 *   address is the only part of "who" that they need in order to do it.
 * - **`complaint_of` is carried through**, because an appeal against our own
 *   moderation decision is the route the OSA asks for, and an appeal that
 *   arrives detached from the decision it appeals is not one.
 *
 * Paged, because this is the one collection anyone on the internet can write to.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Moderation · Staff portal',
  robots: { index: false, follow: false },
};

const STATUSES: readonly ReportsStatus[] = ['open', 'reviewing', 'actioned', 'dismissed'];

/** The reason codes as sentences. The record stores the code; this is display. */
const REASON_LABEL: Readonly<Record<string, string>> = {
  harassment: 'Harassment or bullying',
  unsafe: 'Unsafe or dangerous',
  illegal: 'Illegal content',
  sexual: 'Sexual content',
  self_harm: 'Self-harm',
  spam: 'Spam',
  other: 'Something else',
};

const PER_PAGE = 25;

export default async function AdminModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const staff = await requireStaff();
  const pb = staff.superuser;
  const params = await searchParams;

  // A status from the query string is honoured only if it names a real one.
  // Anything else shows the whole queue rather than an empty screen that reads
  // as "nothing to moderate".
  const status = STATUSES.find((s) => s === params.status);
  const pageNumber = Math.max(1, Number(params.page) || 1);

  const [page, counts] = await Promise.all([
    listReports(pb, { status }, { page: pageNumber, perPage: PER_PAGE }),
    reportCounts(pb, STATUSES),
  ]);

  const rows: AdminReportRow[] = page.items.map((record) => ({
    id: record.id,
    status: (record.status || 'open') as AdminReportStatus,
    subjectType: record.subject_type,
    subjectId: record.subject_id,
    reason: record.reason,
    reasonLabel: REASON_LABEL[record.reason] ?? record.reason ?? 'Not given',
    detail: record.detail,
    outcome: record.outcome,
    reporterEmail: record.reporter_email,
    fromRider: Boolean(record.reporter),
    complaintOf: record.complaint_of,
    filed: record.created ? shortDateTime(record.created) : '—',
    updated: record.updated ? shortDateTime(record.updated) : '—',
  }));

  return (
    <ModerationScreen
      rows={rows}
      counts={counts}
      status={status ?? 'all'}
      page={page.page}
      totalPages={page.totalPages}
      totalItems={page.totalItems}
    />
  );
}
