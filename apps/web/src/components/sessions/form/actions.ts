'use server';

import {
  DEFAULT_TIMEZONE,
  SESSION_REFUSALS,
  WEEKLY_RIDE_TARGET,
  clipWatchUrl,
  currentWeeklyStreak,
  weeklyProgress,
  type WeeklyStreakState,
} from '@landit/core';
import {
  createSuperuserClient,
  getSession,
  isNotFound,
  listPlans,
  logSession,
  refusalMessage,
  sessionClipAllowanceFromRecord,
  updateSession,
  type Client,
  type UsersRecord,
} from '@landit/db';
import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/lib/routes';
import {
  SESSION_SAVE_FAILED,
  editSessionValues,
  formProblems,
  localDateTimeIn,
  readFormValues,
  refusalField,
  refusalView,
  sessionInputFrom,
  sessionPatchFrom,
  type RefusalView,
  type SavedRide,
} from '@/lib/sessionForm';
import { SESSIONS_PATH, isRecordId } from '@/lib/sessionRoutes';
import { currentRider } from '@/lib/session';

/**
 * The session form's two writes (T38).
 *
 * Both write **with the rider's own client**, so the hook in
 * `66_sessions.pb.js` is the boundary for everything: the spot, the crew tags,
 * the clip and its allowance, the quota and the grace, the paywall on trick
 * entries. The only superuser write is `logSession`'s ride half, for the reason
 * `saveWeeklyStreak` gives (the streak tuple is server-owned).
 *
 * Both return `{ ok }` rather than throwing, and are called through
 * `runAction('session_log' | 'session_edit', …)`, so a request that never
 * reaches here comes back as a refusal too (issue #433). Analytics fires in the
 * browser, on `ok: true` only.
 */

export type SessionWriteFailed = {
  readonly ok: false;
  readonly message: string;
  /** How to show it. Absent means the plain error line. */
  readonly view?: RefusalView;
};

export type LogSessionActionResult =
  | {
      readonly ok: true;
      readonly sessionId: string;
      readonly ride: SavedRide & { readonly changed: boolean };
      readonly hasClip: boolean;
      /**
       * When the session was saved as starting, on the rider's clock. The
       * "while it's fresh" prompts reopen it for editing, and holding the
       * saved time there stops a later save moving it to that later moment.
       */
      readonly pickedAt: string;
    }
  | (SessionWriteFailed & {
      /** Whether today's ride was counted before the session was refused. */
      readonly rideCounted?: boolean;
      readonly rideChanged?: boolean;
    });

export type EditSessionActionResult = { readonly ok: true } | SessionWriteFailed;

const SIGNED_OUT = 'Sign in to log your sessions.';
const GONE = 'That session is not there any more.';

async function clipAllowed(client: Client, rider: UsersRecord): Promise<boolean> {
  const plans = await listPlans(client);
  const allowance = sessionClipAllowanceFromRecord(plans.find((p) => p.slug === rider.plan));
  return allowance.unlimited || allowance.cap > 0;
}

function problemFailure(problems: Partial<Record<string, string>>): SessionWriteFailed {
  const message = Object.values(problems)[0] ?? SESSION_SAVE_FAILED;
  const field = refusalField(message);
  return field
    ? { ok: false, message, view: { kind: 'field', field, message } }
    : { ok: false, message };
}

function streakState(rider: UsersRecord): WeeklyStreakState {
  return {
    streak: rider.streak ?? 0,
    lastQualifyingWeek: rider.last_qualifying_week || null,
    weekStart: rider.week_start || null,
    ridesThisWeek: rider.rides_this_week ?? 0,
    lastRide: rider.last_ride || null,
  };
}

function revalidate() {
  revalidatePath(SESSIONS_PATH);
  revalidatePath(ROUTES.progress);
  revalidatePath(ROUTES.dashboard);
}

/**
 * Log a new session — **through `logSession` only**, which saves the ride
 * first (D6). `useGrace` is "Save this one anyway"; the hook spends it only when
 * the month is full.
 */
export async function logSessionAction(args: {
  values: unknown;
  useGrace?: boolean;
}): Promise<LogSessionActionResult> {
  const session = await currentRider();
  if (!session) return { ok: false, message: SIGNED_OUT };
  const { client, rider } = session;
  const timezone = rider.timezone || DEFAULT_TIMEZONE;
  const now = Date.now();

  const values = readFormValues(args.values);
  if (!values) return { ok: false, message: SESSION_SAVE_FAILED };

  const allowed = await clipAllowed(client, rider);
  const clock = { now, timezone };
  const input = sessionInputFrom(values, clock, { clipAllowed: allowed });
  if (!input) return problemFailure(formProblems(values, clock, { clipAllowed: allowed }));

  let superuser: Client | null = null;
  try {
    superuser = await createSuperuserClient();
  } catch {
    // `logSession` reports the ride as failed and still attempts the session.
    superuser = null;
  }

  const result = await logSession({
    client,
    superuser,
    rider,
    input,
    useGrace: args.useGrace === true,
    now,
  });

  if (result.ride.changed) revalidatePath(ROUTES.dashboard);

  if (result.refusal || !result.session) {
    const view = result.refusal
      ? refusalView(result.refusal)
      : ({ kind: 'error', message: SESSION_SAVE_FAILED } as const);
    const message =
      view.kind === 'wall'
        ? view.grace
          ? SESSION_REFUSALS.quotaFull
          : SESSION_REFUSALS.graceUsed
        : view.message;
    return {
      ok: false,
      message,
      view,
      rideCounted: result.ride.counted,
      rideChanged: result.ride.changed,
    };
  }

  revalidate();

  const state = result.ride.result ?? streakState(rider);
  return {
    ok: true,
    sessionId: result.session.id,
    hasClip: Boolean(result.session.clip),
    pickedAt: localDateTimeIn(result.session.startedAt, timezone),
    ride: {
      counted: result.ride.counted,
      changed: result.ride.changed,
      failed: result.ride.failed,
      streak: currentWeeklyStreak(state, { timezone }),
      ridesThisWeek: weeklyProgress(state, { timezone }).rides,
      target: WEEKLY_RIDE_TARGET,
    },
  };
}

/**
 * Save changes to a session. The patch is worked out against **the session as
 * the server holds it**, not against what the browser says it opened with, so
 * only what the rider changed is written. `updateSession` never demotes a
 * stage, and nothing here tries to.
 */
export async function editSessionAction(args: {
  sessionId: string;
  values: unknown;
}): Promise<EditSessionActionResult> {
  const session = await currentRider();
  if (!session) return { ok: false, message: SIGNED_OUT };
  const { client, rider } = session;
  if (!isRecordId(args.sessionId)) return { ok: false, message: GONE };
  const timezone = rider.timezone || DEFAULT_TIMEZONE;

  const values = readFormValues(args.values);
  if (!values) return { ok: false, message: SESSION_SAVE_FAILED };

  const detail = await getSession(client, args.sessionId);
  if (!detail || detail.session.userId !== rider.id) return { ok: false, message: GONE };

  const initial = editSessionValues({
    session: detail.session,
    clipText: detail.session.clip ? clipWatchUrl(detail.session.clip) : '',
    timezone,
  });
  const clock = { now: Date.now(), timezone };
  const allowed = await clipAllowed(client, rider);
  const patch = sessionPatchFrom(values, initial, clock, { clipAllowed: allowed });
  if (!patch) {
    return problemFailure(
      formProblems(values, clock, { clipAllowed: allowed || values.clip === initial.clip }),
    );
  }

  if (Object.keys(patch).length) {
    try {
      await updateSession(client, args.sessionId, patch);
    } catch (error) {
      if (isNotFound(error)) return { ok: false, message: GONE };
      const status = (error as { status?: number })?.status;
      if (status !== 400 && status !== 403) throw error;
      const message = refusalMessage(error);
      const view = refusalView({
        kind: refusalField(message) === 'clip' ? 'clip' : 'other',
        message,
      });
      return {
        ok: false,
        message: view.kind === 'wall' ? SESSION_SAVE_FAILED : view.message,
        view,
      };
    }
  }

  revalidate();
  revalidatePath(`${SESSIONS_PATH}/${args.sessionId}`);
  return { ok: true };
}
