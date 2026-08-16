import type { ReactNode } from 'react';

import { AppShell } from '@/components/shell/AppShell';

/**
 * Where the signed-in screens go.
 *
 * The route group has no pages of its own yet — Home is T8, Tricks is T7, and
 * so on. It exists now so that landing one is only ever a `page.tsx`: put the
 * file under `app/(app)/`, add its path to the matching entry in
 * `components/shell/nav.ts`, and it arrives inside the shell with the top bar,
 * the bottom bar, the footer, the sport switch and the toast and modal hosts
 * already around it.
 *
 * The rider is not wired up. `AppShell` takes one; T6 is what has one to give,
 * and until then the top bar shows a Sign in button in its place.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
