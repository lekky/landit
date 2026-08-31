'use client';

import { Avatar } from '@landit/ui-web';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { ACCOUNT_MENU } from './nav';
import type { TopBarRider } from './TopBar';

/**
 * The avatar, and the four destinations that are not places to ride.
 *
 * Account, Coach view, Plans and Report something are all *about* a rider
 * rather than somewhere they go, so none of them earns a cell in a five-item
 * bottom bar. Before this they were reachable on a phone only from the site
 * footer, underneath a scrolled page — `/report` included, which the OSA
 * codes' "easy to find" wording asks better of (plan §6.1). The avatar was
 * already in the top bar at every width and already meant "you"; it now opens
 * the four instead of going straight to one of them.
 *
 * Deliberately a plain menu of links and no more. There is no sign-out here:
 * signing out is a form post (`SignOutForm`) and it belongs on the account
 * screen where the rider can see what else is on it, not one slip away from an
 * avatar tap on a shared phone.
 */
export function AccountMenu({ rider }: { rider: TopBarRider }) {
  const menuId = useId();
  const holder = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  /*
   * Open, and the screen it was opened on.
   *
   * A navigation is a dismissal — Next keeps this component mounted across a
   * route change inside the app group, so a menu left open would hang over the
   * screen it just sent the rider to, including on a browser Back. Deriving
   * that from the pathname rather than closing it in an effect keeps it to one
   * render: an effect that calls `setState` on every route change is a
   * cascading render, and the lint rule that says so is right.
   */
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const setOpen = useCallback((next: boolean) => setOpenedAt(next ? pathname : null), [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    // `pointerdown` rather than `click`: a click on a link inside the menu
    // would close it here before the link's own handler ran on some browsers.
    const onPointer = (event: PointerEvent) => {
      if (!holder.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open, setOpen]);

  return (
    <div className="accountmenu" ref={holder}>
      <button
        type="button"
        className="accountmenu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label="Your account and settings"
        onClick={() => setOpen(!open)}
      >
        <Avatar
          avatarId={rider.avatarId}
          name={rider.name}
          size={34}
          ringWidth={2.5}
          ring="var(--paper)"
        />
      </button>

      {open && (
        <div className="accountmenu-sheet" id={menuId} role="menu">
          {ACCOUNT_MENU.map((item) => (
            <Link
              key={item.id}
              role="menuitem"
              href={item.href}
              className="accountmenu-item"
              onClick={() => {
                capture(ANALYTICS_EVENTS.navClicked, { to: item.id, where: 'account-menu' });
                setOpen(false);
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
