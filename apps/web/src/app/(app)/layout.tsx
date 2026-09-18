import { type SportId, rodeToday } from '@landit/core';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';

import { AppShell } from '@/components/shell/AppShell';
import { loadWhatsNewLines } from '@/components/whats-new/load';
import { VerifyEmailBanner } from '@/components/verify/VerifyEmailBanner';
import { currentRider } from '@/lib/session';
import { sessionsEnabledFor } from '@/lib/sessionsPreview';
import { isStaff } from '@/lib/staff';
import { VERIFY_DISMISSED_COOKIE } from '@/lib/verify';

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
 * T6 wired up the rider. Every screen in this group gets the top bar's sport
 * chip, Log button, bell and avatar filled in without asking for them, and a
 * signed-out visitor gets the Sign in button instead — the page itself decides
 * whether being signed out is allowed, which for `/account` means a redirect.
 *
 * **The streak chip is gone** (D9, Rachid, 2026-09-16, in chat), and with it
 * the reconciliation this layout used to do for it: the bar showed a
 * `currentWeeklyStreak` computed here rather than the stored number, because a
 * stored streak is only as fresh as the last write. That reconciliation still
 * happens — on Home, where the streak card owns it (`home/page.tsx`) — and the
 * chip it fed never showed below 520px anyway.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await currentRider();
  const rider = session?.rider;

  /**
   * The confirm-your-email reminder, decided here rather than in the banner.
   *
   * Nothing in this product gates on `verified` — the banner explains why
   * confirming is worth doing and does not stop a rider doing anything. Reading
   * the dismissal cookie on the server keeps a bar the rider put away last week
   * out of the tree entirely, rather than rendering it and taking it back on
   * hydration.
   */
  const dismissedVerifyBanner = (await cookies()).has(VERIFY_DISMISSED_COOKIE);
  const showVerifyBanner = Boolean(
    rider && !rider.verified && rider.email && !dismissedVerifyBanner,
  );

  /**
   * The bell's unread count (T47, rethink §3.1 and §3.6).
   *
   * Here because the bar is on every screen and the count has to be right on
   * every screen — a badge computed on `/whats-new` alone would be a badge
   * nobody ever sees. The read is windowed and fired in one batch, it is
   * memoised for the request so a `/whats-new` render does not pay for it
   * twice, and it fails soft: a feed that will not load answers zero rather
   * than taking down the library.
   *
   * It is *not* the panel. The panel's crew tabs are a read per crew and are
   * fetched when the panel opens, which is the trade T45's sport menu already
   * made for the same reason (`components/whats-new/load.ts`).
   */
  const { unread } = rider ? await loadWhatsNewLines() : { unread: 0 };

  return (
    <AppShell
      rider={
        rider
          ? {
              name: rider.name || 'Rider',
              avatarId: rider.avatar_key || undefined,
              /*
               * The account menu's admin entry, decided here because this is
               * the last place that holds the rider record — the menu itself is
               * a client component and is never handed one. `isStaff` rather
               * than `requireStaff`: this decides whether a link is drawn, not
               * whether a page renders, and the page's own gate is unchanged.
               */
              staff: isStaff(rider),
            }
          : undefined
      }
      riderId={rider?.id}
      sports={rider?.sports?.length ? (rider.sports as SportId[]) : undefined}
      /*
       * Decided here for the same reason `staff` is, two lines up: this is the
       * last place holding the rider record, and both bars are client
       * components that are never handed one. It decides what the bar *draws*;
       * each `/progress/sessions` route still asks the gate itself.
       */
      sessionsEnabled={rider ? sessionsEnabledFor(rider) : false}
      /*
       * Whether today's ride is already counted, for the Log sheet's first row
       * (owner, 2026-09-17: "i rode today should be disabled somehow if they
       * already logged today?").
       *
       * Decided here with the other two, and for the same reason: the bars are
       * client components and never see a rider record. `rodeToday` is the
       * rule `packages/core` already owns — the same one Home's streak card
       * asks — in the rider's own timezone, so a ride at 11pm is today's and a
       * rider who travels does not lose a day.
       */
      rodeToday={rider ? rodeToday(rider.last_ride || null, { timezone: rider.timezone }) : false}
      unread={unread}
    >
      {showVerifyBanner ? <VerifyEmailBanner email={rider!.email} /> : null}
      {children}
    </AppShell>
  );
}
