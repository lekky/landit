import { Panel, Tag } from '@landit/ui-web';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { ROUTES } from '@/lib/routes';
import { requireStaff } from '@/lib/staff';

import { signOutAction } from '../../(auth)/actions';

import { AdminTabs } from './AdminTabs';

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
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const staff = await requireStaff();

  return (
    <div className={styles.portal}>
      <Panel className={styles.header}>
        <Tag color="var(--violet)">Staff</Tag>
        <div className={styles.who}>
          <div className="d" style={{ fontSize: 26 }}>
            Admin portal
          </div>
          <div className="lab" style={{ color: '#C9C2B4', marginTop: 4 }}>
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
          <form action={signOutAction}>
            <button type="submit" className="btn sm" style={{ background: 'var(--violet)' }}>
              Sign out
            </button>
          </form>
        </div>
      </Panel>

      <AdminTabs />

      {children}

      <p className={styles.footnote}>
        Every change made here is written to the audit log against your account, and takes effect
        for the rider immediately.
      </p>
    </div>
  );
}
