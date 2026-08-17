import type { SportId } from '@landit/core';
import type { ReactNode } from 'react';

import { OfflineBanner } from '@/components/offline/OfflineBanner';
import { ServiceWorkerRegistrar } from '@/components/offline/ServiceWorkerRegistrar';
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
 *
 * T19 hung the offline read cache here, and here specifically: this frame is the
 * product, so the service worker is registered from inside it and never from the
 * landing page, a legal document or the pre-launch holding page — which is what
 * stops a worker being installed by a build that is not serving the app yet.
 */
export function AppShell({
  children,
  rider,
  riderId,
  sports,
}: {
  children: ReactNode;
  /** The signed-in rider, once there is one (T6). */
  rider?: TopBarRider;
  /**
   * The signed-in rider's id, for the offline cache only.
   *
   * Not for display and not for a read: the worker compares it with the last one
   * it saw and empties its cache of rendered screens when it changes, which is
   * how signing out on a shared phone takes those screens with it.
   */
  riderId?: string;
  /** The sports this rider tracks. Defaults to all of them. */
  sports?: readonly SportId[];
}) {
  return (
    <SportProvider sports={sports}>
      <ToastProvider>
        <ModalProvider>
          <div className="app">
            <ServiceWorkerRegistrar rider={riderId} />
            <TopBar rider={rider} />
            <OfflineBanner />
            <main className="page">{children}</main>
            <SiteFooter />
            <MobileNav />
          </div>
        </ModalProvider>
      </ToastProvider>
    </SportProvider>
  );
}
