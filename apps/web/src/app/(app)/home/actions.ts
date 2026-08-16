'use server';

import {
  DEFAULT_TIMEZONE,
  currentWeeklyStreak,
  logWeeklyRide,
  weeklyEncouragement,
  weeklyProgress,
  weeklyProgressLabel,
  weeklyStreakLabel,
  type WeeklyRideResult,
} from '@landit/core';
import {
  createSuperuserClient,
  dismissAnnouncement,
  saveWeeklyStreak,
  SuperuserUnavailable,
} from '@landit/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { ROUTES } from '@/lib/routes';
import { currentRider } from '@/lib/session';

/**
 * The two writes Home makes.
 *
 * **"I rode today" is not a PATCH, and cannot be one.** The whole weekly-streak
 * tuple on `users` is frozen against every client write by `guardUserWrite`
 * (issue #8): a streak a rider can set is a sticker a rider can forge, in a
 * product whose §1 says achievements are never for sale. So the rule runs here,
 * on the server, and the result is written with the superuser client.
 *
 * **Why here and not in a PocketBase hook**, which is where plan §3 puts rule
 * enforcement and where `hooks/lib/landit.js` expected this to live: the
 * PocketBase JSVM has no `Intl`, and `Date.prototype.toLocaleString` there
 * accepts a `timeZone` option and silently ignores it — probed on 0.39.11, where
 * UTC, Europe/London, Pacific/Auckland, America/Los_Angeles and a nonsense zone
 * all returned the same wall clock. A weekly streak scored in that VM would be
 * scored in the box's timezone for every rider on earth and would look correct
 * in Coventry. Node has a real ICU, so the rule runs once, in `@landit/core`,
 * with the rider's own `users.timezone`. Recorded in plan §7, T8.
 */

export interface RodeTodayState {
  /** The card's numbers after this tap, so it does not wait for a revalidate. */
  readonly streak?: StreakPatch;
  /** True when this tap was the one that logged a ride. */
  readonly logged?: boolean;
  /** True when the rider had already logged today — one tap a day, by design. */
  readonly already?: boolean;
  readonly error?: string;
}

/** The four strings and one array the streak card draws. Mirrors `StreakView`. */
export interface StreakPatch {
  readonly headline: string;
  readonly progressLabel: string;
  readonly encouragement: string;
  readonly cells: boolean[];
  readonly spare: number;
  readonly rodeToday: boolean;
}

/** The card's view of a result, built from the same rules the page uses. */
function patchFrom(result: WeeklyRideResult, timezone: string): StreakPatch {
  const state = {
    streak: result.streak,
    lastQualifyingWeek: result.lastQualifyingWeek,
    weekStart: result.weekStart,
    ridesThisWeek: result.ridesThisWeek,
    lastRide: result.lastRide,
  };
  const progress = weeklyProgress(state, { timezone });
  return {
    headline: weeklyStreakLabel(currentWeeklyStreak(state, { timezone })),
    progressLabel: weeklyProgressLabel(progress),
    encouragement: weeklyEncouragement(progress),
    cells: Array.from({ length: progress.target }, (_, i) => i < progress.rides),
    spare: Math.max(0, progress.rides - progress.target),
    rodeToday: true,
  };
}

/**
 * "I rode today".
 *
 * A plain button: no spot is attached and no location is captured (plan §1, and
 * §6.4 Standard 10 — we store a spot's location, never a rider's). It takes no
 * arguments for the same reason.
 */
export async function rodeTodayAction(): Promise<RodeTodayState> {
  const session = await currentRider();
  if (!session) redirect(ROUTES.signIn);

  const rider = session.rider;
  const timezone = rider.timezone || DEFAULT_TIMEZONE;

  const result = logWeeklyRide(
    {
      streak: rider.streak ?? 0,
      lastQualifyingWeek: rider.last_qualifying_week || null,
      weekStart: rider.week_start || null,
      ridesThisWeek: rider.rides_this_week ?? 0,
      lastRide: rider.last_ride || null,
    },
    { timezone },
  );

  if (!result.changed) {
    return { already: true, streak: patchFrom(result, timezone) };
  }

  let superuser;
  try {
    superuser = await createSuperuserClient();
  } catch (error) {
    // Fails soft and says so. A missing credential is an operator problem, and
    // a rider should be told to try again rather than shown a stack trace.
    if (error instanceof SuperuserUnavailable) {
      return { error: 'We could not record that just now. Try again in a moment.' };
    }
    throw error;
  }

  try {
    await saveWeeklyStreak(superuser, rider.id, {
      streak: result.streak,
      week_start: result.weekStart,
      rides_this_week: result.ridesThisWeek,
      last_qualifying_week: result.lastQualifyingWeek ?? '',
      // Stored as an instant, read back through `toDayKey` with the rider's
      // zone — which is why midday and not midnight: a day key turned into a
      // datetime at 00:00 UTC is the previous day west of Greenwich.
      last_ride: `${result.lastRide} 12:00:00.000Z`,
    });
  } catch {
    return { error: 'We could not record that just now. Try again in a moment.' };
  }

  revalidatePath(ROUTES.dashboard);
  return { logged: true, streak: patchFrom(result, timezone) };
}

/**
 * "Got it" on a staff announcement.
 *
 * Written with the rider's own client: `announcement_dismissals` is theirs to
 * create, and nothing privileged is involved.
 */
export async function dismissAnnouncementAction(announcementId: string): Promise<void> {
  const session = await currentRider();
  if (!session) redirect(ROUTES.signIn);

  try {
    await dismissAnnouncement(session.client, session.rider.id, announcementId);
  } catch {
    // A dismissal that does not stick is a banner that comes back, not an error
    // worth putting in front of a rider.
    return;
  }
  revalidatePath(ROUTES.dashboard);
}
