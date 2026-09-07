import { SPORTS, type SportId } from '@landit/core';
import {
  announcementCounts,
  listAdminAnnouncementsPage,
  listPlans,
  relationCountsFor,
} from '@landit/db';
import type { Metadata } from 'next';

import { shortDateTime } from '@/lib/dates';
import { requireStaff } from '@/lib/staff';

import type { AdminNoticeRow } from '../view';

import { NoticesScreen } from './NoticesScreen';

/**
 * The Announcements tab (`landit-admin.jsx`, `AdminNotices`).
 *
 * A banner is the one thing in this product that speaks to every rider at once,
 * so the tab shows two numbers the prototype had no way to know: how many riders
 * have dismissed each one, and whether it is still up. Both exist to make
 * "post" feel like the broadcast it is.
 *
 * The audience is three columns in the schema and one control on the form —
 * `content-actions.ts` owns that mapping. Here it is turned back into one
 * sentence, from the plan records rather than a literal, so a plan renamed on
 * the Plans tab renames itself here too.
 *
 * **Paged, and the dismissal count is scoped to the page** (issue #340). It
 * used to read the whole of `announcement_dismissals` — one row per rider per
 * banner they closed — to put a number on each of a handful of rows. That is
 * riders × banners, so it grew with the rider base rather than with the tab,
 * and every banner ever posted made it worse for good: the tab never deletes
 * anything, deliberately.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Announcements · Staff portal',
  robots: { index: false, follow: false },
};

/** Notice cards are tall — a title, a body and a meta line. */
const PER_PAGE = 20;

export default async function AdminNoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; page?: string }>;
}) {
  const staff = await requireStaff();
  const pb = staff.superuser;
  const params = await searchParams;

  const pageNumber = Math.max(1, Number(params.page) || 1);
  // Tri-state, defaulting to both. A pulled banner is the record of something
  // the product said to every rider, and the tab keeps it greyed rather than
  // gone — a default that hid it would quietly undo that.
  const show = params.show === 'live' || params.show === 'pulled' ? params.show : undefined;

  const [page, counts, plans] = await Promise.all([
    listAdminAnnouncementsPage(pb, show ? { live: show === 'live' } : {}, {
      page: pageNumber,
      perPage: PER_PAGE,
    }),
    announcementCounts(pb),
    listPlans(pb),
  ]);

  const seen = await relationCountsFor(
    pb,
    'announcement_dismissals',
    'announcement',
    page.items.map((n) => n.id),
  );

  const planName = (slug: string) => plans.find((p) => p.slug === slug)?.name ?? slug;

  const rows: AdminNoticeRow[] = page.items.map((record) => ({
    id: record.id,
    title: record.title,
    body: record.body,
    label: record.label || 'Land The Trick',
    hue: record.hue || '#FFC23F',
    audienceLabel:
      record.audience === 'plan' && record.audience_plan
        ? `${planName(record.audience_plan)} riders`
        : record.audience === 'sport' && record.audience_sport
          ? `${SPORTS[record.audience_sport as SportId]?.label ?? record.audience_sport} riders`
          : 'Everyone',
    isLive: record.is_live,
    posted: record.created ? shortDateTime(record.created) : '—',
    dismissals: seen[record.id] ?? 0,
  }));

  return (
    <NoticesScreen
      rows={rows}
      plans={plans.map((p) => ({ slug: p.slug, name: p.name, hue: p.hue || 'var(--ink-3)' }))}
      counts={counts}
      show={show ?? 'all'}
      page={page.page}
      totalPages={page.totalPages}
      totalItems={page.totalItems}
    />
  );
}
