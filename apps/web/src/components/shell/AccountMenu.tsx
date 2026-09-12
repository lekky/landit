'use client';

import { Avatar } from '@landit/ui-web';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { SignOutForm } from '@/components/SignOutForm';
import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { accountMenuFor } from './nav';
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
 * A staff account gets a fifth item, the admin portal, drawn in the portal's
 * own violet under a heavier keyline. Non-staff are not shown a disabled entry
 * or anything else that says a portal exists — `accountMenuFor` gives them the
 * four, and the gate that actually decides the question is `requireStaff` on
 * the server (`lib/staff.ts`), which this menu cannot weaken.
 *
 * Sign out is last, under the same heavier keyline the staff row uses, because
 * it is the one row that does something rather than going somewhere. It was
 * held back at first — on a shared phone it is one slip from an avatar tap, and
 * the account screen shows a rider what else is on it before they leave — but
 * that put the way out two taps deep on the device most riders are on, behind a
 * screen they had to open to close the app. Ordered last, keylined off the
 * destinations and reading "Sign out" rather than wearing a destructive colour,
 * it is findable without being the thing a thumb lands on (owner's call,
 * 2026-09-12, in chat). It is the same `signOutAction` the account screen and
 * the staff portal post to, through the same `SignOutForm`, so there is one
 * sign-out in the app and one `signed_out` counter behind it.
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

  const items = accountMenuFor(rider.staff);

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
          {items.map((item) => (
            <Link
              key={item.id}
              role="menuitem"
              href={item.href}
              className={item.staff ? 'accountmenu-item staff' : 'accountmenu-item'}
              onClick={() => {
                capture(ANALYTICS_EVENTS.navClicked, { to: item.id, where: 'account-menu' });
                setOpen(false);
              }}
            >
              {item.label}
            </Link>
          ))}

          {/*
            A form rather than a link, so it is a `button` inside the menu. The
            form stretches to the sheet on its own as a flex child; the row's
            own keyline and button reset live on `.accountmenu-item.signout`,
            because the `+` rule that draws the 2px rules between the links
            cannot see through the form to reach it.
          */}
          <SignOutForm where="account-menu">
            <button type="submit" role="menuitem" className="accountmenu-item signout">
              Sign out
            </button>
          </SignOutForm>
        </div>
      )}
    </div>
  );
}
