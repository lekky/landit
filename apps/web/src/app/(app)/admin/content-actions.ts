'use server';

import type { SportId } from '@landit/core';
import {
  applyStaffChange,
  createStaffRecord,
  deleteStaffRecord,
  records,
  refusalMessage,
  setReportTriage,
  setSpotStatus,
  type AnnouncementsAudience,
  type AnnouncementsAudiencePlan,
  type AnnouncementsAudienceSport,
  type ChallengesSport,
  type EventsKind,
  type EventsSports,
  type ReportsStatus,
  type SpotsSports,
  type SpotsStatus,
  type TricksCat,
  type TricksSport,
} from '@landit/db';
import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/lib/routes';
import { requireStaff } from '@/lib/staff';

import type { StaffWriteResult } from './actions';

/**
 * Every staff write the content tabs make (plan §7, T17).
 *
 * **The pattern is T16's and is not restated here** — read `actions.ts` for it.
 * In one line: the role gate runs again in each action because an action is a
 * POST no render has to precede, the write goes through the superuser client
 * because these collections refuse every request-authenticated caller, and the
 * audit row is `applyStaffChange`'s business rather than each function's, so a
 * write cannot ship without one by forgetting a line. This file is a second
 * file, not a second pattern: it holds the content writes because `actions.ts`
 * holds the rider ones, and both call the same three helpers in `@landit/db`.
 *
 * Two things are true of this file specifically.
 *
 * **Nothing here hard-deletes a record a rider's history points at.** `tricks`,
 * `stickers` and `events` all have dependent rows with `cascadeDelete: true` on
 * them — `trick_progress`, `trick_log`, `rider_stickers`, `event_attendance` —
 * so removing a trick from the library would silently destroy every rider's
 * progress and log for it, and removing a sticker would un-earn it for everyone
 * who holds it. The prototype's "Remove" was a `localStorage` splice and cost
 * nothing; here it costs the rider's record of their own riding. Every one of
 * those tabs hides instead (`is_live = false`), which is what "Remove" meant to
 * the person clicking it: gone from the library, gone from the wall, gone from
 * the calendar. `challenges` is the one exception and it is deliberate — see
 * `deleteChallengeAction`.
 *
 * **A refusal from PocketBase is shown, not swallowed.** These collections have
 * real constraints on them — one live challenge per sport, unique slugs, a
 * coordinate pair that is on Earth — and a staff member who hits one needs to be
 * told which. `refusalMessage` pulls the server's own sentence out; the generic
 * fallback is for the errors that carry nothing worth reading.
 */

/* ------------------------------------------------------------- plumbing -- */

/** Every admin surface, plus the rider screen a content write moves. */
function revalidateContent(...riderPaths: readonly string[]): void {
  revalidatePath(ROUTES.admin);
  for (const path of riderPaths) revalidatePath(path);
}

/**
 * What went wrong, in the server's own words where it has any.
 *
 * A staff member editing a challenge into an overlapping week gets "That week
 * overlaps …", which is the hook's sentence and the only one that names the
 * actual problem. Anything nameless gets the generic line rather than a stack
 * trace: an admin screen is not a debugger.
 */
function refusal(error: unknown, fallback: string): StaffWriteResult {
  return { ok: false, message: refusalMessage(error) ?? fallback };
}

/**
 * The empty value of a nullable `select`, which the generated types cannot name.
 *
 * Several columns here have three states and the third is "unset":
 * `tricks.free_override` is `free`, `paid`, or empty meaning "inherit from the
 * difficulty" — which is exactly how `tricksFromRecords` reads it — and an
 * announcement written for everybody has neither an `audience_plan` nor an
 * `audience_sport`. The type generator writes a select's *options* and stops,
 * so the union is the named values only, and clearing one of these columns is a
 * write PocketBase accepts and TypeScript refuses.
 *
 * One documented widening in one place beats a cast at every call site, and it
 * keeps the fact findable: issue filed to teach the generator about the empty
 * option so this can go away.
 */
function selectOrEmpty<T extends string>(value: T | ''): T {
  return value as T;
}

/**
 * A slug from a name, scoped by sport.
 *
 * Slugs are the id every rule, seed and URL keys off (`tricksFromRecords`), so
 * a staff-created record needs one and it has to be unique. The sport prefix and
 * the random tail are the prototype's own scheme, kept because the alternative —
 * a bare slugified name — collides the first time two sports have a trick with
 * the same name, which they already do.
 */
function slugFor(prefix: string, name: string): string {
  const stem =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24) || 'untitled';
  return `${prefix}-${stem}-${Math.random().toString(36).slice(2, 6)}`;
}

/* --------------------------------------------------------- trick library -- */

export interface TrickForm {
  readonly name: string;
  readonly sport: SportId;
  readonly cat: string;
  readonly diff: number;
  /** `''` means inherit from `diff` — the schema's third state (plan §2.2). */
  readonly tier: '' | 'free' | 'paid';
  readonly about: string;
  readonly tips: string;
}

/** The patch both the create and the edit build, so the two cannot drift. */
function trickPatch(form: TrickForm) {
  return {
    name: form.name.trim(),
    cat: form.cat as TricksCat,
    diff: Math.min(5, Math.max(1, Math.round(form.diff))),
    free_override: selectOrEmpty(form.tier),
    about: form.about,
    tips: form.tips,
  };
}

export async function saveTrickAction(id: string, form: TrickForm): Promise<StaffWriteResult> {
  const staff = await requireStaff();
  if (!form.name.trim()) return { ok: false, message: 'A trick needs a name.' };

  try {
    await applyStaffChange(staff.superuser, {
      actor: staff.actor,
      collection: 'tricks',
      id,
      action: 'admin.trick_edit',
      patch: trickPatch(form),
    });
  } catch (error) {
    return refusal(error, 'That did not save. Try again in a moment.');
  }

  revalidateContent(ROUTES.adminTricks, ROUTES.library);
  return { ok: true };
}

export async function createTrickAction(form: TrickForm): Promise<StaffWriteResult> {
  const staff = await requireStaff();
  if (!form.name.trim()) return { ok: false, message: 'A trick needs a name.' };

  try {
    await createStaffRecord(staff.superuser, {
      actor: staff.actor,
      collection: 'tricks',
      action: 'admin.trick_add',
      data: {
        ...trickPatch(form),
        slug: slugFor(form.sport.slice(0, 2), form.name),
        sport: form.sport as TricksSport,
        // Published live, because a staff member filling in this form is adding
        // a trick to the library rather than drafting one. Hiding it again is
        // one click on the row they just created.
        is_live: true,
      },
    });
  } catch (error) {
    return refusal(error, 'That did not save. Try again in a moment.');
  }

  revalidateContent(ROUTES.adminTricks, ROUTES.library);
  return { ok: true };
}

/**
 * Move a trick between the tiers, or back to inheriting from its difficulty.
 *
 * Writes `free_override`, which is the field the paywall hook reads through
 * `isTrickFree` — so this takes effect on the rider's next request and needs no
 * deploy, which is the whole reason the column is nullable rather than a bool.
 */
export async function setTrickTierAction(
  id: string,
  tier: '' | 'free' | 'paid',
): Promise<StaffWriteResult> {
  const staff = await requireStaff();

  try {
    await applyStaffChange(staff.superuser, {
      actor: staff.actor,
      collection: 'tricks',
      id,
      action: 'admin.trick_tier',
      patch: { free_override: selectOrEmpty(tier) },
    });
  } catch (error) {
    return refusal(error, 'That did not save. Try again in a moment.');
  }

  revalidateContent(ROUTES.adminTricks, ROUTES.library);
  return { ok: true };
}

/**
 * Take a trick out of the library, or put it back.
 *
 * This is the tab's "Remove", and it is a hide rather than a delete on purpose:
 * `trick_progress` and `trick_log` both cascade from `tricks`, so deleting a
 * trick destroys every rider's record of having landed it — silently, and with
 * no way back. `is_live = false` removes it from `listTricks` and from every
 * rider's library while the rows that say what they did survive.
 */
export async function setTrickLiveAction(id: string, isLive: boolean): Promise<StaffWriteResult> {
  const staff = await requireStaff();

  try {
    await applyStaffChange(staff.superuser, {
      actor: staff.actor,
      collection: 'tricks',
      id,
      action: isLive ? 'admin.trick_publish' : 'admin.trick_hide',
      patch: { is_live: isLive },
    });
  } catch (error) {
    return refusal(error, 'That did not save. Try again in a moment.');
  }

  revalidateContent(ROUTES.adminTricks, ROUTES.library);
  return { ok: true };
}

/* --------------------------------------------------------------- stickers -- */

export interface StickerForm {
  readonly name: string;
  readonly cond: string;
  /** `null` where the rule counts nothing — the field is not offered at all. */
  readonly threshold: number | null;
  readonly hue: string;
}

/**
 * Retune a sticker.
 *
 * The threshold is the editable half of the split plan §3 draws: the *rule* is
 * code in `@landit/core` and cannot be edited from here, the number it tests
 * against lives on the record and can. A record with no `n` has no threshold
 * field on this form, because a rule that counts nothing has nothing to tune.
 *
 * **A lowered threshold does not reach riders who already qualify until their
 * next write** (issue #103). The award hook fires on riding, not on this edit,
 * so a rider who is already past the new number gets the sticker the next time
 * they track anything. The tab says so on the screen rather than leaving staff
 * to discover it from a support ticket.
 */
export async function saveStickerAction(id: string, form: StickerForm): Promise<StaffWriteResult> {
  const staff = await requireStaff();
  if (!form.name.trim()) return { ok: false, message: 'A sticker needs a name.' };
  if (form.threshold !== null && (!Number.isFinite(form.threshold) || form.threshold < 0)) {
    return { ok: false, message: 'A threshold is a whole number, zero or more.' };
  }

  try {
    await applyStaffChange(staff.superuser, {
      actor: staff.actor,
      collection: 'stickers',
      id,
      action: 'admin.sticker_edit',
      patch: {
        name: form.name.trim(),
        cond: form.cond.trim(),
        hue: form.hue.trim(),
        ...(form.threshold !== null ? { n: Math.round(form.threshold) } : {}),
      },
    });
  } catch (error) {
    return refusal(error, 'That did not save. Try again in a moment.');
  }

  revalidateContent(ROUTES.adminStickers, ROUTES.stickers);
  return { ok: true };
}

/**
 * Show or hide a sticker.
 *
 * Hidden, never deleted: `rider_stickers` cascades from `stickers`, so deleting
 * one takes it off the wall of every rider who earned it — which is the one
 * thing this product promises not to do (plan §1, "achievements are never for
 * sale" and never taken away). Hiding stops it being awarded and stops it
 * appearing in `stickersFor`; the rows that record who earned it stay.
 */
export async function setStickerLiveAction(id: string, isLive: boolean): Promise<StaffWriteResult> {
  const staff = await requireStaff();

  try {
    await applyStaffChange(staff.superuser, {
      actor: staff.actor,
      collection: 'stickers',
      id,
      action: isLive ? 'admin.sticker_publish' : 'admin.sticker_hide',
      patch: { is_live: isLive },
    });
  } catch (error) {
    return refusal(error, 'That did not save. Try again in a moment.');
  }

  revalidateContent(ROUTES.adminStickers, ROUTES.stickers);
  return { ok: true };
}

/* ------------------------------------------------------------------ spots -- */

export interface SpotForm {
  readonly name: string;
  readonly town: string;
  readonly type: string;
  readonly tags: string;
  readonly sports: readonly string[];
  readonly lat: string;
  readonly lng: string;
}

function spotPatch(form: SpotForm) {
  const lat = Number(form.lat);
  const lng = Number(form.lng);
  return {
    name: form.name.trim(),
    town: form.town.trim(),
    type: form.type.trim(),
    tags: form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    sports: form.sports as SpotsSports[],
    ...(Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : {}),
  };
}

/** Approve, reject, or send a live spot back to the queue. */
export async function setSpotStatusAction(
  id: string,
  status: SpotsStatus,
): Promise<StaffWriteResult> {
  const staff = await requireStaff();

  try {
    await setSpotStatus(staff.superuser, staff.actor, id, status);
  } catch (error) {
    return refusal(error, 'That did not save. Try again in a moment.');
  }

  revalidateContent(ROUTES.adminSpots, ROUTES.spots);
  return { ok: true };
}

export async function saveSpotAction(id: string, form: SpotForm): Promise<StaffWriteResult> {
  const staff = await requireStaff();
  if (!form.name.trim()) return { ok: false, message: 'A spot needs a name.' };

  try {
    await applyStaffChange(staff.superuser, {
      actor: staff.actor,
      collection: 'spots',
      id,
      action: 'admin.spot_edit',
      patch: spotPatch(form),
    });
  } catch (error) {
    return refusal(error, 'That did not save. Try again in a moment.');
  }

  revalidateContent(ROUTES.adminSpots, ROUTES.spots);
  return { ok: true };
}

/**
 * Publish a spot staff found themselves.
 *
 * Straight to `live`, because the queue exists to put a human between a
 * stranger's submission and the map, and this submission came from the human.
 * `submitted_by` is deliberately left empty rather than pointed at the staff
 * member: the field means "the rider who sent this in", and filling it in would
 * put a staff account in the one column the rejection flow reads.
 */
export async function createSpotAction(form: SpotForm): Promise<StaffWriteResult> {
  const staff = await requireStaff();
  if (!form.name.trim()) return { ok: false, message: 'A spot needs a name.' };

  const lat = Number(form.lat);
  const lng = Number(form.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
    return { ok: false, message: 'A spot needs a coordinate pair to sit on the map.' };
  }

  try {
    await createStaffRecord(staff.superuser, {
      actor: staff.actor,
      collection: 'spots',
      action: 'admin.spot_add',
      data: { ...spotPatch(form), status: 'live' },
    });
  } catch (error) {
    return refusal(error, 'That did not save. Try again in a moment.');
  }

  revalidateContent(ROUTES.adminSpots, ROUTES.spots);
  return { ok: true };
}

/* ----------------------------------------------------------------- events -- */

export interface EventForm {
  readonly name: string;
  readonly kind: string;
  readonly date: string;
  readonly venue: string;
  readonly town: string;
  readonly level: string;
  readonly price: string;
  readonly spotsCopy: string;
  readonly blurb: string;
  readonly sports: readonly string[];
}

function eventPatch(form: EventForm) {
  return {
    name: form.name.trim(),
    kind: form.kind as EventsKind,
    date: form.date.trim(),
    venue: form.venue.trim(),
    town: form.town.trim(),
    level: form.level.trim(),
    price: form.price.trim(),
    spots_copy: form.spotsCopy.trim(),
    blurb: form.blurb,
    sports: form.sports as EventsSports[],
  };
}

export async function saveEventAction(id: string, form: EventForm): Promise<StaffWriteResult> {
  const staff = await requireStaff();
  if (!form.name.trim()) return { ok: false, message: 'An event needs a name.' };
  if (!form.date.trim()) return { ok: false, message: 'An event needs a date.' };

  try {
    await applyStaffChange(staff.superuser, {
      actor: staff.actor,
      collection: 'events',
      id,
      action: 'admin.event_edit',
      patch: eventPatch(form),
    });
  } catch (error) {
    return refusal(error, 'That did not save. Try again in a moment.');
  }

  revalidateContent(ROUTES.adminEvents, ROUTES.events);
  return { ok: true };
}

export async function createEventAction(form: EventForm): Promise<StaffWriteResult> {
  const staff = await requireStaff();
  if (!form.name.trim()) return { ok: false, message: 'An event needs a name.' };
  if (!form.date.trim()) return { ok: false, message: 'An event needs a date.' };

  try {
    await createStaffRecord(staff.superuser, {
      actor: staff.actor,
      collection: 'events',
      action: 'admin.event_add',
      data: { ...eventPatch(form), slug: slugFor('ev', form.name), is_live: true },
    });
  } catch (error) {
    return refusal(error, 'That did not save. Try again in a moment.');
  }

  revalidateContent(ROUTES.adminEvents, ROUTES.events);
  return { ok: true };
}

/**
 * Take an event off the calendar, or put it back.
 *
 * A hide, for the same reason as tricks and stickers: `event_attendance`
 * cascades, so deleting an event erases the "I am going" of everyone who said
 * so. A cancelled comp that riders had marked should not also erase the fact
 * they were going to it.
 */
export async function setEventLiveAction(id: string, isLive: boolean): Promise<StaffWriteResult> {
  const staff = await requireStaff();

  try {
    await applyStaffChange(staff.superuser, {
      actor: staff.actor,
      collection: 'events',
      id,
      action: isLive ? 'admin.event_publish' : 'admin.event_hide',
      patch: { is_live: isLive },
    });
  } catch (error) {
    return refusal(error, 'That did not save. Try again in a moment.');
  }

  revalidateContent(ROUTES.adminEvents, ROUTES.events);
  return { ok: true };
}

/* ------------------------------------------------------------- challenges -- */

export interface ChallengeForm {
  readonly week: string;
  readonly title: string;
  readonly blurb: string;
  readonly starts: string;
  readonly ends: string;
  readonly goal: number;
  readonly reward: string;
  readonly hue: string;
  readonly ridersCopy: string;
  readonly verb: string;
}

function challengePatch(form: ChallengeForm) {
  return {
    week: form.week.trim(),
    title: form.title.trim(),
    blurb: form.blurb,
    starts: form.starts.trim(),
    ends: form.ends.trim(),
    goal: Math.max(1, Math.round(form.goal) || 1),
    reward: form.reward.trim(),
    hue: form.hue.trim(),
    riders_copy: form.ridersCopy.trim(),
    verb: form.verb.trim(),
  };
}

/**
 * Edit a week.
 *
 * The dates are the interesting part and the server owns them:
 * `enforceNoChallengeOverlap` is a model hook, so moving a week onto another
 * week of the same sport is refused wherever the write comes from — including
 * from here. The message it throws names the challenge it clashes with, which
 * is why this action shows the server's sentence rather than its own.
 */
export async function saveChallengeAction(
  id: string,
  form: ChallengeForm,
): Promise<StaffWriteResult> {
  const staff = await requireStaff();
  if (!form.title.trim()) return { ok: false, message: 'A week needs a title.' };
  if (!form.starts.trim() || !form.ends.trim()) {
    return { ok: false, message: 'A week needs a start and an end.' };
  }

  try {
    await applyStaffChange(staff.superuser, {
      actor: staff.actor,
      collection: 'challenges',
      id,
      action: 'admin.challenge_edit',
      patch: challengePatch(form),
    });
  } catch (error) {
    return refusal(error, 'That did not save. Try again in a moment.');
  }

  revalidateContent(ROUTES.adminChallenges, ROUTES.challenge);
  return { ok: true };
}

export async function createChallengeAction(
  sport: SportId,
  form: ChallengeForm,
): Promise<StaffWriteResult> {
  const staff = await requireStaff();
  if (!form.title.trim()) return { ok: false, message: 'A week needs a title.' };
  if (!form.starts.trim() || !form.ends.trim()) {
    return { ok: false, message: 'A week needs a start and an end.' };
  }

  try {
    await createStaffRecord(staff.superuser, {
      actor: staff.actor,
      collection: 'challenges',
      action: 'admin.challenge_add',
      data: {
        ...challengePatch(form),
        slug: slugFor(sport.slice(0, 2), form.title),
        sport: sport as ChallengesSport,
      },
    });
  } catch (error) {
    return refusal(error, 'That did not save. Try again in a moment.');
  }

  revalidateContent(ROUTES.adminChallenges, ROUTES.challenge);
  return { ok: true };
}

/**
 * Delete a week — **the one hard delete in the portal**, and the reason it is
 * the exception is worth writing down.
 *
 * `challenges` has no `is_live` column and should not gain one: whether a week
 * is running is derived from its dates and never stored (plan §2.2, §3), so a
 * "hidden" challenge would be a second, contradictory answer to the question the
 * dates already answer. That leaves delete as the only way to take a scheduled
 * week back, and staff genuinely need one — a week booked in error otherwise
 * blocks the sport's calendar for its whole range, because of the overlap rule.
 *
 * `challenge_log` cascades, so this does take rider entries with it. The screen
 * counts them and says so before the confirm rather than after, because "riders
 * lose any progress logged against it" is a sentence that means nothing until it
 * has a number in it.
 */
export async function deleteChallengeAction(id: string): Promise<StaffWriteResult> {
  const staff = await requireStaff();

  try {
    await deleteStaffRecord(staff.superuser, {
      actor: staff.actor,
      collection: 'challenges',
      action: 'admin.challenge_delete',
      id,
    });
  } catch (error) {
    return refusal(error, 'That did not delete. Try again in a moment.');
  }

  revalidateContent(ROUTES.adminChallenges, ROUTES.challenge);
  return { ok: true };
}

/* ---------------------------------------------------------- announcements -- */

export interface NoticeForm {
  readonly title: string;
  readonly body: string;
  readonly label: string;
  /** `''` for everyone, a sport id, or `plan:<slug>`. */
  readonly audience: string;
  readonly hue: string;
}

/**
 * Post a banner to riders.
 *
 * The audience is one select on the form and three columns in the schema
 * (`audience`, `audience_plan`, `audience_sport`), and this is the one place
 * that knows the mapping. A notice written for "everyone" leaves both narrowing
 * columns empty rather than filling them with a default, so widening the
 * audience later cannot accidentally inherit a stale sport.
 */
export async function postNoticeAction(form: NoticeForm): Promise<StaffWriteResult> {
  const staff = await requireStaff();
  if (!form.title.trim()) return { ok: false, message: 'An announcement needs a title.' };

  const audience = form.audience;
  const plan = audience.startsWith('plan:') ? audience.slice(5) : '';
  const sport = audience && !audience.startsWith('plan:') ? audience : '';

  try {
    await createStaffRecord(staff.superuser, {
      actor: staff.actor,
      collection: 'announcements',
      action: 'admin.notice_post',
      data: {
        title: form.title.trim(),
        body: form.body.trim(),
        label: form.label.trim() || 'Land The Trick',
        hue: form.hue,
        audience: (plan ? 'plan' : sport ? 'sport' : 'all') as AnnouncementsAudience,
        audience_plan: selectOrEmpty(plan as AnnouncementsAudiencePlan | ''),
        audience_sport: selectOrEmpty(sport as AnnouncementsAudienceSport | ''),
        is_live: true,
      },
    });
  } catch (error) {
    return refusal(error, 'That did not post. Try again in a moment.');
  }

  revalidateContent(ROUTES.adminNotices, ROUTES.dashboard);
  return { ok: true };
}

/**
 * Pull an announcement, or put it back up.
 *
 * A hide rather than a delete, and here the reason is the record rather than the
 * rider: a banner that went out to every rider is a thing the product said, and
 * "we never said that" is not an answer a staff portal should be able to
 * produce. `announcement_dismissals` also cascades, so deleting one would
 * un-dismiss it for everybody if it were ever restored.
 */
export async function setNoticeLiveAction(id: string, isLive: boolean): Promise<StaffWriteResult> {
  const staff = await requireStaff();

  try {
    await applyStaffChange(staff.superuser, {
      actor: staff.actor,
      collection: 'announcements',
      id,
      action: isLive ? 'admin.notice_repost' : 'admin.notice_pull',
      patch: { is_live: isLive },
    });
  } catch (error) {
    return refusal(error, 'That did not save. Try again in a moment.');
  }

  revalidateContent(ROUTES.adminNotices, ROUTES.dashboard);
  return { ok: true };
}

/* ------------------------------------------------------------------ plans -- */

export interface PlanForm {
  readonly name: string;
  readonly priceMonthly: string;
  readonly priceYearly: string;
  readonly per: string;
  readonly pitch: string;
  /** One perk per line, as the prototype's editor had it. */
  readonly perks: string;
  readonly missing: string;
}

const lines = (text: string): string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

/**
 * Edit a plan's copy and its displayed prices.
 *
 * **Copy and pricing only**, exactly as the prototype's footnote says.
 * `unlocks_paid_tricks` is not on this form: it is the entitlement the paywall
 * hook reads, and a screen whose job is wording should not be able to hand every
 * rider the paid library by accident. `clip_cap_bytes` is not on it either, for
 * a different reason — clip hosting was reversed (PR #128) and that column
 * survives only as `listPlans`' sort key, so an editor for it would be a control
 * over a number that no longer means anything.
 *
 * The prices here are **display strings**. Stripe holds the numbers that are
 * charged, so editing this does not change anybody's bill and can disagree with
 * what checkout takes — issue #123, filed by T15 and not this session's to fix.
 * The tab says so beside the form.
 */
export async function savePlanAction(id: string, form: PlanForm): Promise<StaffWriteResult> {
  const staff = await requireStaff();
  if (!form.name.trim()) return { ok: false, message: 'A plan needs a name.' };

  try {
    await applyStaffChange(staff.superuser, {
      actor: staff.actor,
      collection: 'plans',
      id,
      action: 'admin.plan_edit',
      patch: {
        name: form.name.trim(),
        price_monthly: form.priceMonthly.trim(),
        price_yearly: form.priceYearly.trim(),
        per: form.per.trim(),
        pitch: form.pitch.trim(),
        perks: lines(form.perks),
        missing: lines(form.missing),
      },
    });
  } catch (error) {
    return refusal(error, 'That did not save. Try again in a moment.');
  }

  revalidateContent(ROUTES.adminPlans, ROUTES.plans);
  return { ok: true };
}

/* ------------------------------------------------------------- moderation -- */

/**
 * Triage a report.
 *
 * The only write the moderation queue makes, and it is deliberately the *only*
 * one: this screen decides what happened to a report, and acting on the subject
 * — suspending an account, hiding a spot — is done on the tab that owns it, by
 * a staff member who has looked at it. Wiring "actioned" to an automatic
 * suspension would put a stranger's accusation one click from a child's account.
 */
export async function setReportTriageAction(
  id: string,
  status: ReportsStatus,
  outcome: string,
): Promise<StaffWriteResult> {
  const staff = await requireStaff();

  try {
    await setReportTriage(staff.superuser, staff.actor, id, {
      status,
      outcome: outcome.trim().slice(0, 600),
    });
  } catch (error) {
    return refusal(error, 'That did not save. Try again in a moment.');
  }

  revalidateContent(ROUTES.adminModeration);
  return { ok: true };
}

/**
 * How many rider rows a challenge delete would take with it.
 *
 * Read on demand from the confirm rather than with the page: it is one count per
 * challenge and the table shows every week of every sport, so fetching them all
 * up front is a query per row to answer a question almost nobody asks.
 */
export async function challengeLogCountAction(challengeId: string): Promise<number> {
  const staff = await requireStaff();

  const page = await records(staff.superuser, 'challenge_log').page({
    filter: 'challenge = {:id}',
    params: { id: challengeId },
    perPage: 1,
  });
  return page.totalItems;
}
