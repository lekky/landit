import { CATS, FREE_MAX_DIFF, TIERS_LABEL, isTrickFree, type CategoryId } from '@landit/core';
import { listTrickPrereqs, listTricks, tricksFromRecords } from '@landit/db';
import type { Metadata } from 'next';

import { requireStaff } from '@/lib/staff';

import type { AdminTrickRow, TrickTier } from '../view';

import { TricksScreen } from './TricksScreen';

/**
 * The Trick library tab (`landit-admin.jsx`, `AdminTricks`).
 *
 * Read with `includeHidden`, which is the whole difference between this and the
 * rider's library: `is_live = false` is the tab's own "Remove", so a screen that
 * inherited the rider filter would lose every trick staff had taken down —
 * including the one they just clicked, which would then be unrecoverable from
 * the product.
 *
 * The rows are built here rather than in the browser because the mapping needs
 * `tricksFromRecords` and the prerequisite edges, and the prerequisite names are
 * a join the client has no business doing. Filtering, though, stays in the
 * browser, which is the opposite of the Riders tab and for a stated reason: the
 * library is a bounded catalogue of a hundred-odd rows that staff scan and
 * re-sort constantly, `users` is unbounded. A round trip per keystroke here
 * would be slower and buy nothing.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Trick library · Staff portal',
  robots: { index: false, follow: false },
};

export default async function AdminTricksPage() {
  const staff = await requireStaff();
  const pb = staff.superuser;

  const [trickRecords, prereqs] = await Promise.all([
    listTricks(pb, { includeHidden: true }),
    listTrickPrereqs(pb),
  ]);

  // The canonical shape, so `isTrickFree` decides what a rider would see rather
  // than this file re-deriving the default cut-off from `diff` (plan §3).
  const tricks = tricksFromRecords(trickRecords, prereqs);
  const bySlug = new Map(tricks.map((t) => [t.id, t]));
  const nameBySlug = new Map(tricks.map((t) => [t.id, t.name]));

  const rows: AdminTrickRow[] = trickRecords.map((record) => {
    const trick = bySlug.get(record.slug);
    const cat = CATS[record.cat as CategoryId];
    const pre = trick?.pre ?? [];

    return {
      id: record.id,
      slug: record.slug,
      name: record.name,
      sport: record.sport,
      cat: record.cat,
      catLabel: cat?.label ?? record.cat,
      catColor: cat?.color ?? 'var(--ink-3)',
      diff: record.diff,
      tierLabel: TIERS_LABEL[record.diff - 1] ?? '',
      buildsOn:
        pre
          .map((slug) => nameBySlug.get(slug))
          .filter(Boolean)
          .join(', ') || 'Nothing',
      tier: (record.free_override || 'inherit') as TrickTier,
      effectivelyFree: trick ? isTrickFree(trick) : record.diff <= FREE_MAX_DIFF,
      isLive: record.is_live,
      about: record.about,
      tips: record.tips,
    };
  });

  return <TricksScreen rows={rows} defaultFreeTier={TIERS_LABEL[FREE_MAX_DIFF - 1] ?? ''} />;
}
