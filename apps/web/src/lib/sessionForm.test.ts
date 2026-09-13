import { SESSION_REFUSALS, sessionQuotaStatus, type StageId } from '@landit/core';
import { describe, expect, it } from 'vitest';

import {
  SESSION_SAVE_FAILED,
  editSessionValues,
  escalateQuickLog,
  eventsAtSpotToday,
  formIsDirty,
  inOurWords,
  landedPreview,
  localDateTimeIn,
  newSessionValues,
  readFormValues,
  refusalView,
  savedRideLine,
  sessionInputFrom,
  sessionOpenSource,
  sessionPatchFrom,
  sessionQuotaWarning,
  sessionStampLabel,
  sessionWallPips,
  trickStageLine,
  visibilityLine,
  zonedLocalToInstant,
  type SessionFormValues,
} from './sessionForm';

const SPOT = 'spotaaaaaaaaaaa';
const EVENT = 'eventaaaaaaaaaa';
const TRICK = 'trickaaaaaaaaaa';
const OTHER_TRICK = 'trickbbbbbbbbbb';
const MATE = 'mateaaaaaaaaaaa';

// 2026-09-13 15:20 UTC — 16:20 in London (BST).
const NOW = Date.UTC(2026, 8, 13, 15, 20);
const CLOCK = { now: NOW, timezone: 'Europe/London' };

function filled(overrides: Partial<SessionFormValues> = {}): SessionFormValues {
  return {
    ...newSessionValues({
      prefill: { spot: SPOT },
      sports: ['scooter'],
      visibilityDefault: 'private',
      nowLocal: '2026-09-13T16:20',
    }),
    feel: 'good',
    ...overrides,
  };
}

describe('what a new form opens holding', () => {
  it('takes the spot, event and trick from the link, and the profile default', () => {
    const values = newSessionValues({
      prefill: { spot: SPOT, event: EVENT, trick: TRICK },
      sports: ['scooter', 'bmx'],
      recentSpotId: 'recentaaaaaaaaa',
      impliedSport: 'bmx',
      visibilityDefault: 'members',
      nowLocal: '2026-09-13T16:20',
    });
    expect(values).toMatchObject({
      when: 'now',
      spotId: SPOT,
      eventId: EVENT,
      sport: 'bmx',
      tricks: [{ trickId: TRICK, landed: false }],
      visibility: 'members',
      feel: null,
      clip: '',
    });
  });

  it('falls back to the most recent spot, and to the first sport the rider rides', () => {
    const values = newSessionValues({
      prefill: {},
      sports: ['skate'],
      recentSpotId: 'recentaaaaaaaaa',
      impliedSport: 'bmx',
      visibilityDefault: 'private',
      nowLocal: '2026-09-13T16:20',
    });
    expect(values.spotId).toBe('recentaaaaaaaaa');
    expect(values.sport).toBe('skate');
    expect(values.eventId).toBe('');
  });

  it('carries the quick log’s time, spot and feel into the full form untouched', () => {
    const quick = filled({ feel: 'sent' });
    const full = escalateQuickLog(quick);
    expect(full).toEqual(quick);
    expect(full).not.toBe(quick);
    expect(full.tricks).not.toBe(quick.tricks);
    expect(formIsDirty(full, quick)).toBe(false);
  });
});

describe('the rider’s clock', () => {
  it('writes and reads a wall-clock time in the rider’s zone, either side of the clocks changing', () => {
    expect(localDateTimeIn(NOW, 'Europe/London')).toBe('2026-09-13T16:20');
    expect(zonedLocalToInstant('2026-09-13T16:20', 'Europe/London')).toBe(
      '2026-09-13T15:20:00.000Z',
    );
    // Winter: London is on UTC.
    expect(zonedLocalToInstant('2026-12-01T09:00', 'Europe/London')).toBe(
      '2026-12-01T09:00:00.000Z',
    );
    expect(zonedLocalToInstant('2026-09-13T16:20', 'Pacific/Auckland')).toBe(
      '2026-09-13T04:20:00.000Z',
    );
    expect(zonedLocalToInstant('not a time', 'Europe/London')).toBeNull();
  });

  it('labels the quick log’s timestamp as the design does', () => {
    expect(sessionStampLabel(NOW, 'Europe/London')).toBe('Sun 13 Sep · 16:20');
  });
});

describe('the field-to-input mapping', () => {
  it('sends the clip box as typed, never parsed, and omits an empty event and weather', () => {
    const input = sessionInputFrom(
      filled({ clip: '  https://www.youtube.com/watch?v=kQ8tR2vLm4a  ', crewIds: [MATE] }),
      CLOCK,
    );
    expect(input).toEqual({
      startedAt: new Date(NOW).toISOString(),
      durationMinutes: 60,
      sport: 'scooter',
      spotId: SPOT,
      aim: '',
      feel: 'good',
      notes: '',
      crewIds: [MATE],
      clip: 'https://www.youtube.com/watch?v=kQ8tR2vLm4a',
      visibility: 'private',
      tricks: [],
    });
  });

  it('never sends a clip for a plan that holds none', () => {
    const input = sessionInputFrom(filled({ clip: 'not a link at all' }), CLOCK, {
      clipAllowed: false,
    });
    expect(input).not.toBeNull();
    expect(input).not.toHaveProperty('clip');
  });

  it('builds an input for a session logged without a feel', () => {
    // Optional since 2026-09-13: no feel is a session, not a problem, and the
    // field is left off the write rather than sent empty.
    const input = sessionInputFrom(filled({ feel: null }), CLOCK);
    expect(input).not.toBeNull();
    expect(input).not.toHaveProperty('feel');
  });

  it('refuses to build an input the form has a problem with', () => {
    expect(sessionInputFrom(filled({ spotId: '' }), CLOCK)).toBeNull();
    expect(sessionInputFrom(filled({ clip: 'https://vm.tiktok.com/ZMabc/' }), CLOCK)).toBeNull();
    expect(
      sessionInputFrom(filled({ when: 'pick', pickedAt: '2026-09-14T16:20' }), CLOCK),
    ).toBeNull();
  });

  it('turns a picked time into an instant on the rider’s clock', () => {
    const input = sessionInputFrom(filled({ when: 'pick', pickedAt: '2026-09-12T10:00' }), CLOCK);
    expect(input?.startedAt).toBe('2026-09-12T09:00:00.000Z');
    expect(input?.eventId).toBeUndefined();
  });

  it('patches only what an edit changed', () => {
    const initial = editSessionValues({
      session: {
        startedAt: '2026-09-12T09:00:00.000Z',
        durationMinutes: 120,
        sport: 'scooter',
        spotId: SPOT,
        eventId: EVENT,
        feel: 'sent',
        crewIds: [MATE],
        visibility: 'members',
        trickEntries: [{ trickId: TRICK, landed: true }],
      },
      clipText: 'https://www.youtube.com/watch?v=kQ8tR2vLm4a',
      timezone: 'Europe/London',
    });
    expect(initial.pickedAt).toBe('2026-09-12T10:00');
    expect(sessionPatchFrom(initial, initial, CLOCK)).toEqual({});

    const edited = { ...initial, eventId: '', notes: 'Whips all day', tricks: [] };
    expect(sessionPatchFrom(edited, initial, CLOCK)).toEqual({
      eventId: null,
      notes: 'Whips all day',
      tricks: [],
    });
  });
});

describe('reading what the browser sent', () => {
  it('accepts the form’s own shape', () => {
    const values = filled({
      tricks: [{ trickId: TRICK, landed: true, stagePick: 'most' }],
      crewIds: [MATE],
    });
    expect(readFormValues(JSON.parse(JSON.stringify(values)))).toEqual(values);
  });

  it('normalises a trick entry that names no stage, or names a made-up one', () => {
    const read = readFormValues(
      JSON.parse(
        JSON.stringify(
          filled({
            tricks: [
              { trickId: TRICK, landed: true },
              // Not a stage at all — what a stale or hand-edited payload looks like.
              { trickId: OTHER_TRICK, landed: false, stagePick: 'legend' as unknown as StageId },
            ],
          }),
        ),
      ),
    );
    expect(read?.tricks).toEqual([
      { trickId: TRICK, landed: true, stagePick: null },
      { trickId: OTHER_TRICK, landed: false, stagePick: null },
    ]);
  });

  it('refuses anything else rather than guessing', () => {
    expect(readFormValues(null)).toBeNull();
    expect(readFormValues({ ...filled(), spotId: 'Tennis court' })).toBeNull();
    expect(readFormValues({ ...filled(), visibility: 'everyone' })).toBeNull();
    expect(readFormValues({ ...filled(), durationMinutes: 45 })).toBeNull();
    expect(readFormValues({ ...filled(), crewIds: ['<script>'] })).toBeNull();
  });
});

describe('refusals', () => {
  it('maps quota to the wall with the grace, and grace_used to the wall without', () => {
    expect(refusalView({ kind: 'quota', message: SESSION_REFUSALS.quotaFull })).toEqual({
      kind: 'wall',
      grace: true,
    });
    expect(refusalView({ kind: 'grace_used', message: SESSION_REFUSALS.graceUsed })).toEqual({
      kind: 'wall',
      grace: false,
    });
  });

  it('puts a clip refusal under the clip field in core’s words', () => {
    expect(refusalView({ kind: 'clip', message: SESSION_REFUSALS.clipCap })).toEqual({
      kind: 'field',
      field: 'clip',
      message: SESSION_REFUSALS.clipCap,
    });
    expect(refusalView({ kind: 'clip', message: null })).toEqual({
      kind: 'field',
      field: 'clip',
      message: SESSION_REFUSALS.clipNotOnPlan,
    });
  });

  it('puts a named refusal under its field, and never passes PocketBase’s wording on', () => {
    expect(refusalView({ kind: 'other', message: SESSION_REFUSALS.crewNotMate })).toEqual({
      kind: 'field',
      field: 'crewIds',
      message: SESSION_REFUSALS.crewNotMate,
    });
    expect(refusalView({ kind: 'other', message: 'Failed to create record.' })).toEqual({
      kind: 'error',
      message: SESSION_SAVE_FAILED,
    });
    expect(inOurWords(undefined)).toBe(SESSION_SAVE_FAILED);
  });
});

describe('analytics source', () => {
  it('reads where the form was opened from, event first', () => {
    expect(sessionOpenSource({ spot: SPOT, event: EVENT })).toBe('event');
    expect(sessionOpenSource({ trick: TRICK })).toBe('trick');
    expect(sessionOpenSource({ spot: SPOT, quick: true })).toBe('spot');
    expect(sessionOpenSource({ quick: true })).toBe('progress');
  });
});

describe('copy', () => {
  it('names the streak and the weekly target, gain-framed', () => {
    const base = { counted: true, failed: false, streak: 12, target: 2 };
    expect(savedRideLine({ ...base, ridesThisWeek: 2 })).toBe(
      'Streak held at 12 weeks. That is both rides this week — target met.',
    );
    expect(savedRideLine({ ...base, ridesThisWeek: 1 })).toBe(
      'Streak held at 12 weeks. That is 1 of 2 rides this week.',
    );
    expect(savedRideLine({ ...base, counted: false, ridesThisWeek: 0 })).toMatch(/diary/);
  });

  it('draws the wall as the month’s sessions and the refused one', () => {
    const full = sessionQuotaStatus(
      { cap: 4, unlimited: false },
      {
        usedThisMonth: 4,
        graceUsed: false,
      },
    );
    expect(sessionWallPips(full)).toEqual(['used', 'used', 'used', 'used', 'refused']);
  });

  it('warns on the last session and not before', () => {
    const allowance = { cap: 4, unlimited: false };
    expect(
      sessionQuotaWarning(sessionQuotaStatus(allowance, { usedThisMonth: 3, graceUsed: false })),
    ).toBe('One left this month');
    expect(
      sessionQuotaWarning(sessionQuotaStatus(allowance, { usedThisMonth: 1, graceUsed: false })),
    ).toBeNull();
    expect(sessionQuotaWarning(null)).toBeNull();
  });

  it('says where a trick stands and where a landing takes it', () => {
    expect(trickStageLine('some', '2026-08-25')).toBe('Sometimes · since 25 Aug');
    expect(trickStageLine(null, null)).toBe('Not tracked yet');
    expect(landedPreview('some')).toBe('→ Most times');
    expect(landedPreview(null)).toBe('→ Sometimes');
    expect(landedPreview('every')).toBe('Already every time');
  });

  it('names the choice and the profile default', () => {
    expect(visibilityLine('members', 'private')).toBe(
      'The riders you ride with. Your default is Only me.',
    );
  });
});

describe('an event on at the spot today', () => {
  const spot = { lat: 52.49, lng: -0.69 };
  const events = [
    { id: 'a', name: 'Near, today', date: '2026-09-13 00:00:00.000Z', lat: 52.492, lng: -0.692 },
    { id: 'b', name: 'Near, tomorrow', date: '2026-09-14 00:00:00.000Z', lat: 52.49, lng: -0.69 },
    { id: 'c', name: 'Far, today', date: '2026-09-13 00:00:00.000Z', lat: 53.4, lng: -2.2 },
  ];

  it('offers only a live event on today within reach of the spot', () => {
    expect(eventsAtSpotToday(events, spot, '2026-09-13').map((e) => e.id)).toEqual(['a']);
    expect(eventsAtSpotToday(events, null, '2026-09-13')).toEqual([]);
  });
});
