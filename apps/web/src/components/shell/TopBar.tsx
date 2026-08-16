'use client';

import { Avatar, Button, Icon } from '@landit/ui-web';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Wordmark } from '@/components/site/Wordmark';
import { AUTH_ROUTES_LIVE, ROUTES } from '@/lib/routes';

import { TOP_NAV, isNavActive } from './nav';

/**
 * The sticky ink top bar: mark, nav, streak chip and avatar (`landit-app.jsx`).
 *
 * Below 860px `.nav` is hidden by the design system and `MobileNav` takes over.
 * Below 520px the streak chip goes too, which is also the stylesheet's call,
 * not this component's.
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
        <Wordmark href={ROUTES.home} />

        <nav className="nav" aria-label="Main">
          {TOP_NAV.map((item) => {
            const active = isNavActive(item, pathname);
            if (!item.href) {
              // Not built yet (`lib/routes.ts`). Shown so the bar keeps its
              // shape, but not a link and not a focus stop.
              return (
                <span key={item.id} aria-disabled="true">
                  {item.label}
                </span>
              );
            }
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
              <Avatar
                avatarId={rider.avatarId}
                name={rider.name}
                size={34}
                ringWidth={2.5}
                ring="var(--paper)"
                title={rider.name}
              />
            </>
          ) : (
            // T6 turns this into a link to /signin and deletes AUTH_ROUTES_LIVE.
            <Button variant="ghost" size="sm" disabled={!AUTH_ROUTES_LIVE}>
              Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
