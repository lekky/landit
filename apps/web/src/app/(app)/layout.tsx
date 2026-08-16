import type { SportId } from '@landit/core';
import type { ReactNode } from 'react';

import { AppShell } from '@/components/shell/AppShell';
import { currentRider } from '@/lib/session';

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
 * T6 wired up the rider. Every screen in this group gets the top bar's streak
 * chip and avatar filled in without asking for them, and a signed-out visitor
 * gets the Sign in button instead — the page itself decides whether being
 * signed out is allowed, which for `/account` means a redirect.
 *
 * The streak shown here is the **stored** one, which may be stale: the weekly
 * streak is recomputed from the rider's week on read (`currentWeeklyStreak`),
 * and T8 owns doing that. A new rider's is zero either way.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await currentRider();
  const rider = session?.rider;

  return (
    <AppShell
      rider={
        rider
          ? {
              name: rider.name || 'Rider',
              avatarId: rider.avatar_key || undefined,
              streak: rider.streak ?? 0,
            }
          : undefined
      }
      sports={rider?.sports?.length ? (rider.sports as SportId[]) : undefined}
    >
      {children}
    </AppShell>
  );
}
