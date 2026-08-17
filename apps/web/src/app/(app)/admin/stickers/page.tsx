import { stickerCondition, stickerRule, type SportId } from '@landit/core';
import { listAdminStickers } from '@landit/db';
import type { Metadata } from 'next';

import { SPORT_LOOKS } from '@/lib/sports';
import { requireStaff } from '@/lib/staff';

import type { AdminStickerRow } from '../view';

import { StickersScreen } from './StickersScreen';

/**
 * The Stickers tab (`landit-admin.jsx`, `AdminStickers`).
 *
 * What staff can change here is exactly the editable half of the split plan §3
 * draws: the record's name, copy, colour, threshold and live flag. The
 * *condition* is a function in `@landit/core` keyed by slug, and it is not
 * editable from anywhere — staff can retune a milestone, they cannot invent a
 * rule, and a client cannot forge one.
 *
 * That split has a visible failure mode this screen exists to surface: a sticker
 * record whose slug has no entry in `STICKER_RULES` is a badge nobody can ever
 * earn, and nothing about the record itself says so. `stickerRule` is asked, per
 * row, and the answer is a warning rather than something staff have to know.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Stickers · Staff portal',
  robots: { index: false, follow: false },
};

export default async function AdminStickersPage() {
  const staff = await requireStaff();
  const stickers = await listAdminStickers(staff.superuser);

  const rows: AdminStickerRow[] = stickers.map((record) => {
    // A number field with nothing in it reads as 0, and 0 is a real threshold
    // for a rule that counts. The convention across the app is the same as the
    // rider's wall: falsy means "no threshold on this record".
    const threshold = record.n ? record.n : null;

    return {
      id: record.id,
      slug: record.slug,
      name: record.name,
      hue: record.hue || 'var(--ink-3)',
      sport: record.sport ? (SPORT_LOOKS[record.sport as SportId] ?? null) : null,
      condition: stickerCondition({
        id: record.slug,
        name: record.name,
        sport: (record.sport || null) as SportId | null,
        hue: record.hue,
        ico: record.ico,
        cond: record.cond,
        isLive: record.is_live,
        ...(threshold !== null ? { n: threshold } : {}),
      }),
      cond: record.cond,
      threshold,
      isLive: record.is_live,
      hasRule: stickerRule(record.slug) !== undefined,
    };
  });

  return <StickersScreen rows={rows} />;
}
