import { reportCounts, spotCounts, suggestionCounts } from '@landit/db';
import { Panel, Tag } from '@landit/ui-web';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

import { ROUTES } from '@/lib/routes';
import { requireStaff } from '@/lib/staff';

import { AdminNav, type AdminQueueCounts } from './AdminNav';

import { SignOutForm } from '@/components/SignOutForm';

import styles from './admin.module.css';

/**
 * The staff portal's frame (plan §7, T16; `landit-admin.jsx`).
 *
 * **The gate is here, and it is the only reason this file is a layout.** Next
 * runs a layout before the pages beneath it, so putting `requireStaff` here
 * covers every screen in the subtree including the ones T17 has not written —
 * a tab added later is gated by existing rather than by remembering. It is not
 * the *only* check: every server action re-checks, because a layout guards a
 * render and an action is a separate request that no render has to precede.
 *
 * T16 shipped with no screenshot to check against — 25, 26 and 27 in the pack
 * are byte-identical copies of `06-home.png` — so `landit-admin.jsx` was the
 * whole spec. Real captures have since been supplied and the three screens
 * match them; issue #95 tracks getting the files into the pack. Check the
 * numbered captures once they are there, not the prototype alone.
 */
/**
 * The metadata deliberately lives on the **pages**, not here.
 *
 * A layout's `metadata` is resolved before the layout runs, so a `title` on
 * this file was still applied to the response after `requireStaff` had called
 * `notFound()` — an ordinary rider who typed `/admin` got the 404 page with
 * "Staff portal · Land The Trick" in the tab. That is the exact fact the 404 exists to
 * withhold, handed over by the browser chrome. Found by signing in as a rider
 * and looking; nothing about the rendered page was wrong.
 */
/**
 * How much is waiting in each of the three queues, for the nav badges.
 *
 * Three requests, each `perPage: 1` and read for its `totalItems` — the same
 * shape the filter counts have always used, and they run in parallel, so the
 * layout waits on one round trip rather than three. Only the *actionable*
 * status of each queue is counted: open reports, spots still waiting, ideas
 * nobody has read. A badge counting dismissed reports would be a number that
 * never goes down, which is a number staff stop seeing.
 *
 * **A failure here must not take the portal down.** A count is a convenience on
 * a nav; every screen behind it works without one. So a rejected read drops
 * that badge rather than throwing — `AdminQueueCounts` is partial precisely so
 * "we could not count" has somewhere to land that is not a wrong zero.
 */
async function queueCounts(pb: Awaited<ReturnType<typeof requireStaff>>['superuser']) {
  const [reports, spots, suggestions] = await Promise.allSettled([
    reportCounts(pb, ['open']),
    spotCounts(pb, ['pending']),
    suggestionCounts(pb, ['new']),
  ]);

  const counts: Partial<Record<keyof AdminQueueCounts, number>> = {};
  if (reports.status === 'fulfilled') counts.reports = reports.value.open ?? 0;
  if (spots.status === 'fulfilled') counts.spots = spots.value.pending ?? 0;
  if (suggestions.status === 'fulfilled') counts.suggestions = suggestions.value.new ?? 0;
  return counts;
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const staff = await requireStaff();
  const counts = await queueCounts(staff.superuser);

  return (
    <div className={styles.portal}>
      <Panel className={styles.header}>
        <Tag color="var(--violet)">Staff</Tag>
        <div className={styles.who}>
          <div className="d" style={{ fontSize: 26 }}>
            Admin portal
          </div>
          <div className="lab" style={{ color: 'var(--ink-soft)', marginTop: 4 }}>
            {staff.rider.name || staff.rider.handle} · @{staff.rider.handle}
          </div>
        </div>
        <div className={styles.headerActions}>
          <Link href={ROUTES.dashboard} className="btn sm ghost">
            Back to the app
          </Link>
          {/*
           * The design's violet Sign out, doing what the word says (owner's
           * call, 2026-08-17). In the prototype it cleared a passcode session
           * that only the portal had; with a role gate there is no portal
           * session to end, so the only honest reading of the button is the
           * whole account — the same `signOutAction` the account screen uses.
           * "Back to the app" beside it is the non-destructive way out, which is
           * why both are here rather than one.
           */}
          <SignOutForm where="admin">
            {/*
              Violet is one of the two accents that carries paper rather than
              ink (5.45:1 against 3.42:1), so this button opts out of the
              primitive's default foreground rather than inheriting it.
            */}
            <button
              type="submit"
              className="btn sm"
              style={{ background: 'var(--violet)', '--btn-fg': 'var(--on-dark)' } as CSSProperties}
            >
              Sign out
            </button>
          </SignOutForm>
        </div>
      </Panel>

      <div className={styles.body}>
        <AdminNav counts={counts} />
        {children}
      </div>

      <p className={styles.footnote}>
        Every change made here is written to the audit log against your account, and takes effect
        for the rider immediately.
      </p>
    </div>
  );
}
