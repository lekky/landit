import { DEFAULT_TIMEZONE, currentWeeklyStreak, type SportId } from '@landit/core';
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
 * The streak chip shows the **reconciled** number, not the stored one. A stored
 * streak is only as fresh as the last write and nothing writes to a rider who
 * has stopped riding, so a run that ended a month ago would sit in the top bar
 * looking alive — `currentWeeklyStreak` decides that from the rider's own week
 * (T8, plan §1).
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await currentRider();
  const rider = session?.rider;

  const streak = rider
    ? currentWeeklyStreak(
        {
          streak: rider.streak ?? 0,
          lastQualifyingWeek: rider.last_qualifying_week || null,
          weekStart: rider.week_start || null,
          ridesThisWeek: rider.rides_this_week ?? 0,
          lastRide: rider.last_ride || null,
        },
        { timezone: rider.timezone || DEFAULT_TIMEZONE },
      )
    : 0;

  return (
    <AppShell
      rider={
        rider
          ? {
              name: rider.name || 'Rider',
              avatarId: rider.avatar_key || undefined,
              streak,
            }
          : undefined
      }
      riderId={rider?.id}
      sports={rider?.sports?.length ? (rider.sports as SportId[]) : undefined}
    >
      {children}
    </AppShell>
  );
}
