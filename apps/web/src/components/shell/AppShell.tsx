import type { SportId } from '@landit/core';
import type { ReactNode } from 'react';

import { SiteFooter } from '@/components/site/SiteFooter';
import { ModalProvider } from '@/providers/modal';
import { SportProvider } from '@/providers/sport';
import { ToastProvider } from '@/providers/toast';

import { MobileNav } from './MobileNav';
import { TopBar, type TopBarRider } from './TopBar';

/**
 * The signed-in frame: top bar, page, footer, bottom bar, and the two hosts a
 * screen needs but should not own — toasts and the modal.
 *
 * Mounted by `app/(app)/layout.tsx`, so a screen in that route group is just a
 * `page.tsx`. Nothing in here reaches for rider data: `rider` is passed in, and
 * until T6 there is nobody to pass, so the top bar shows a Sign in button where
 * the streak and avatar will go.
 *
 * The 860px breakpoint is not decided here. `.nav` hides and `.mobnav` shows in
 * the design system's stylesheet, so both are always in the DOM and there is no
 * media query in the shell to disagree with the CSS.
 */
export function AppShell({
  children,
  rider,
  sports,
}: {
  children: ReactNode;
  /** The signed-in rider, once there is one (T6). */
  rider?: TopBarRider;
  /** The sports this rider tracks. Defaults to all of them. */
  sports?: readonly SportId[];
}) {
  return (
    <SportProvider sports={sports}>
      <ToastProvider>
        <ModalProvider>
          <div className="app">
            <TopBar rider={rider} />
            <main className="page">{children}</main>
            <SiteFooter />
            <MobileNav />
          </div>
        </ModalProvider>
      </ToastProvider>
    </SportProvider>
  );
}
