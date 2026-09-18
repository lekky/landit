import { Button } from '@landit/ui-web';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { SignOutForm } from '@/components/SignOutForm';
import { ROUTES, legalHref } from '@/lib/routes';
import { sessionsEnabledFor } from '@/lib/sessionsPreview';
import { isStaff } from '@/lib/staff';

import { AccountShell } from '../AccountShell';
import { SettingsList } from '../SettingsList';
import { accountSession } from '../load';
import { settingsRowsFor } from '../rows';

import styles from '../account.module.css';

/**
 * The account's list, around every one of its screens (rethink §3.9, T51).
 *
 * **A route group rather than `account/layout.tsx`**, so that `/account/close`
 * is left exactly as it was. Closing an account is a page a rider goes to on
 * purpose, with its own back link and its own shape (2026-09-12, owner in
 * chat), and wrapping it in a settings list beside it would be this task
 * quietly redesigning the one screen it was told not to touch. `(settings)`
 * contributes nothing to the URL, so the seven screens keep their addresses.
 *
 * **It does not redirect.** Every page inside it calls `requireAccountRider`,
 * which does — and a layout that redirected as well would be two redirects
 * racing to answer the same request, with the one that happened to win
 * deciding whether a rider is sent back to the screen they asked for. With no
 * rider this renders the children bare and the page underneath answers.
 */
export default async function AccountSettingsLayout({ children }: { children: ReactNode }) {
  const session = await accountSession();
  if (!session?.rider.onboarded) return <>{children}</>;

  const rider = session.rider;
  const rows = settingsRowsFor(rider, { sessionsEnabled: sessionsEnabledFor(rider) });

  return (
    <AccountShell
      list={<SettingsList rows={rows} />}
      /*
        Not settings, and drawn at `/account` only — `AccountShell` decides,
        because on a phone they have to come after the rows and on a desktop
        they must not come at all on a sub-screen (review S2).
      */
      tail={
        <>
          {/*
            The staff portal's one door (issue #118), unchanged in what it does
            and moved to the foot of the list rather than into a row of its own.
            It is not a setting about this rider — it is everybody else's data —
            and the account menu carries it too for the handful of accounts that
            have one. `isStaff` is still the same predicate `requireStaff` gates
            the portal with, so a link cannot appear for somebody it would 404.
          */}
          {isStaff(rider) && (
            <div className={`panel flat ${styles.aside}`}>
              <div className="lab">Staff</div>
              <div className={styles.asideLinks}>
                <Link className="btn sm ghost" href={ROUTES.admin}>
                  Open the staff portal
                </Link>
              </div>
              <p className={`cond ${styles.handle}`} style={{ marginTop: 10 }}>
                Riders, the trick library, the spot queue and moderation. Everything you change
                there is logged against your account.
              </p>
            </div>
          )}

          <div className={`panel flat ${styles.aside}`}>
            <div className="lab">Still on its way</div>
            <ul className={styles.laterList}>
              <li>Changing your name or your handle</li>
            </ul>
            <p className={`cond ${styles.handle}`} style={{ marginTop: 10 }}>
              Everything you log now is kept and will be there when they land.
            </p>
          </div>

          <div className={styles.signOut}>
            <SignOutForm where="account">
              <Button type="submit" variant="ghost">
                Sign out
              </Button>
            </SignOutForm>
            <span className="cond" style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
              <Link href={legalHref('privacy')}>What we keep</Link> ·{' '}
              <Link href={legalHref('safeguarding')}>Safeguarding</Link>
            </span>
          </div>
        </>
      }
    >
      {children}
    </AccountShell>
  );
}
