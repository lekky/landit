'use client';

import { SPORTS } from '@landit/core';
import { Icon } from '@landit/ui-web';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type CSSProperties } from 'react';

import { Wordmark } from '@/components/site/Wordmark';
import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { ROUTES } from '@/lib/routes';
import { useSport } from '@/providers/sport';

import { AccountMenu } from './AccountMenu';
import { BellButton } from './BellButton';
import { LogSheet } from './LogSheet';
import { isNavActive, topNavFor } from './nav';
import { SportSwitchChip } from './SportSwitchChip';
import styles from './shell.module.css';

/**
 * The sticky ink top bar: wordmark, four nav groups, and the right-hand group —
 * sport chip, Log, bell, avatar (app shell rethink §3.1, D8).
 *
 * Below 860px `.nav` is hidden by the design system and `MobileNav` takes over;
 * the right-hand group stays at every width, because the sport, the bell and
 * the avatar are not navigation and have nowhere else to be. Log is the one
 * piece that is desktop-only, since the phone has the middle cell of the bar.
 *
 * **The bottom rule takes the current sport's colour** (D5). It is a custom
 * property set here and read by `.topbar` in `additions.css`, with the old ink
 * as its fallback, so a bar rendered outside this component is unchanged. It
 * cross-fades over `--dur-ui` with the chip's own fill, which is what makes
 * switching sport read as one change to the frame rather than a repaint.
 *
 * **The streak chip is gone** (D9, 2026-09-16). It never showed below 520px,
 * the streak has a card of its own on Home, and the bar's right-hand end now
 * has four things in it where five did not fit.
 *
 * The mark goes where home is **for the person clicking it**: the dashboard
 * when somebody is signed in, the landing page when nobody is. It pointed at
 * `/` either way, which took a signed-in rider out of the app and onto the
 * sales page from the one control every screen carries.
 */

export type TopBarRider = {
  name: string;
  /** Avatar id from `@landit/ui-web`, or nothing for the initial. */
  avatarId?: string;
  /**
   * Whether this account is staff, for the account menu's admin entry only.
   *
   * Decided on the server (`isStaff`, in `app/(app)/layout.tsx`) and carried
   * here because the menu is a client component. It grants nothing: `/admin`
   * is gated by `requireStaff` on every render and re-checked in every server
   * action behind it, so a rider who sets this in their own browser gets the
   * same 404 as one who types the address.
   */
  staff?: boolean;
};

export function TopBar({
  rider,
  sessionsEnabled,
  rodeToday,
  unread,
}: {
  rider?: TopBarRider;
  /** Sessions are open to this rider, so the LOG sheet offers one (T41). */
  sessionsEnabled?: boolean;
  /** Today's ride is already counted (owner, 2026-09-17). */
  rodeToday?: boolean;
  /**
   * How much news the rider has not read yet (T47), for the bell badge.
   *
   * Decided on the server in `app/(app)/layout.tsx`, like `staff` and
   * `sessionsEnabled` above and for the same reason: this bar is a client
   * component and is never handed a rider record. It is a count of lines the
   * product wrote, not a fact about the rider.
   */
  unread?: number;
}) {
  const items = topNavFor(sessionsEnabled);
  const pathname = usePathname();
  const { sport } = useSport();
  const [logging, setLogging] = useState(false);

  return (
    <>
      <header className="topbar" style={{ '--sport-rule': SPORTS[sport].color } as CSSProperties}>
        <div className="topbar-in">
          <Wordmark href={rider ? ROUTES.dashboard : ROUTES.home} />

          <nav className="nav" aria-label="Main">
            {items.map((item) => {
              const active = isNavActive(item, pathname);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={active ? 'on' : undefined}
                  aria-current={active ? 'page' : undefined}
                  onClick={() =>
                    capture(ANALYTICS_EVENTS.navClicked, { to: item.id, where: 'top' })
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="right">
            {rider ? (
              <>
                <SportSwitchChip />
                {/* Desktop only: a phone has the middle cell of the bottom bar,
                    and two LOG controls on one screen would be two answers to
                    the same question. `.nav`'s breakpoint is the same 860px. */}
                <button
                  type="button"
                  className={`${styles.logBtn} ${styles.desktopOnly}`}
                  aria-haspopup="dialog"
                  aria-expanded={logging}
                  onClick={() => {
                    if (!logging) capture(ANALYTICS_EVENTS.logSheetOpened, { where: 'top' });
                    setLogging(!logging);
                  }}
                >
                  <Icon name="plus" size={17} strokeWidth={2.8} />
                  Log
                </button>
                <BellButton unread={unread} />
                {/* The avatar opens the destinations that are not places to
                    ride — account, coach view, plans, an idea, a report — for
                    staff the admin portal, and Sign out at the foot. */}
                <AccountMenu rider={rider} />
              </>
            ) : (
              <Link href={ROUTES.signIn} className="btn ghost sm">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Outside the bar, so the sheet is not inside `.topbar`'s stacking
          context and `.nav a` cannot reach the links inside it. */}
      {logging && (
        <LogSheet
          sessionsEnabled={sessionsEnabled}
          rodeToday={rodeToday}
          onClose={() => setLogging(false)}
        />
      )}
    </>
  );
}
