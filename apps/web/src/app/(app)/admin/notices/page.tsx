import { SPORTS, type SportId } from '@landit/core';
import { listAdminAnnouncements, listPlans, records } from '@landit/db';
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
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Announcements · Staff portal',
  robots: { index: false, follow: false },
};

export default async function AdminNoticesPage() {
  const staff = await requireStaff();
  const pb = staff.superuser;

  const [notices, plans, dismissals] = await Promise.all([
    listAdminAnnouncements(pb),
    listPlans(pb),
    records(pb, 'announcement_dismissals').list({ fields: 'announcement' }),
  ]);

  const seen = new Map<string, number>();
  for (const row of dismissals) {
    seen.set(row.announcement, (seen.get(row.announcement) ?? 0) + 1);
  }

  const planName = (slug: string) => plans.find((p) => p.slug === slug)?.name ?? slug;

  const rows: AdminNoticeRow[] = notices.map((record) => ({
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
    dismissals: seen.get(record.id) ?? 0,
  }));

  return (
    <NoticesScreen
      rows={rows}
      plans={plans.map((p) => ({ slug: p.slug, name: p.name, hue: p.hue || 'var(--ink-3)' }))}
    />
  );
}
