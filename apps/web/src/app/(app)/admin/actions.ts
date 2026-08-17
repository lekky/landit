'use server';

import { LANDED_STAGES, STAGE, type StageId } from '@landit/core';
import {
  getRider,
  listTrickProgress,
  listTricks,
  records,
  setRiderPlan,
  setRiderSuspended,
  type UsersPlan,
} from '@landit/db';
import { revalidatePath } from 'next/cache';

import { monthYear, relativeTime } from '@/lib/dates';
import { ROUTES } from '@/lib/routes';
import { SPORT_LOOKS } from '@/lib/sports';
import { requireStaff } from '@/lib/staff';

import type { RiderSheetView, TrackedTrickView } from './view';

/**
 * Every staff write the portal makes (plan §7, T16).
 *
 * Three things are true of all of them, and they are the pattern T17 inherits:
 *
 * 1. **The gate runs again, here.** `layout.tsx` guards a render; a server
 *    action is a separate POST that no render has to precede. A rider who
 *    reads the action id out of the page bundle can call it directly, and the
 *    layout would never have run. `requireStaff` is cheap and this is the
 *    boundary that matters.
 * 2. **The write goes through the superuser client**, because `users.role`,
 *    `plan` and `suspended` are refused to every request-authenticated caller
 *    by `guardUserWrite` — including a staff rider's own token. That refusal is
 *    the point: staff hold a role, not a credential.
 * 3. **The audit row is not this file's business to remember.**
 *    `applyStaffChange` writes it, so an action cannot ship without one by
 *    forgetting a line.
 *
 * They return a result rather than throwing, because the screen shows a toast
 * either way and an unhandled action error in Next is a blank error boundary
 * over the whole portal.
 */

export type StaffWriteResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

/**
 * One rider's sheet, read when it is opened.
 *
 * A read, not a write, so it logs nothing — the audit log records what staff
 * *changed*, and a row for every sheet anybody glanced at would bury the
 * changes it exists to preserve. (Whether staff reads of a child's account
 * should themselves be logged is a real question and a policy one, not a
 * session's to answer: issue filed.)
 *
 * Returns `null` rather than throwing when the rider is gone, so a stale table
 * row opens an empty sheet instead of an error boundary over the portal.
 */
export async function riderSheetAction(userId: string): Promise<RiderSheetView | null> {
  const staff = await requireStaff();
  const pb = staff.superuser;

  const rider = await getRider(pb, userId).catch(() => null);
  if (!rider) return null;

  const [tricks, progress, clips, plans] = await Promise.all([
    listTricks(pb, { includeHidden: true }),
    listTrickProgress(pb, userId),
    records(pb, 'clips').page({ filter: 'user = {:u}', params: { u: userId }, perPage: 1 }),
    records(pb, 'plans').list(),
  ]);

  const trickById = new Map(tricks.map((t) => [t.id, t]));
  const landedStages = new Set<string>(LANDED_STAGES);

  const tracked: TrackedTrickView[] = progress
    .map((row): TrackedTrickView | null => {
      // A progress row whose trick has been deleted is dropped rather than
      // rendered nameless — T17 can delete tricks, and the rows survive it.
      const trick = trickById.get(row.trick);
      if (!trick) return null;
      const stage = STAGE[row.stage as StageId];
      return {
        id: row.id,
        name: trick.name,
        sport: SPORT_LOOKS[trick.sport] ?? null,
        stage: stage?.short ?? row.stage,
        stageColor: stage?.color ?? 'var(--ink-3)',
        landed: landedStages.has(row.stage),
      };
    })
    .filter((x) => x !== null)
    // Landed first, then alphabetically: a staff member opening a sheet is
    // looking for what this rider can do, not for the order they logged it in.
    .sort((a, b) => Number(b.landed) - Number(a.landed) || a.name.localeCompare(b.name));

  const plan = plans.find((p) => p.slug === rider.plan);
  const now = new Date().toISOString();

  return {
    id: rider.id,
    name: rider.name || rider.handle || 'Rider',
    handle: rider.handle,
    avatarKey: rider.avatar_key || null,
    joined: rider.created ? monthYear(rider.created) : '—',
    active: rider.last_ride ? relativeTime(rider.last_ride, now, rider.timezone) : 'Never',
    plan: rider.plan,
    planName: plan?.name ?? rider.plan,
    planHue: plan?.hue || 'var(--ink-3)',
    suspended: rider.suspended,
    sports: (rider.sports ?? []).map((id) => SPORT_LOOKS[id]).filter(Boolean),
    tracked,
    landed: tracked.filter((t) => t.landed).length,
    clips: clips.totalItems,
  };
}

/** Both writes revalidate both screens: the counts on Overview move too. */
function revalidateAdmin(): void {
  revalidatePath(ROUTES.admin);
  revalidatePath(ROUTES.adminRiders);
}

/**
 * Move a rider onto another plan.
 *
 * Refuses to act on the signed-in staff member's own row. The prototype allowed
 * it — "changing your own row switches the app you're signed into" — which in a
 * prototype is a convenience and here is a staff member granting themselves a
 * paid plan, in the one collection whose whole guard exists to stop exactly
 * that. Staff needing a plan changed ask another member of staff, and the log
 * then names two different people.
 */
export async function setRiderPlanAction(
  userId: string,
  plan: UsersPlan,
): Promise<StaffWriteResult> {
  const staff = await requireStaff();

  if (userId === staff.rider.id) {
    return { ok: false, message: 'Ask another member of staff to change your own plan.' };
  }

  try {
    await setRiderPlan(staff.superuser, staff.actor, userId, plan);
  } catch {
    return { ok: false, message: 'That did not save. Try again in a moment.' };
  }

  revalidateAdmin();
  return { ok: true };
}

/**
 * Suspend or restore an account.
 *
 * Also refuses the caller's own row, for a blunter reason: `users.authRule` is
 * `suspended = false`, so a staff member who suspends themselves is signed out
 * of the portal on their next request and cannot undo it. Only the superuser
 * dashboard could, which means a locked-out portal and a trip to the box.
 */
export async function setRiderSuspendedAction(
  userId: string,
  suspended: boolean,
): Promise<StaffWriteResult> {
  const staff = await requireStaff();

  if (userId === staff.rider.id) {
    return { ok: false, message: 'You cannot suspend your own account.' };
  }

  try {
    await setRiderSuspended(staff.superuser, staff.actor, userId, suspended);
  } catch {
    return { ok: false, message: 'That did not save. Try again in a moment.' };
  }

  revalidateAdmin();
  return { ok: true };
}
