import type { PayerKind, StageId, VideoVisibilityId } from '@landit/core';

import type { Client } from './clients';
import { records } from './collections';
import type {
  AnnouncementDismissalsRecord,
  ChallengeLogRecord,
  ClipsCreate,
  ClipsRecord,
  CrewInvitesCreate,
  CrewInvitesRecord,
  CrewsCreate,
  CrewsRecord,
  EventAttendanceRecord,
  RiderStickersRecord,
  SpotsRecord,
  SubscriptionsCreate,
  SubscriptionsRecord,
  SubscriptionsSource,
  SubscriptionsStatus,
  TrickLogRecord,
  TrickNotesRecord,
  TrickProgressRecord,
  UsersRecord,
} from './generated/collections';

/**
 * The writes a rider makes, with their side effects kept together.
 *
 * Two things are deliberately *not* here, and both for the same reason: they
 * are not a rider's to write.
 *
 * - **Stickers.** `rider_stickers` has `createRule: null` — the award hook
 *   creates them and nothing else can. There is no `awardSticker` in this file
 *   because there is no client path to one, which is what makes "achievements
 *   are never for sale" true rather than merely stated (plan §1, §3).
 * - **The weekly streak.** `users.streak` and the rest of the tuple are
 *   server-owned (issue #8), so "I rode today" is not a PATCH from a screen.
 *   `saveWeeklyStreak` below is the write, and it only works for a caller
 *   holding the superuser client; T8's server action is the one caller, and it
 *   runs `logWeeklyRide` from `@landit/core` to decide what to write.
 *
 * The paywall is likewise absent: `setTrickStage` does not check whether a
 * trick is paid. The hook does, on every write path including a superuser one,
 * and a check here would be a weaker second copy of it (plan §3 guarantee 3).
 * A refused write surfaces as a 403 — see `isForbidden`.
 */

/* -------------------------------------------------------------- progress -- */

export interface StageChange {
  readonly progress: TrickProgressRecord;
  /** The log row this wrote, or `null` when the stage did not actually move. */
  readonly logged: TrickLogRecord | null;
}

/**
 * Set a rider's stage on a trick, and log it.
 *
 * `trick_progress` is the current stage; `trick_log` is the history the dates
 * and the stats are derived from (plan §3, "log semantics, reconciled"). Both
 * have to move together, and re-setting the stage a rider is already on writes
 * nothing — otherwise a rider tapping the same stage twice would log two
 * landings and inflate their own history.
 *
 * PocketBase has no transactions across two HTTP calls. The order is chosen so
 * the failure mode is harmless: progress first, then the log. A log row without
 * progress would be history for a stage the rider is not on; progress without a
 * log row is simply a landing whose date we do not know, which the UI already
 * handles because backfilled dates are a normal case.
 */
export async function setTrickStage(
  client: Client,
  input: { userId: string; trickId: string; stage: StageId; at?: Date },
): Promise<StageChange> {
  const { userId, trickId, stage } = input;
  const at = input.at ?? new Date();

  const existing = await records(client, 'trick_progress').first(
    'user = {:user} && trick = {:trick}',
    { user: userId, trick: trickId },
  );

  if (existing?.stage === stage) {
    return { progress: existing, logged: null };
  }

  const progress = existing
    ? await records(client, 'trick_progress').update(existing.id, { stage })
    : await records(client, 'trick_progress').create({ user: userId, trick: trickId, stage });

  const logged = await records(client, 'trick_log').create({
    user: userId,
    trick: trickId,
    stage,
    at: at.toISOString(),
  });

  return { progress, logged };
}

/**
 * Stop tracking a trick entirely.
 *
 * The log rows stay. A rider who untracks a trick has not un-landed it, and
 * deleting the history would silently rewrite every stat derived from it — if
 * they want the history gone they delete the log rows, which they may.
 */
export async function clearTrickStage(
  client: Client,
  userId: string,
  trickId: string,
): Promise<void> {
  const existing = await records(client, 'trick_progress').first(
    'user = {:user} && trick = {:trick}',
    { user: userId, trick: trickId },
  );
  if (existing) await records(client, 'trick_progress').remove(existing.id);
}

/** Delete one log row. Every derived date recomputes from what remains. */
export async function deleteLogEntry(client: Client, logId: string): Promise<void> {
  await records(client, 'trick_log').remove(logId);
}

/* ----------------------------------------------------------------- notes -- */

/** A rider's private notebook on one trick. One row per rider per trick. */
export async function saveTrickNote(
  client: Client,
  input: { userId: string; trickId: string; body: string },
): Promise<TrickNotesRecord> {
  const existing = await records(client, 'trick_notes').first(
    'user = {:user} && trick = {:trick}',
    { user: input.userId, trick: input.trickId },
  );

  return existing
    ? records(client, 'trick_notes').update(existing.id, { body: input.body })
    : records(client, 'trick_notes').create({
        user: input.userId,
        trick: input.trickId,
        body: input.body,
      });
}

/* ----------------------------------------------------------- video links -- */

/**
 * Add a video link (T15b, plan §6.6).
 *
 * **`link` is sent raw and on purpose.** The rider's pasted text goes to the
 * server as it is, and `pocketbase/hooks/45_video_links.pb.js` parses it and
 * stores the eleven-character id — so the value in the database has been through
 * the boundary rather than through a browser. Pre-parsing here with
 * `parseYouTubeVideoId` would look tidier and would move the decision to the
 * client, which is exactly where guarantee 2 says it must not live. The web app
 * does call the parser, but only to tell a rider their link is wrong before they
 * wait for a round trip.
 *
 * Three refusals can come back, all of them the hook's: the link is not a
 * YouTube link (400), the plan's allowance is full (403), or the account is
 * waiting on a guardian (403). `isForbidden` and the caller's copy translate
 * them; none of them is checked here.
 *
 * **`userId` is sent and then overwritten, which is not redundant.** The `clips`
 * create rule is evaluated against the submitted body, so a body naming another
 * rider is refused there (`user = @request.auth.id`) — and
 * `45_video_links.pb.js` sets `user` from the token anyway, so a body that lies
 * cannot land even on a path where the rule did not catch it. Same shape as
 * `attendEvent` and `saveTrickNote`: the caller states whose row it is, and the
 * server does not take its word for it. `at` is the server's alone.
 */
export async function addVideoLink(
  client: Client,
  input: {
    userId: string;
    /** Whatever the rider pasted. Parsed server-side; never trusted here. */
    link: string;
    /** The trick it hangs off, or omitted for one added outside a trick. */
    trickId?: string;
    visibility?: VideoVisibilityId;
  },
): Promise<ClipsRecord> {
  return records(client, 'clips').create({
    user: input.userId,
    video_id: input.link,
    ...(input.trickId ? { trick: input.trickId } : {}),
    // Absent means private: the hook writes `private` for anything that is not
    // exactly `members`, so omitting this is the default rather than a gap.
    visibility: input.visibility ?? 'private',
  } as ClipsCreate);
}

/**
 * Change who can see one video — the only thing about an existing link that
 * moves (owner's decision, 2026-08-17).
 *
 * The hook freezes `video_id`, `user` and `trick` on update, so this cannot
 * become a way to swap the video behind a row. Note what this function does
 * *not* promise: setting `members` does not make a video visible to other
 * riders on its own. Profile privacy is a ceiling — a `members` video on a
 * `private` profile stays invisible to everyone but its owner, and that is the
 * `clips` view rule's decision, not this call's.
 */
export async function setVideoLinkVisibility(
  client: Client,
  videoLinkId: string,
  visibility: VideoVisibilityId,
): Promise<ClipsRecord> {
  return records(client, 'clips').update(videoLinkId, { visibility });
}

/** Remove a video link. The video itself is on YouTube and is untouched. */
export async function removeVideoLink(client: Client, videoLinkId: string): Promise<void> {
  await records(client, 'clips').remove(videoLinkId);
}

/* --------------------------------------------------------------- profile -- */

/**
 * The profile fields a rider owns.
 *
 * The type is narrowed on purpose. `plan`, `role`, `consent_state`,
 * `suspended`, the age fields and the whole streak tuple are all refused by the
 * guard hook, so offering them here would only produce a 403 at runtime — this
 * way it does not compile.
 */
export type ProfileEdit = Partial<
  Pick<
    UsersRecord,
    | 'name'
    | 'handle'
    | 'town'
    | 'stance'
    | 'level'
    | 'goal'
    | 'goal_custom'
    | 'avatar_key'
    | 'privacy'
    | 'sports'
    | 'timezone'
    | 'onboarded'
  >
>;

export async function updateProfile(
  client: Client,
  userId: string,
  edit: ProfileEdit,
): Promise<UsersRecord> {
  return records(client, 'users').update(userId, edit);
}

/**
 * Turn the progress insights panel on or off for this rider (plan §2.4, §6.4).
 *
 * Deliberately not part of `ProfileEdit`: this is a consent to profiling, not a
 * profile detail, and the two should never be carried by the same form or the
 * same call. Off is always accepted; on is refused with a 403 unless the
 * rider's plan record carries the entitlement — the hook decides that, reading
 * our own `plans` record, and nothing here re-checks it (plan §3).
 */
export async function setInsightsOptIn(
  client: Client,
  userId: string,
  optedIn: boolean,
): Promise<UsersRecord> {
  return records(client, 'users').update(userId, { insights_opt_in: optedIn });
}

/* ------------------------------------------------------------ challenges -- */

/** Log one entry against a challenge. Progress is the count of these rows. */
export async function logChallengeEntry(
  client: Client,
  input: { userId: string; challengeId: string; at?: Date },
): Promise<ChallengeLogRecord> {
  return records(client, 'challenge_log').create({
    user: input.userId,
    challenge: input.challengeId,
    at: (input.at ?? new Date()).toISOString(),
  });
}

/* ----------------------------------------------------------------- spots -- */

/**
 * Submit a spot. It arrives `pending` and reaches nobody until a human
 * approves it (plan §6.1) — the status is pinned here so a caller cannot ask
 * for `live`, and the API rules refuse it anyway.
 */
export async function submitSpot(
  client: Client,
  input: {
    userId: string;
    name: string;
    town?: string;
    type?: string;
    lat?: number;
    lng?: number;
    sports?: readonly SpotsRecord['sports'][number][];
    tags?: readonly string[];
  },
): Promise<SpotsRecord> {
  return records(client, 'spots').create({
    name: input.name,
    town: input.town ?? '',
    type: input.type ?? '',
    ...(input.lat === undefined ? {} : { lat: input.lat }),
    ...(input.lng === undefined ? {} : { lng: input.lng }),
    ...(input.sports ? { sports: [...input.sports] } : {}),
    ...(input.tags ? { tags: [...input.tags] } : {}),
    status: 'pending',
    submitted_by: input.userId,
  });
}

/* ---------------------------------------------------------------- events -- */

export async function attendEvent(
  client: Client,
  userId: string,
  eventId: string,
): Promise<EventAttendanceRecord> {
  return records(client, 'event_attendance').create({ user: userId, event: eventId });
}

export async function unattendEvent(
  client: Client,
  userId: string,
  eventId: string,
): Promise<void> {
  const existing = await records(client, 'event_attendance').first(
    'user = {:user} && event = {:event}',
    { user: userId, event: eventId },
  );
  if (existing) await records(client, 'event_attendance').remove(existing.id);
}

/* --------------------------------------------------------- announcements -- */

/**
 * "Got it" on a staff announcement. Idempotent: a second tap, or a second tab,
 * finds the row already there rather than tripping the unique index.
 */
export async function dismissAnnouncement(
  client: Client,
  userId: string,
  announcementId: string,
): Promise<AnnouncementDismissalsRecord> {
  const existing = await records(client, 'announcement_dismissals').first(
    'user = {:user} && announcement = {:announcement}',
    { user: userId, announcement: announcementId },
  );
  if (existing) return existing;

  return records(client, 'announcement_dismissals').create({
    user: userId,
    announcement: announcementId,
  });
}

/* ---------------------------------------------------------- the streak ---- */

/** The five stored fields of `WeeklyStreakState`, as they sit on `users`. */
export interface WeeklyStreakWrite {
  readonly streak: number;
  readonly week_start: string;
  readonly rides_this_week: number;
  readonly last_qualifying_week: string;
  readonly last_ride: string;
}

/**
 * Write a rider's weekly streak.
 *
 * **Requires a privileged client.** The whole tuple is frozen against every
 * client write by `guardUserWrite` (issue #8): a streak a rider can PATCH is a
 * sticker a rider can forge, in a product whose plan says achievements are
 * never for sale. Handing this a rider's own client gets a 403, which is the
 * system working.
 *
 * It takes a already-computed result rather than computing one, because this
 * package holds no rules: `logWeeklyRide` in `@landit/core` decides what the
 * numbers are and T8's server action puts the two together.
 */
export async function saveWeeklyStreak(
  client: Client,
  userId: string,
  state: WeeklyStreakWrite,
): Promise<UsersRecord> {
  return records(client, 'users').update(userId, {
    streak: state.streak,
    week_start: state.week_start,
    rides_this_week: state.rides_this_week,
    last_qualifying_week: state.last_qualifying_week,
    last_ride: state.last_ride,
  });
}

/* --------------------------------------------------------------- stickers -- */

/**
 * Mark an earned sticker announced, so it is never announced again (plan §3).
 *
 * This is the *whole* of a rider's write access to `rider_stickers`:
 * `createRule` and `deleteRule` are both `null`, and `30_stickers.pb.js`
 * rejects an update that moves `user`, `sticker` or `earned_at`. So a rider can
 * dismiss their own toast and can do nothing else — which is what keeps
 * "achievements are earned, never sent" true at the data layer rather than in
 * the client (plan §1, §3).
 */
export async function markStickerSeen(
  client: Client,
  riderStickerId: string,
  at: Date = new Date(),
): Promise<RiderStickersRecord> {
  return records(client, 'rider_stickers').update(riderStickerId, {
    seen_at: at.toISOString(),
  });
}
/* --------------------------------------------------------------- crews ---- */

/**
 * Start a crew.
 *
 * The body carries a name and nothing else. `owner`, `slug` and the owner's own
 * membership are all the server's — `hooks/60_ownership.pb.js` and
 * `hooks/85_crews.pb.js` between them — because a client that could choose a
 * slug could squat every readable name, and a client that could choose an owner
 * could put a crew in somebody else's account.
 *
 * A rider held behind the guardian-consent gate is refused here with a 403
 * (plan §3 guarantee 4), and so is a rider already running the maximum number
 * of crews.
 */
export async function createCrew(client: Client, name: string): Promise<CrewsRecord> {
  // `slug` and `owner` are required columns and are deliberately absent from
  // this body: the create hook fills both before validation runs, so a client
  // that sent them would only be overridden. The cast is what says that on
  // purpose rather than by omission.
  return records(client, 'crews').create({ name: name.trim() } as CrewsCreate);
}

/**
 * Mint an invite code for a crew you are in.
 *
 * The code is **not** an argument. It is generated on the server from a
 * deliberately unguessable alphabet, because an invite code is the only thing
 * between a stranger and a crew of children (plan §6.1) — a code a client could
 * choose is a code a rider could make guessable, and the prototype's
 * name-derived code was exactly that.
 */
export async function createCrewInvite(client: Client, crewId: string): Promise<CrewInvitesRecord> {
  // Same shape as `createCrew`: `code` is required and is the hook's, never the
  // body's.
  return records(client, 'crew_invites').create({ crew: crewId } as CrewInvitesCreate);
}

/** Retire an invite. Only the crew's owner may, per the collection rule. */
export async function deleteCrewInvite(client: Client, inviteId: string): Promise<void> {
  await records(client, 'crew_invites').remove(inviteId);
}

/**
 * Redeem an invite code — the **only** way into a crew.
 *
 * `crew_members.createRule` is `null`, so this route is not a convenience over
 * a collection write; it is the single door, and it is server-side because the
 * code, the expiry, the use count and the consent gate all have to be checked
 * where a client cannot reach them (plan §3, §6.1).
 *
 * `joined: false` means the rider was already in that crew. That is a success,
 * not an error: a mate who taps the same link twice should land on the crew.
 */
export async function joinCrew(
  client: Client,
  code: string,
): Promise<{ crew: string; joined: boolean }> {
  return client.send('/api/landit/crews/join', {
    method: 'POST',
    body: { code },
  });
}

/**
 * Leave a crew.
 *
 * The membership row is the rider's own to delete (`deleteRule: user =
 * @request.auth.id`), which is the point: getting out never needs anybody's
 * permission, where getting in always needs a code.
 */
export async function leaveCrew(client: Client, membershipId: string): Promise<void> {
  await records(client, 'crew_members').remove(membershipId);
}

/* --------------------------------------------------------- subscriptions -- */

/**
 * T15's block. One function, and it is **not a rider's write**: `subscriptions`
 * has no create, update or delete rule at all, so the only caller is server
 * code holding the superuser client — the Stripe webhook.
 *
 * It is here rather than in the route so that the write has one shape wherever
 * it is made, and so the route stays what it should be: signature check,
 * translate, hand over.
 */

export interface SubscriptionWrite {
  /** The Land It rider this entitles. From the Checkout session's metadata. */
  readonly userId: string;
  /** A `plans` record id — never a slug, and never a Stripe price id. */
  readonly planId: string;
  readonly source: SubscriptionsSource;
  readonly status: SubscriptionsStatus;
  /** The provider's subscription id. The idempotency key on redelivery. */
  readonly externalId: string;
  /** The Checkout Session id, for matching the first event to its session. */
  readonly checkoutRef?: string;
  /** When the paid-up period ends, ISO. Empty while unknown. */
  readonly periodEnd?: string;
  readonly payerKind: PayerKind;
  /** Whether the payer confirmed they are 18 or over (plan §6.2). */
  readonly payerAdultConfirmed: boolean;
}

/**
 * File what the provider said, and let the hook decide what it means.
 *
 * **Idempotent by `external_id`.** Stripe retries any event it does not get a
 * 2xx for and will deliver the same one more than once by design; without a key
 * to match on, a redelivered `checkout.session.completed` is a second
 * subscription row for the same subscription. A partial unique index on the
 * column backs this up at the database, so the race between two deliveries
 * arriving at once fails loudly rather than quietly duplicating.
 *
 * **It grants nothing.** `users.plan` is not touched here. The hook resolves it
 * from these rows after the write succeeds (plan §2.4), which is what keeps the
 * entitlement a function of our own database rather than of whichever provider
 * spoke last — and what will let Apple and Google arrive as two more `source`
 * values instead of two more places the answer lives.
 *
 * **It is not the authorisation either.** Consent, the 18+ confirmation and the
 * under-16 guardian rule are all refused by
 * `pocketbase/hooks/55_subscriptions.pb.js` at the model layer, so a forged
 * event that got past the signature check still cannot grant a plan. A `403`
 * out of this function is that working.
 */
export async function upsertSubscription(
  client: Client,
  input: SubscriptionWrite,
): Promise<SubscriptionsRecord> {
  const body = {
    user: input.userId,
    plan: input.planId,
    source: input.source,
    status: input.status,
    external_id: input.externalId,
    checkout_ref: input.checkoutRef ?? '',
    period_end: input.periodEnd ?? '',
    payer_kind: input.payerKind,
    payer_adult_confirmed: input.payerAdultConfirmed,
  } satisfies SubscriptionsCreate;

  const existing = input.externalId
    ? await records(client, 'subscriptions').first('external_id = {:id}', { id: input.externalId })
    : null;

  if (existing) return records(client, 'subscriptions').update(existing.id, body);
  return records(client, 'subscriptions').create(body);
}
