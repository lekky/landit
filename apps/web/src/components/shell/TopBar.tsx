'use client';

import { Icon } from '@landit/ui-web';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Wordmark } from '@/components/site/Wordmark';
import { ROUTES } from '@/lib/routes';

import { AccountMenu } from './AccountMenu';
import { TOP_NAV, isNavActive } from './nav';

/**
 * The sticky ink top bar: mark, nav, streak chip and avatar (`landit-app.jsx`).
 *
 * Below 860px `.nav` is hidden by the design system and `MobileNav` takes over.
 * Below 520px the streak chip goes too, which is also the stylesheet's call,
 * not this component's.
 *
 * The mark goes where home is **for the person clicking it**: the dashboard
 * when somebody is signed in, the landing page when nobody is. It pointed at
 * `/` either way, which took a signed-in rider out of the app and onto the
 * sales page from the one control every screen carries. `/` redirects them
 * back now, but a link that lands where it means to beats a round trip.
 */

export type TopBarRider = {
  name: string;
  /** Avatar id from `@landit/ui-web`, or nothing for the initial. */
  avatarId?: string;
  /** Weeks in a row (plan §1) — a count, whatever the streak is counting. */
  streak: number;
};

export function TopBar({ rider }: { rider?: TopBarRider }) {
  const pathname = usePathname();

  return (
    <header className="topbar">
      <div className="topbar-in">
        <Wordmark href={rider ? ROUTES.dashboard : ROUTES.home} />

        <nav className="nav" aria-label="Main">
          {TOP_NAV.map((item) => {
            const active = isNavActive(item, pathname);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={active ? 'on' : undefined}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="right">
          {rider ? (
            <>
              <span className="streakchip" title={`${rider.streak} week streak`}>
                <Icon name="flame" size={15} fill="var(--yellow)" />
                {rider.streak}
              </span>
              {/* The avatar opens the four destinations that are not places
                  to ride — account, coach view, plans, report. On a phone this
                  is the only way to any of them that is not the site footer. */}
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
  );
}
