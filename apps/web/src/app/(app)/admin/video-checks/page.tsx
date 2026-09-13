import { describeVideoCheckRun, listVideoCheckRunsPage } from '@landit/db';
import type { Metadata } from 'next';

import { shortDateTime } from '@/lib/dates';
import { requireStaff } from '@/lib/staff';

import type { AdminVideoCheckChange, AdminVideoCheckRow } from '../view';

import { VideoChecksScreen } from './VideoChecksScreen';

/**
 * The Video checks tab — what the nightly tutorial check has been doing (#463).
 *
 * The twelfth tab, and the first that is a job's history rather than a queue of
 * things to work through. The check switches off a curated tutorial that has
 * been deleted or made private and puts back one that has returned; until this
 * screen it said so only on the trick itself and in the scheduler's scrollback,
 * neither of which answers "is this still running?".
 *
 * **Every run gets a row, including the nights nothing changed**, and that is
 * the whole reason the screen is worth having. A history of changes alone is
 * blank on a healthy night, so "all fine" and "stopped running in August" look
 * identical — and the second is the one that quietly leaves dead links on trick
 * pages. A column of "No changes" with a gap in it says what a blank page
 * cannot.
 *
 * **Read-only, deliberately.** Nothing here is a control: a staff member who
 * disagrees with a switch-off changes it on the trick, in the Trick library
 * tab, where the video and its link are. A second place to un-hide the same
 * video is a second place for the two to disagree.
 *
 * No filter and no search. One row a night is 365 a year, and the only question
 * anyone brings is "what happened lately", which a reverse-dated page answers
 * on its first screen.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Video checks · Staff portal',
  robots: { index: false, follow: false },
};

/** Rows are short — a date, three numbers and a line — so more than Events'. */
const PER_PAGE = 30;

/**
 * The stored `changes` JSON, read defensively.
 *
 * PocketBase hands a JSON field back as `unknown`, and this one was written by
 * a script rather than by a form, so a row from an older version of that script
 * is a real possibility. A shape that does not parse is dropped rather than
 * thrown on: a history page that 500s because one night's row is odd is worse
 * than one that shows the counts and skips a detail line.
 */
function changesOf(value: unknown): AdminVideoCheckChange[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry): AdminVideoCheckChange[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const row = entry as Record<string, unknown>;
    const slug = typeof row.slug === 'string' ? row.slug : '';
    if (!slug) return [];

    return [
      {
        slug,
        name: typeof row.name === 'string' && row.name ? row.name : slug,
        videoId: typeof row.videoId === 'string' ? row.videoId : '',
        action: row.action === 'back' ? 'back' : 'off',
        reason: typeof row.reason === 'string' ? row.reason : '',
      },
    ];
  });
}

export default async function AdminVideoChecksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const staff = await requireStaff();
  const pb = staff.superuser;
  const params = await searchParams;

  const pageNumber = Math.max(1, Number(params.page) || 1);
  const page = await listVideoCheckRunsPage(pb, { page: pageNumber, perPage: PER_PAGE });

  const rows: AdminVideoCheckRow[] = page.items.map((record) => ({
    id: record.id,
    ran: record.created ? shortDateTime(record.created) : '—',
    checked: record.checked ?? 0,
    hidden: record.hidden ?? 0,
    restored: record.restored ?? 0,
    // The same sentence the script would print, from `@landit/db`, so the log
    // and the page cannot drift into describing one run two ways.
    summary: describeVideoCheckRun({
      hidden: record.hidden ?? 0,
      restored: record.restored ?? 0,
    }),
    changes: changesOf(record.changes),
    note: record.note ?? '',
  }));

  return (
    <VideoChecksScreen
      rows={rows}
      page={page.page}
      totalPages={page.totalPages}
      totalItems={page.totalItems}
    />
  );
}
