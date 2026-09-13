import { describe, expect, it } from 'vitest';

import { PLAN, PLANS } from '../data/plans';
import {
  DEFAULT_SESSION_VISIBILITY,
  SESSION_DURATIONS,
  SESSION_FEELS,
  SESSION_VISIBILITIES,
  SESSION_WEATHER,
} from '../data/sessions';
import type { RideSession, SessionTrickEntry } from '../types';
import {
  NO_SESSIONS,
  ROOKIE_SESSIONS_PER_MONTH,
  SESSION_QUOTA_WARN_AT,
  SESSION_REFUSALS,
  SHREDDER_SESSION_CLIP_CAP,
  adjacentSessions,
  canAddSessionClip,
  filterSessions,
  groupSessionsByMonth,
  isStageMoveUp,
  landedStageAfter,
  monthKeyOf,
  nextMonthStart,
  normaliseSessionVisibility,
  plausibleMonthKeys,
  riderMonthKey,
  riderProfileVisibleTo,
  sessionAllowance,
  sessionChangeLabel,
  sessionChanges,
  sessionClipAllowance,
  sessionClipAllowanceLabel,
  sessionClipsRemaining,
  sessionCountsAsRideToday,
  sessionCreateDecision,
  sessionDurationLabel,
  sessionFeelColor,
  sessionFeelLabel,
  sessionHours,
  sessionMonthSummary,
  sessionProblems,
  sessionQuotaLine,
  sessionQuotaPips,
  sessionQuotaResets,
  sessionQuotaStatus,
  sessionStagePromotion,
  sessionTimeLabel,
  sessionVisibilityDefault,
  sessionVisibilityLabel,
  sessionVisibleTo,
  sessionWeatherLabel,
  sessionsPerMonthLabel,
  sortSessionsNewestFirst,
  spotSessionSummary,
  stageMoveLabel,
  stagesAbove,
  topSpots,
  trickSessionSummary,
  type SessionAudience,
} from './sessions';

let nextId = 0;
function session(overrides: Partial<RideSession> = {}): RideSession {
  nextId += 1;
  return {
    id: `s${String(nextId).padStart(3, '0')}`,
    userId: 'u1',
    startedAt: '2026-09-12T15:00:00.000Z',
    durationMinutes: 60,
    sport: 'scooter',
    spotId: 'spot-a',
    feel: 'good',
    crewIds: [],
    visibility: 'private',
    trickEntries: [],
    monthKey: '2026-09',
    graceUsed: false,
    created: '2026-09-12T17:00:00.000Z',
    ...overrides,
  };
}

/* ------------------------------------------------------------ visibility -- */

describe('normaliseSessionVisibility (D2)', () => {
  it('keeps the three ids and reads anything else as private', () => {
    expect(normaliseSessionVisibility('public')).toBe('public');
    expect(normaliseSessionVisibility('members')).toBe('members');
    expect(normaliseSessionVisibility('private')).toBe('private');
    for (const bad of ['', 'PUBLIC', ' public', 'crew', null, undefined, 1, {}]) {
      expect(normaliseSessionVisibility(bad)).toBe('private');
    }
  });

  it('defaults new sessions to private, the value itself', () => {
    expect(DEFAULT_SESSION_VISIBILITY).toBe('private');
    expect(sessionVisibilityDefault('')).toBe('private');
    expect(sessionVisibilityDefault(undefined)).toBe('private');
    expect(sessionVisibilityDefault('members')).toBe('members');
    expect(sessionVisibilityDefault('nonsense')).toBe('private');
  });

  it('labels the ids the way the design does, not the way the profile does', () => {
    expect(SESSION_VISIBILITIES.map((v) => v.label)).toEqual(['Public', 'Crew', 'Only me']);
    expect(sessionVisibilityLabel('members')).toBe('Crew');
    expect(sessionVisibilityLabel('garbage')).toBe('Only me');
  });
});

describe('sessionVisibleTo — the stricter of session and profile wins (G1, G4)', () => {
  const base: SessionAudience = {
    visibility: 'public',
    ownerId: 'owner',
    ownerPrivacy: 'public',
    ownerConsentLimited: false,
    ownerSuspended: false,
    viewerId: 'viewer',
    viewerConsentLimited: false,
    sharesCrew: false,
  };
  const see = (patch: Partial<SessionAudience>) => sessionVisibleTo({ ...base, ...patch });

  it('always shows a rider their own session, whatever the settings', () => {
    for (const visibility of ['public', 'members', 'private']) {
      for (const ownerPrivacy of ['public', 'members', 'private']) {
        expect(
          see({ viewerId: 'owner', visibility, ownerPrivacy, ownerConsentLimited: true }),
        ).toBe(true);
      }
    }
  });

  it('runs the full matrix for a signed-in stranger, a crew-mate and a signed-out visitor', () => {
    const matrix: [string, string, boolean, boolean, boolean][] = [
      // visibility, privacy, stranger, crew-mate, signed out
      ['public', 'public', true, true, true],
      ['public', 'members', true, true, false],
      ['public', 'private', false, false, false],
      ['members', 'public', false, true, false],
      ['members', 'members', false, true, false],
      ['members', 'private', false, false, false],
      ['private', 'public', false, false, false],
      ['private', 'members', false, false, false],
      ['private', 'private', false, false, false],
    ];
    for (const [visibility, ownerPrivacy, stranger, mate, guest] of matrix) {
      const at = `${visibility} session on a ${ownerPrivacy} profile`;
      expect(see({ visibility, ownerPrivacy }), `${at}, stranger`).toBe(stranger);
      expect(see({ visibility, ownerPrivacy, sharesCrew: true }), `${at}, crew-mate`).toBe(mate);
      expect(see({ visibility, ownerPrivacy, viewerId: null }), `${at}, signed out`).toBe(guest);
    }
  });

  it('shows a consent-limited or suspended owner to nobody, and a limited viewer nothing', () => {
    expect(see({ ownerConsentLimited: true })).toBe(false);
    expect(see({ ownerSuspended: true })).toBe(false);
    expect(see({ ownerConsentLimited: true, viewerId: null })).toBe(false);
    expect(see({ viewerConsentLimited: true })).toBe(false);
    expect(see({ viewerConsentLimited: true, visibility: 'members', sharesCrew: true })).toBe(
      false,
    );
  });

  it('fails closed on a value it does not recognise, on either side', () => {
    expect(see({ visibility: 'everyone', viewerId: null })).toBe(false);
    expect(see({ ownerPrivacy: '' })).toBe(false);
  });
});

describe('riderProfileVisibleTo — who may be named in "rode with" (D3)', () => {
  const base = {
    riderId: 'mate',
    riderPrivacy: 'members',
    riderConsentLimited: false,
    riderSuspended: false,
    viewerId: 'viewer',
    viewerConsentLimited: false,
  };
  it('mirrors the users view rule', () => {
    expect(riderProfileVisibleTo(base)).toBe(true);
    expect(riderProfileVisibleTo({ ...base, viewerId: null })).toBe(false);
    expect(riderProfileVisibleTo({ ...base, riderPrivacy: 'public', viewerId: null })).toBe(true);
    expect(riderProfileVisibleTo({ ...base, riderPrivacy: 'private' })).toBe(false);
    expect(riderProfileVisibleTo({ ...base, riderPrivacy: 'private', viewerId: 'mate' })).toBe(
      true,
    );
    expect(riderProfileVisibleTo({ ...base, riderSuspended: true })).toBe(false);
    expect(riderProfileVisibleTo({ ...base, riderConsentLimited: true })).toBe(false);
    expect(riderProfileVisibleTo({ ...base, viewerConsentLimited: true })).toBe(false);
  });
});

/* ----------------------------------------------------------- the quota --- */

describe('the monthly allowance (D6)', () => {
  it('is the owner’s four on Rookie, warned at three, and unlimited on the paid plans', () => {
    expect(ROOKIE_SESSIONS_PER_MONTH).toBe(4);
    expect(SESSION_QUOTA_WARN_AT).toBe(3);
    expect(sessionAllowance(PLAN.rookie)).toEqual({ cap: 4, unlimited: false });
    expect(sessionAllowance(PLAN.shredder).unlimited).toBe(true);
    expect(sessionAllowance(PLAN.legend).unlimited).toBe(true);
  });

  it('fails closed on a missing plan or a plan without the fields', () => {
    expect(sessionAllowance(null)).toEqual(NO_SESSIONS);
    const { sessionMonthCap: _cap, sessionsUnlimited: _u, ...bare } = PLAN.shredder;
    expect(sessionAllowance(bare)).toEqual({ cap: 0, unlimited: false });
    expect(sessionAllowance({ ...PLAN.rookie, sessionMonthCap: -3 })).toEqual(NO_SESSIONS);
    expect(sessionAllowance({ ...PLAN.rookie, sessionMonthCap: Number.NaN })).toEqual(NO_SESSIONS);
  });

  it('walks a Rookie month: open, open, warn at the third, full at the fourth', () => {
    const rookie = sessionAllowance(PLAN.rookie);
    const at = (used: number, graceUsed = false) =>
      sessionQuotaStatus(rookie, { usedThisMonth: used, graceUsed });

    expect(at(0).state).toBe('open');
    expect(at(2).state).toBe('open');
    expect(at(SESSION_QUOTA_WARN_AT).state).toBe('warn');
    expect(at(3).remaining).toBe(1);
    expect(at(3).canLog).toBe(true);

    const full = at(4);
    expect(full.state).toBe('full');
    expect(full.canLog).toBe(false);
    expect(full.canLogWithGrace).toBe(true);
    expect(at(4, true).canLogWithGrace).toBe(false);
    expect(at(9).remaining).toBe(0);
  });

  it('refuses the fifth unless the rider asks for the grace, and only once', () => {
    const rookie = sessionAllowance(PLAN.rookie);
    const full = sessionQuotaStatus(rookie, { usedThisMonth: 4, graceUsed: false });
    const spent = sessionQuotaStatus(rookie, { usedThisMonth: 4, graceUsed: true });
    const room = sessionQuotaStatus(rookie, { usedThisMonth: 1, graceUsed: false });

    expect(sessionCreateDecision(full, false)).toBe('refuse');
    expect(sessionCreateDecision(full, true)).toBe('grace');
    expect(sessionCreateDecision(spent, true)).toBe('refuse');
    // Asking for the grace with room to spare never spends it.
    expect(sessionCreateDecision(room, true)).toBe('allow');
  });

  it('never caps an unlimited plan', () => {
    const status = sessionQuotaStatus(
      { cap: 0, unlimited: true },
      { usedThisMonth: 500, graceUsed: false },
    );
    expect(status).toMatchObject({ state: 'unlimited', canLog: true, cap: null, remaining: null });
    expect(sessionCreateDecision(status, false)).toBe('allow');
    expect(sessionQuotaPips(status)).toEqual([]);
  });

  it('says the quota in words and pips', () => {
    const rookie = sessionAllowance(PLAN.rookie);
    const at = (used: number) =>
      sessionQuotaStatus(rookie, { usedThisMonth: used, graceUsed: false });
    expect(sessionQuotaLine(at(3))).toBe('One left this month');
    expect(sessionQuotaLine(at(1))).toBe('Three left this month');
    expect(sessionQuotaLine(at(4))).toBe('That is four this month');
    expect(
      sessionQuotaLine(
        sessionQuotaStatus({ cap: 0, unlimited: true }, { usedThisMonth: 0, graceUsed: false }),
      ),
    ).toBe('Unlimited sessions');
    expect(sessionQuotaPips(at(3))).toEqual(['used', 'used', 'used', 'free']);
    expect(sessionsPerMonthLabel(sessionAllowance(PLAN.rookie))).toBe('Four a month');
    expect(sessionsPerMonthLabel(sessionAllowance(PLAN.legend))).toBe('Unlimited');
    expect(sessionsPerMonthLabel(NO_SESSIONS)).toBe('None');
  });
});

describe('the month, on the rider’s clock', () => {
  it('turns over at midnight where the rider is, not in UTC', () => {
    // 23:30 UTC on 30 September is already October in Auckland and still
    // September in Los Angeles.
    const now = Date.parse('2026-09-30T23:30:00Z');
    expect(riderMonthKey({ now, timezone: 'Pacific/Auckland' })).toBe('2026-10');
    expect(riderMonthKey({ now, timezone: 'America/Los_Angeles' })).toBe('2026-09');
    expect(riderMonthKey({ now, timezone: '' })).toBe('2026-10'); // Europe/London, BST
    expect(monthKeyOf('2026-01-31T23:30:00Z', 'Europe/London')).toBe('2026-01');
  });

  it('names the reset day and counts down to it', () => {
    expect(nextMonthStart('2026-09')).toBe('2026-10-01');
    expect(nextMonthStart('2026-12')).toBe('2027-01-01');
    const reset = sessionQuotaResets({
      now: Date.parse('2026-09-13T10:00:00Z'),
      timezone: 'Europe/London',
    });
    expect(reset).toEqual({ on: '2026-10-01', label: '1 October', daysAway: 18 });
  });

  it('accepts only month keys that are "now" in some timezone', () => {
    const mid = Date.parse('2026-09-15T12:00:00Z');
    expect(plausibleMonthKeys(mid)).toEqual(['2026-09']);
    const turn = Date.parse('2026-09-30T20:00:00Z');
    expect(plausibleMonthKeys(turn)).toEqual(['2026-09', '2026-10']);
    const early = Date.parse('2026-10-01T05:00:00Z');
    expect(plausibleMonthKeys(early)).toEqual(['2026-09', '2026-10']);
  });
});

/* ----------------------------------------------------------- clips ------- */

describe('the session clip allowance (D5) — separate from trick video links', () => {
  it('is none on Rookie, the tunable default on Shredder and unlimited on Legend', () => {
    expect(sessionClipAllowance(PLAN.rookie)).toEqual({ cap: 0, unlimited: false });
    expect(sessionClipAllowance(PLAN.shredder)).toEqual({
      cap: SHREDDER_SESSION_CLIP_CAP,
      unlimited: false,
    });
    expect(sessionClipAllowance(PLAN.legend).unlimited).toBe(true);
    expect(sessionClipAllowance(undefined)).toEqual({ cap: 0, unlimited: false });
  });

  it('reads its own two fields, never the video link ones', () => {
    const plan = { ...PLAN.legend, sessionClipCap: 2, sessionClipsUnlimited: false };
    expect(sessionClipAllowance(plan)).toEqual({ cap: 2, unlimited: false });
  });

  it('counts, and says what is left', () => {
    const shredder = sessionClipAllowance(PLAN.shredder);
    expect(canAddSessionClip(shredder, SHREDDER_SESSION_CLIP_CAP - 1)).toBe(true);
    expect(canAddSessionClip(shredder, SHREDDER_SESSION_CLIP_CAP)).toBe(false);
    expect(canAddSessionClip(sessionClipAllowance(PLAN.rookie), 0)).toBe(false);
    expect(sessionClipsRemaining(shredder, 3)).toBe(SHREDDER_SESSION_CLIP_CAP - 3);
    expect(sessionClipsRemaining(sessionClipAllowance(PLAN.legend), 99)).toBeNull();
    expect(sessionClipAllowanceLabel(shredder)).toBe(`${SHREDDER_SESSION_CLIP_CAP} clip links`);
    expect(sessionClipAllowanceLabel({ cap: 1, unlimited: false })).toBe('1 clip link');
    expect(sessionClipAllowanceLabel(sessionClipAllowance(PLAN.rookie))).toBe('No clip links');
  });

  it('is on every plan record', () => {
    for (const plan of PLANS) {
      expect(typeof plan.sessionMonthCap, plan.id).toBe('number');
      expect(typeof plan.sessionClipCap, plan.id).toBe('number');
    }
  });
});

/* ----------------------------------------------------- stage promotion --- */

describe('one-way stage promotion', () => {
  it('moves one landed step up, floored at Sometimes, and nowhere from Every time', () => {
    expect(landedStageAfter(null)).toBe('some');
    expect(landedStageAfter(undefined)).toBe('some');
    expect(landedStageAfter('want')).toBe('some');
    expect(landedStageAfter('trying')).toBe('some');
    expect(landedStageAfter('some')).toBe('most');
    expect(landedStageAfter('most')).toBe('every');
    expect(landedStageAfter('every')).toBeNull();
  });

  it('promotes a landed entry once, and never again however often it is saved', () => {
    expect(
      sessionStagePromotion({ landed: true, alreadyPromoted: false, current: 'some' }),
    ).toEqual({
      stageFrom: 'some',
      stageTo: 'most',
    });
    expect(sessionStagePromotion({ landed: true, alreadyPromoted: false, current: null })).toEqual({
      stageFrom: null,
      stageTo: 'some',
    });
    expect(
      sessionStagePromotion({ landed: true, alreadyPromoted: true, current: 'most' }),
    ).toBeNull();
    expect(
      sessionStagePromotion({ landed: false, alreadyPromoted: false, current: 'some' }),
    ).toBeNull();
    expect(
      sessionStagePromotion({ landed: true, alreadyPromoted: false, current: 'every' }),
    ).toBeNull();
  });

  it('offers every stage above the one a trick is on, and none at Every time', () => {
    expect(stagesAbove(null)).toEqual(['want', 'trying', 'some', 'most', 'every']);
    expect(stagesAbove('want')).toEqual(['trying', 'some', 'most', 'every']);
    expect(stagesAbove('trying')).toEqual(['some', 'most', 'every']);
    expect(stagesAbove('most')).toEqual(['every']);
    expect(stagesAbove('every')).toEqual([]);
  });

  it('moves a trick only up the ladder, never sideways or back', () => {
    expect(isStageMoveUp('trying', 'most')).toBe(true);
    expect(isStageMoveUp('trying', 'trying')).toBe(false);
    expect(isStageMoveUp('most', 'some')).toBe(false);
    expect(isStageMoveUp('every', 'every')).toBe(false);
    expect(isStageMoveUp('trying', null)).toBe(false);
    expect(isStageMoveUp(null, 'want')).toBe(true);
  });

  it('honours a picked stage, including a jump of more than one step', () => {
    // The reason the picker exists: Learning straight to Most times, which the
    // old tickbox could not express.
    expect(
      sessionStagePromotion({
        landed: true,
        alreadyPromoted: false,
        current: 'trying',
        stagePick: 'most',
      }),
    ).toEqual({ stageFrom: 'trying', stageTo: 'most' });

    // A pick is enough on its own: "Want to learn" to "Learning" is a move
    // nobody would call a landing.
    expect(
      sessionStagePromotion({
        landed: false,
        alreadyPromoted: false,
        current: 'want',
        stagePick: 'trying',
      }),
    ).toEqual({ stageFrom: 'want', stageTo: 'trying' });
  });

  it('ignores a pick that is stale, equal or below, and falls back to the landing', () => {
    // The trick moved on since the form drew its picker. The landing still
    // counts; the stale pick simply does not.
    expect(
      sessionStagePromotion({
        landed: true,
        alreadyPromoted: false,
        current: 'most',
        stagePick: 'some',
      }),
    ).toEqual({ stageFrom: 'most', stageTo: 'every' });

    // With no landing behind it, a stale pick moves nothing at all.
    expect(
      sessionStagePromotion({
        landed: false,
        alreadyPromoted: false,
        current: 'most',
        stagePick: 'some',
      }),
    ).toBeNull();

    // Once is still once, whatever the pick says.
    expect(
      sessionStagePromotion({
        landed: false,
        alreadyPromoted: true,
        current: 'trying',
        stagePick: 'every',
      }),
    ).toBeNull();
  });

  it('labels the move for the lime half of a pill', () => {
    const moved: SessionTrickEntry = {
      trickId: 't',
      landed: true,
      stageFrom: 'some',
      stageTo: 'most',
    };
    expect(stageMoveLabel(moved)).toBe('→ Most times');
    expect(stageMoveLabel({ trickId: 't', landed: false })).toBe('');
  });
});

/* ------------------------------------------------------------- the ride -- */

describe('a session is today’s ride only when it is on the rider’s today', () => {
  const clock = { now: Date.parse('2026-09-13T08:00:00Z'), timezone: 'Europe/London' };
  it('counts a session started this morning', () => {
    expect(sessionCountsAsRideToday('2026-09-13T07:00:00Z', clock)).toBe(true);
  });
  it('does not count one backfilled to yesterday', () => {
    expect(sessionCountsAsRideToday('2026-09-12T18:00:00Z', clock)).toBe(false);
  });
  it('uses the rider’s zone: 23:30 UTC is already tomorrow in Auckland', () => {
    const auckland = { now: Date.parse('2026-09-13T23:30:00Z'), timezone: 'Pacific/Auckland' };
    expect(sessionCountsAsRideToday('2026-09-13T23:00:00Z', auckland)).toBe(true);
  });
});

/* ------------------------------------------------------------ the form --- */

describe('sessionProblems', () => {
  const now = Date.parse('2026-09-13T12:00:00Z');
  const good = {
    startedAt: '2026-09-13T11:00:00Z',
    durationMinutes: 60,
    sport: 'scooter',
    spotId: 'spot-a',
    feel: 'sent',
  };

  it('passes a complete draft', () => {
    expect(sessionProblems(good, now)).toEqual({});
    expect(
      sessionProblems({ ...good, weather: 'rain', clip: 'https://youtu.be/dQw4w9WgXcQ' }, now),
    ).toEqual({});
  });

  it('lets a session be saved without saying how it felt', () => {
    // Optional since 2026-09-13 (Rachid, in chat): the ride is the thing worth
    // keeping, and a rider is not made to rate it before they can keep it.
    expect(sessionProblems({ ...good, feel: null }, now)).toEqual({});
    expect(sessionProblems({ ...good, feel: undefined }, now)).toEqual({});
    expect(sessionProblems({ ...good, feel: '' }, now)).toEqual({});
    // A value that is not one of the five is still wrong, and still says so.
    expect(sessionProblems({ ...good, feel: 'meh' }, now).feel).toBe(SESSION_REFUSALS.feel);
  });

  it('names each missing or malformed field in the shared words', () => {
    const problems = sessionProblems(
      {
        startedAt: '',
        durationMinutes: 45,
        sport: 'rollerblade',
        spotId: '',
        feel: 'meh',
        weather: 'hail',
        aim: 'x'.repeat(121),
        notes: 'x'.repeat(2001),
        crewIds: Array.from({ length: 11 }, (_, i) => `c${i}`),
        clip: 'https://vm.tiktok.com/ZMabc/',
        trickIds: Array.from({ length: 21 }, (_, i) => `t${i}`),
      },
      now,
    );
    expect(problems).toEqual({
      startedAt: SESSION_REFUSALS.startedAt,
      durationMinutes: SESSION_REFUSALS.durationMinutes,
      sport: SESSION_REFUSALS.sport,
      spotId: SESSION_REFUSALS.spotId,
      feel: SESSION_REFUSALS.feel,
      weather: SESSION_REFUSALS.weather,
      aim: SESSION_REFUSALS.aim,
      notes: SESSION_REFUSALS.notes,
      crewIds: SESSION_REFUSALS.crewIds,
      clip: SESSION_REFUSALS.clipShortlink,
      tricks: SESSION_REFUSALS.tricks,
    });
  });

  it('refuses a start more than an hour ahead of the clock', () => {
    expect(sessionProblems({ ...good, startedAt: '2026-09-13T12:50:00Z' }, now)).toEqual({});
    expect(sessionProblems({ ...good, startedAt: '2026-09-13T14:00:00Z' }, now).startedAt).toBe(
      SESSION_REFUSALS.future,
    );
  });

  it('never tells a rider their ride is lost when a session is refused', () => {
    expect(SESSION_REFUSALS.quotaFull).toContain('ride and your streak are already saved');
    expect(SESSION_REFUSALS.graceUsed).toContain('ride and your streak are already saved');
  });
});

describe('label tables', () => {
  it('matches the design’s words and colours', () => {
    expect(SESSION_DURATIONS.map((d) => d.label)).toEqual(['30m', '1h', '2h', '3h+']);
    expect(SESSION_FEELS.map((f) => [f.label, f.color])).toEqual([
      ['Sent it', '#10a06a'],
      ['Good', '#9ce05b'],
      ['Fine', '#ffc23f'],
      ['Rough', '#ff5a1f'],
      ['Hurt', '#ff3d78'],
    ]);
    expect(SESSION_WEATHER.map((w) => w.label)).toEqual(['Sun', 'Cloud', 'Rain', 'Wind', 'Cold']);
    expect(sessionDurationLabel(180)).toBe('3h+');
    expect(sessionDurationLabel(45)).toBe('');
    expect(sessionFeelLabel('hurt')).toBe('Hurt');
    expect(sessionFeelColor('sent')).toBe('#10a06a');
    expect(sessionWeatherLabel('cold')).toBe('Cold');
    expect(sessionWeatherLabel(undefined)).toBe('');
  });

  it('says time the way a rider reads it', () => {
    expect(sessionTimeLabel(45)).toBe('45m');
    expect(sessionTimeLabel(180)).toBe('3h');
    expect(sessionTimeLabel(150)).toBe('2h 30m');
    expect(sessionHours(390)).toBe(6.5);
    expect(sessionHours(400)).toBe(6.5);
  });
});

/* ------------------------------------------------------- lists and pages -- */

describe('lists, months and summaries', () => {
  const a = session({
    id: 'a',
    startedAt: '2026-09-12T15:00:00Z',
    spotId: 'park',
    durationMinutes: 120,
    sport: 'bmx',
  });
  const b = session({
    id: 'b',
    startedAt: '2026-09-09T16:40:00Z',
    spotId: 'kerb',
    eventId: 'jam',
    trickEntries: [{ trickId: 'whip', landed: true, stageFrom: 'trying', stageTo: 'some' }],
  });
  const c = session({
    id: 'c',
    startedAt: '2026-08-30T12:20:00Z',
    spotId: 'park',
    durationMinutes: 30,
  });
  const d = session({
    id: 'd',
    startedAt: '2026-08-25T15:00:00Z',
    spotId: 'park',
    durationMinutes: 180,
    trickEntries: [{ trickId: 'whip', landed: false }],
  });
  const all = [c, a, d, b];

  it('sorts newest first and finds neighbours', () => {
    expect(sortSessionsNewestFirst(all).map((s) => s.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(adjacentSessions(all, 'a')).toEqual({ newerId: null, olderId: 'b' });
    expect(adjacentSessions(all, 'c')).toEqual({ newerId: 'b', olderId: 'd' });
    expect(adjacentSessions(all, 'zz')).toEqual({ newerId: null, olderId: null });
  });

  it('filters by sport and by "at an event"', () => {
    expect(filterSessions(all, { sport: 'bmx' }).map((s) => s.id)).toEqual(['a']);
    expect(filterSessions(all, { atEvent: true }).map((s) => s.id)).toEqual(['b']);
    expect(filterSessions(all).length).toBe(4);
  });

  it('groups by the month ridden, newest month first', () => {
    const groups = groupSessionsByMonth(all, 'Europe/London');
    expect(groups.map((g) => [g.monthKey, g.monthName, g.count, g.minutes, g.stageMoves])).toEqual([
      ['2026-09', 'September', 2, 180, 1],
      ['2026-08', 'August', 2, 210, 0],
    ]);
    expect(groups[0]!.sessions.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('summarises a month for the sidebar', () => {
    expect(sessionMonthSummary(all, '2026-09', 'Europe/London')).toEqual({
      sessions: 2,
      minutes: 180,
      hours: 3,
      stageMoves: 1,
      spotsRidden: 2,
    });
  });

  it('ranks where a rider rides', () => {
    expect(topSpots(all, 4)).toEqual([
      { spotId: 'park', count: 3, share: 1 },
      { spotId: 'kerb', count: 1, share: 1 / 3 },
    ]);
    expect(topSpots(all, 1)).toHaveLength(1);
  });

  it('builds the spot and trick blocks', () => {
    expect(spotSessionSummary(all, 'park')).toMatchObject({ count: 3, minutes: 330 });
    const trick = trickSessionSummary(all, 'whip', 'Europe/London');
    expect(trick.count).toBe(2);
    expect(trick.firstTriedOn).toBe('2026-08-25');
    expect(trick.stageMoves).toEqual([{ sessionId: 'b', stageFrom: 'trying', stageTo: 'some' }]);
    expect(trickSessionSummary(all, 'nothing').firstTriedOn).toBeNull();
  });
});

describe('what this one changed', () => {
  // Week of Monday 7 September 2026.
  const mon = session({ id: 'mon', startedAt: '2026-09-07T16:00:00Z', spotId: 'park' });
  const monLater = session({ id: 'mon2', startedAt: '2026-09-07T19:00:00Z', spotId: 'park' });
  const wed = session({
    id: 'wed',
    startedAt: '2026-09-09T16:00:00Z',
    spotId: 'park',
    trickEntries: [{ trickId: 'whip', landed: true, stageFrom: 'some', stageTo: 'most' }],
  });
  const all = [wed, monLater, mon];

  it('lists the stage move, the ride, the banked week and which visit to the spot it was', () => {
    const changes = sessionChanges(wed, all, { timezone: 'Europe/London' });
    expect(changes).toEqual([
      { kind: 'stage', trickId: 'whip', stageFrom: 'some', stageTo: 'most' },
      { kind: 'streak_held' },
      { kind: 'week_banked', rides: 2 },
      { kind: 'spot_count', n: 3 },
    ]);
    expect(changes.map((c) => sessionChangeLabel(c, 'Tailwhip'))).toEqual([
      'Tailwhip: Sometimes → Most times',
      'Counted as a ride for your weekly streak',
      'Banked the week: 2 rides',
      'Your third session at this spot',
    ]);
  });

  it('does not count a second session on the same day as another ride', () => {
    const changes = sessionChanges(monLater, all, { timezone: 'Europe/London' });
    expect(changes).toEqual([{ kind: 'spot_count', n: 2 }]);
  });

  it('says first, and handles a stage from nothing', () => {
    const changes = sessionChanges(mon, all, { timezone: 'Europe/London' });
    expect(changes).toEqual([{ kind: 'streak_held' }, { kind: 'spot_count', n: 1 }]);
    expect(sessionChangeLabel({ kind: 'spot_count', n: 1 })).toBe(
      'Your first session at this spot',
    );
    expect(sessionChangeLabel({ kind: 'spot_count', n: 12 })).toBe(
      'Your 12th session at this spot',
    );
    expect(sessionChangeLabel({ kind: 'spot_count', n: 22 })).toBe(
      'Your 22nd session at this spot',
    );
    expect(
      sessionChangeLabel(
        { kind: 'stage', trickId: 'x', stageFrom: null, stageTo: 'some' },
        'Bunny Hop',
      ),
    ).toBe('Bunny Hop: Not tracked → Sometimes');
  });

  it('works when the session is not in the list it is compared against', () => {
    const alone = session({ id: 'solo', startedAt: '2026-09-12T10:00:00Z', spotId: 'new-spot' });
    expect(sessionChanges(alone, all)).toContainEqual({ kind: 'spot_count', n: 1 });
  });
});
