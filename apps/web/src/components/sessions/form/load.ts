import {
  DEFAULT_TIMEZONE,
  PLAN,
  STAGE,
  clipWatchUrl,
  formatDayLong,
  formatPricePence,
  isTrickFree,
  isTrickLocked,
  sessionClipsRemaining,
  sessionQuotaResets,
  sessionVisibilityDefault,
  toDayKey,
  type PlanId,
  type SportId,
  type StageId,
  type Trick,
} from '@landit/core';
import {
  countSessionClips,
  getCrewBoard,
  getSession,
  getSessionQuota,
  getSpotsByIds,
  listCrewMemberships,
  listEvents,
  listOwnSessions,
  listPlans,
  listTrickLog,
  listTrickProgress,
  listTricks,
  records,
  sessionClipAllowanceFromRecord,
  tricksFromRecords,
  type Client,
  type EventsRecord,
  type PlansRecord,
  type UsersRecord,
} from '@landit/db';

import {
  editSessionValues,
  localDateTimeIn,
  newSessionValues,
  sessionOpenSource,
  sessionStampLabel,
  shortDayMonth,
} from '@/lib/sessionForm';
import type { NewSessionPrefill } from '@/lib/sessionRoutes';

import type { FormEvent, FormMate, FormSpot, FormTrick, SessionFormData } from './types';

/**
 * Everything the session form needs, read **with the rider's own client** —
 * the collection rules decide what comes back, exactly as they would in the
 * browser. Used by both shells (the full page and the modal over the list), so
 * the two can never open holding different things.
 *
 * Nothing here reads a position. "Where" is the rider's own recent spots or the
 * spot a link named; a nearer spot is found in the browser, on the rider's
 * press, by the Change sheet.
 */

const RECENT_SPOTS = 3;

function planRecordFor(plans: readonly PlansRecord[], slug: string): PlansRecord | null {
  return plans.find((p) => p.slug === slug) ?? null;
}

/**
 * The plan the wall sells: the first live plan, in the plans page's order, that
 * logs unlimited sessions — read from the records, so a renamed or repriced
 * plan is what the wall says, and never a plan id written into a screen.
 */
function upgradeFor(plans: readonly PlansRecord[]): SessionFormData['upgrade'] {
  const target = plans.find((p) => p.sessions_unlimited === true);
  if (!target) return null;
  const canonical = PLAN[target.slug as PlanId];
  const price =
    target.price_monthly || (canonical ? formatPricePence(canonical.priceMonthlyPence) : '');
  return price ? { name: target.name, price } : null;
}

function locked(trick: Trick, plan: string): boolean {
  // A plan slug the catalogue does not know unlocks nothing, the way the hook reads it.
  return PLAN[plan as PlanId] ? isTrickLocked(trick, plan as PlanId) : !isTrickFree(trick);
}

async function loadTricks(
  client: Client,
  rider: UsersRecord,
  keep: readonly string[],
): Promise<FormTrick[]> {
  const timezone = rider.timezone || DEFAULT_TIMEZONE;
  const [rows, progress, log] = await Promise.all([
    listTricks(client),
    listTrickProgress(client, rider.id),
    listTrickLog(client, rider.id),
  ]);
  const sports = new Set(rider.sports as SportId[]);
  const bySlug = new Map(tricksFromRecords(rows).map((t) => [t.id, t]));
  const stageOf = new Map(progress.map((p) => [p.trick, p.stage as StageId]));
  const since = new Map<string, string>();
  for (const entry of log) {
    if (!since.has(entry.trick)) since.set(entry.trick, toDayKey(entry.at, timezone));
  }
  const kept = new Set(keep);
  return rows
    .filter((row) => {
      if (kept.has(row.id)) return true;
      const trick = bySlug.get(row.slug);
      return (
        row.is_live !== false &&
        (sports.size === 0 || sports.has(row.sport as SportId)) &&
        !!trick &&
        !locked(trick, rider.plan)
      );
    })
    .map((row) => ({
      id: row.id,
      name: row.name,
      sport: row.sport as SportId,
      stage: stageOf.get(row.id) ?? null,
      sinceDay: since.get(row.id) ?? null,
    }));
}

/** Tagged-able crew-mates: the crew board already leaves out anyone private, held or suspended. */
async function loadMates(client: Client, riderId: string): Promise<FormMate[]> {
  try {
    const memberships = await listCrewMemberships(client, riderId);
    const boards = await Promise.all(memberships.map((m) => getCrewBoard(client, m.crew)));
    const mates = new Map<string, FormMate>();
    for (const board of boards) {
      for (const r of board.riders) {
        if (r.id === riderId || mates.has(r.id)) continue;
        mates.set(r.id, { id: r.id, name: r.name || r.handle, avatarKey: r.avatar_key });
      }
    }
    return [...mates.values()];
  } catch {
    // No crew board is a form without "Rode with", not a form that will not open.
    return [];
  }
}

function toFormSpot(row: {
  id: string;
  name: string;
  town: string;
  lat: number;
  lng: number;
}): FormSpot {
  return { id: row.id, name: row.name, town: row.town, lat: row.lat, lng: row.lng };
}

function toFormEvent(row: EventsRecord): FormEvent {
  return { id: row.id, name: row.name, date: row.date, lat: row.lat, lng: row.lng };
}

async function eventById(client: Client, id: string): Promise<EventsRecord | null> {
  return records(client, 'events').first('id = {:id}', { id });
}

interface Common {
  readonly client: Client;
  readonly rider: UsersRecord;
}

async function shared({ client, rider }: Common) {
  const [plans, recent, events, mates, clipsHeld] = await Promise.all([
    listPlans(client),
    listOwnSessions(client, { userId: rider.id, perPage: 30 }),
    listEvents(client),
    loadMates(client, rider.id),
    countSessionClips(client, rider.id),
  ]);
  const planRecord = planRecordFor(plans, rider.plan);
  const clipAllowance = sessionClipAllowanceFromRecord(planRecord);
  const recentSpotIds: string[] = [];
  for (const s of recent.items) {
    if (s.spotId && !recentSpotIds.includes(s.spotId)) recentSpotIds.push(s.spotId);
    if (recentSpotIds.length === RECENT_SPOTS) break;
  }
  return { plans, planRecord, clipAllowance, clipsHeld, recentSpotIds, events, mates };
}

export async function loadNewSessionForm(
  session: Common,
  prefill: NewSessionPrefill,
): Promise<SessionFormData> {
  const { client, rider } = session;
  const timezone = rider.timezone || DEFAULT_TIMEZONE;
  const now = Date.now();
  const today = toDayKey(now, timezone);

  const [base, prefillEvent] = await Promise.all([
    shared(session),
    prefill.event ? eventById(client, prefill.event) : Promise.resolve(null),
  ]);
  const [tricks, spots, quota] = await Promise.all([
    loadTricks(client, rider, prefill.trick ? [prefill.trick] : []),
    getSpotsByIds(client, [...(prefill.spot ? [prefill.spot] : []), ...base.recentSpotIds]),
    getSessionQuota(client, { userId: rider.id, plan: base.planRecord, timezone }),
  ]);

  const sports = (rider.sports ?? []) as SportId[];
  const prefillTrick = tricks.find((t) => t.id === prefill.trick);
  const impliedSport =
    (prefillEvent?.sports?.find((s) => sports.includes(s as SportId)) as SportId | undefined) ??
    prefillTrick?.sport ??
    null;

  // A link's spot or event that this rider cannot read is dropped, not trusted.
  const safePrefill: NewSessionPrefill = {
    ...prefill,
    spot: spots.some((s) => s.id === prefill.spot) ? prefill.spot : undefined,
    event: prefillEvent ? prefill.event : undefined,
    trick: prefillTrick ? prefill.trick : undefined,
  };

  const visibilityDefault = sessionVisibilityDefault(rider.session_visibility_default);
  const todaysEvents = base.events.filter((e) => e.date.slice(0, 10) === today);
  const events =
    prefillEvent && !todaysEvents.some((e) => e.id === prefillEvent.id)
      ? [...todaysEvents, prefillEvent]
      : todaysEvents;
  const recentSpotIds = base.recentSpotIds.filter((id) => spots.some((s) => s.id === id));

  return {
    mode: 'new',
    sessionId: null,
    quick: prefill.quick === true,
    source: sessionOpenSource(prefill),
    stamp: sessionStampLabel(now, timezone),
    dateTitle: '',
    today,
    timezone,
    promoted: [],
    initial: newSessionValues({
      prefill: safePrefill,
      sports,
      recentSpotId: recentSpotIds[0] ?? null,
      impliedSport,
      visibilityDefault,
      nowLocal: localDateTimeIn(now, timezone),
    }),
    // Whether the link chose the sport, which is the one case the top bar's
    // chip must not overrule in the browser (T50, `types.ts`).
    sportFromLink: Boolean(impliedSport && sports.includes(impliedSport)),
    sports: sports.length ? sports : [],
    spots: spots.map(toFormSpot),
    recentSpotIds,
    events: events.map(toFormEvent),
    tricks,
    mates: base.mates,
    plan: rider.plan,
    planName: base.planRecord?.name || PLAN[rider.plan as PlanId]?.name || 'Your plan',
    quota,
    resets: sessionQuotaResets({ timezone }),
    clip: {
      allowed: base.clipAllowance.unlimited || base.clipAllowance.cap > 0,
      remaining: sessionClipsRemaining(base.clipAllowance, base.clipsHeld),
    },
    upgrade: upgradeFor(base.plans),
    visibilityDefault,
    deleteInfo: null,
  };
}

/** `null` when there is no such session, or it is not this rider's to edit. */
export async function loadEditSessionForm(
  session: Common,
  sessionId: string,
): Promise<SessionFormData | null> {
  const { client, rider } = session;
  const detail = await getSession(client, sessionId);
  if (!detail || detail.session.userId !== rider.id) return null;
  const saved = detail.session;
  const timezone = rider.timezone || DEFAULT_TIMEZONE;
  const now = Date.now();
  const today = toDayKey(now, timezone);

  const [base, attached] = await Promise.all([
    shared(session),
    saved.eventId ? eventById(client, saved.eventId) : Promise.resolve(null),
  ]);
  const [tricks, spots] = await Promise.all([
    loadTricks(
      client,
      rider,
      saved.trickEntries.map((e) => e.trickId),
    ),
    getSpotsByIds(client, [saved.spotId, ...base.recentSpotIds]),
  ]);

  const day = toDayKey(saved.startedAt, timezone);
  const todaysEvents = base.events.filter((e) => e.date.slice(0, 10) === today);
  const events =
    attached && !todaysEvents.some((e) => e.id === attached.id)
      ? [...todaysEvents, attached]
      : todaysEvents;
  const savedSpot = spots.find((s) => s.id === saved.spotId);
  const sports = (rider.sports ?? []) as SportId[];

  return {
    mode: 'edit',
    sessionId: saved.id,
    quick: false,
    source: 'progress',
    stamp: sessionStampLabel(now, timezone),
    dateTitle: `${formatDayLong(day)} ${day.slice(0, 4)}`,
    today,
    timezone,
    promoted: saved.trickEntries
      .filter((e) => e.stageTo)
      .map((e) => ({ trickId: e.trickId, label: STAGE[e.stageTo as StageId].label })),
    initial: editSessionValues({
      session: saved,
      clipText: saved.clip ? clipWatchUrl(saved.clip) : '',
      timezone,
    }),
    // Nothing overrides a saved sport; the flag is only read in `new` mode.
    sportFromLink: false,
    // A session ridden on a sport the rider has since dropped still edits.
    sports: sports.includes(saved.sport) ? sports : [...sports, saved.sport],
    spots: spots.map(toFormSpot),
    recentSpotIds: base.recentSpotIds.filter((id) => spots.some((s) => s.id === id)),
    events: events.map(toFormEvent),
    tricks,
    mates: base.mates,
    plan: rider.plan,
    planName: base.planRecord?.name || PLAN[rider.plan as PlanId]?.name || 'Your plan',
    quota: null,
    resets: sessionQuotaResets({ timezone }),
    clip: {
      allowed: base.clipAllowance.unlimited || base.clipAllowance.cap > 0,
      remaining: sessionClipsRemaining(base.clipAllowance, base.clipsHeld),
    },
    upgrade: upgradeFor(base.plans),
    visibilityDefault: sessionVisibilityDefault(rider.session_visibility_default),
    deleteInfo: { spotName: savedSpot?.name ?? 'This spot', dateLabel: shortDayMonth(day) },
  };
}
