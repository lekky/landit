import { SESSION_REFUSALS } from '@landit/core';
import { describe, expect, it } from 'vitest';

import type { Client } from './clients';
import type { SessionTricksRecord, SessionsRecord, UsersRecord } from './generated/collections';
import {
  getSessionQuota,
  listOwnSessions,
  logSession,
  sessionAllowanceFromRecord,
  sessionFromRecord,
  updateSession,
} from './sessions';

/**
 * The sessions reads and writes (T36), tested where a stub can answer: the
 * filters asked for, the shape written, the order of the two writes in
 * `logSession`, and the mapping into core's `RideSession`.
 *
 * What a stub cannot say — that the quota holds, that a stranger sees nothing,
 * that "rode with" is stripped, that a stage moves once — is proven over HTTP
 * against the real binary in `pocketbase/tests/sessions.test.ts` (LESSONS §5).
 */

interface Call {
  collection: string;
  method: string;
  args: unknown[];
}

function row(overrides: Partial<SessionsRecord> = {}): SessionsRecord {
  return {
    collectionId: 'c',
    collectionName: 'sessions',
    id: 's1',
    user: 'u1',
    started_at: '2026-09-13 09:00:00.000Z',
    duration_minutes: 120,
    sport: 'scooter',
    spot: 'spot1',
    event: '',
    aim: '',
    feel: 'sent',
    weather: '',
    notes: '',
    rode_with: [],
    clip_platform: '',
    clip_id: '',
    visibility: 'public',
    month_key: '2026-09',
    grace: false,
    created: '2026-09-13 10:00:00.000Z',
    updated: '2026-09-13 10:00:00.000Z',
    ...overrides,
  } as SessionsRecord;
}

function fakeClient(
  handlers: {
    create?: (collection: string, data: Record<string, unknown>) => unknown;
    list?: (collection: string) => unknown[];
  } = {},
) {
  const calls: Call[] = [];
  const client = {
    filter: (expression: string, params: Record<string, unknown>) =>
      `${expression} ${JSON.stringify(params)}`,
    collection(collection: string) {
      return {
        async getFullList(options: Record<string, unknown>) {
          calls.push({ collection, method: 'getFullList', args: [options] });
          return handlers.list?.(collection) ?? [];
        },
        async getList(page: number, perPage: number, options: Record<string, unknown>) {
          calls.push({ collection, method: 'getList', args: [page, perPage, options] });
          const items = handlers.list?.(collection) ?? [];
          return { items, page, perPage, totalItems: items.length, totalPages: 1 };
        },
        async getOne(id: string) {
          calls.push({ collection, method: 'getOne', args: [id] });
          return row({ id });
        },
        async create(data: Record<string, unknown>) {
          calls.push({ collection, method: 'create', args: [data] });
          if (handlers.create) return handlers.create(collection, data);
          return { ...data, id: `${collection}-new` };
        },
        async update(id: string, data: Record<string, unknown>) {
          calls.push({ collection, method: 'update', args: [id, data] });
          return { ...row({ id }), ...data };
        },
        async delete(id: string) {
          calls.push({ collection, method: 'delete', args: [id] });
        },
      };
    },
  };
  return { client: client as unknown as Client, calls };
}

describe('sessionFromRecord', () => {
  it('maps a row and its entries into a RideSession', () => {
    const entries = [
      { session: 's1', trick: 't1', landed: true, stage_from: 'trying', stage_to: 'some' },
      { session: 's1', trick: 't2', landed: false, stage_from: '', stage_to: '' },
      { session: 'other', trick: 't3', landed: true, stage_from: '', stage_to: 'some' },
    ] as SessionTricksRecord[];
    const session = sessionFromRecord(
      row({ clip_platform: 'youtube', clip_id: 'dQw4w9WgXcQ', event: 'e1', weather: 'rain' }),
      entries,
    );
    expect(session).toMatchObject({
      id: 's1',
      durationMinutes: 120,
      eventId: 'e1',
      weather: 'rain',
      clip: { platform: 'youtube', id: 'dQw4w9WgXcQ' },
      visibility: 'public',
      monthKey: '2026-09',
    });
    expect(session.trickEntries).toEqual([
      { trickId: 't1', landed: true, stageFrom: 'trying', stageTo: 'some' },
      { trickId: 't2', landed: false },
    ]);
  });

  it('reads the untrustworthy parts fail-closed', () => {
    const session = sessionFromRecord(
      row({
        visibility: '' as SessionsRecord['visibility'],
        clip_platform: 'youtube',
        clip_id: 'not-an-id',
        duration_minutes: 45,
        month_key: undefined as unknown as string,
        grace: undefined as unknown as boolean,
      }),
    );
    expect(session.visibility).toBe('private');
    expect(session.clip).toBeUndefined();
    expect(session.durationMinutes).toBe(60);
    // Hidden from a non-owner by the enrich hook, so absent reads as empty.
    expect(session.monthKey).toBe('');
    expect(session.graceUsed).toBe(false);
  });
});

describe('listOwnSessions', () => {
  it('asks for one rider, newest first, with the sport and event filters, then their entries', async () => {
    const { client, calls } = fakeClient({ list: (c) => (c === 'sessions' ? [row()] : []) });
    const page = await listOwnSessions(client, { userId: 'u1', sport: 'bmx', atEvent: true });
    const [sessionsCall, entriesCall] = calls;
    expect(sessionsCall?.method).toBe('getList');
    expect(sessionsCall?.args[1]).toBe(3);
    const options = sessionsCall?.args[2] as { filter: string; sort: string };
    expect(options.filter).toContain("user = {:user} && sport = {:sport} && event != ''");
    expect(options.filter).toContain('"sport":"bmx"');
    expect(options.sort).toBe('-started_at,-created');
    expect(entriesCall?.collection).toBe('session_tricks');
    expect(page.items).toHaveLength(1);
  });
});

describe('getSessionQuota', () => {
  it('counts sessions logged in the rider’s month and whether the grace is spent', async () => {
    const { client, calls } = fakeClient({
      list: (c) => (c === 'sessions' ? [{}, {}, {}] : [{}]),
    });
    const quota = await getSessionQuota(client, {
      userId: 'u1',
      plan: { session_month_cap: 4, sessions_unlimited: false } as never,
      timezone: 'Pacific/Auckland',
      now: Date.parse('2026-09-30T23:30:00Z'),
    });
    expect(quota.monthKey).toBe('2026-10');
    expect(quota).toMatchObject({ used: 3, state: 'warn', graceAvailable: false });
    const filter = (calls[0]?.args[0] as { filter: string }).filter;
    expect(filter).toContain('"month":"2026-10"');
  });

  it('fails closed on a missing plan', () => {
    expect(sessionAllowanceFromRecord(null)).toEqual({ cap: 0, unlimited: false });
  });
});

describe('logSession — the ride saves first, whatever happens to the session (D6)', () => {
  const rider = {
    id: 'u1',
    timezone: 'Europe/London',
    streak: 0,
    last_ride: '',
    week_start: '',
    rides_this_week: 0,
    last_qualifying_week: '',
  } as unknown as UsersRecord;
  const now = Date.parse('2026-09-13T12:00:00Z');
  const input = {
    startedAt: '2026-09-13T10:00:00Z',
    durationMinutes: 60,
    sport: 'scooter',
    spotId: 'spot1',
    feel: 'good',
    clip: '',
  } as const;

  function refusingClient(message: string, status = 403) {
    return fakeClient({
      create: () => {
        throw Object.assign(new Error('refused'), { status, response: { message } });
      },
    });
  }

  it('writes the streak with the superuser client before asking for the session', async () => {
    const order: string[] = [];
    const superuser = fakeClient({});
    const rideCalls = superuser.calls;
    const rider2 = { ...rider };
    const riderClient = fakeClient({
      create: (collection, data) => {
        order.push(`create:${collection}:${rideCalls.length}`);
        return { ...row(), ...data, id: 's9' };
      },
    });
    const result = await logSession({
      client: riderClient.client,
      superuser: superuser.client,
      rider: rider2,
      input,
      now,
    });
    expect(rideCalls[0]).toMatchObject({ collection: 'users', method: 'update' });
    expect(rideCalls[0]?.args[1]).toMatchObject({
      rides_this_week: 1,
      last_ride: '2026-09-13 12:00:00.000Z',
    });
    // The session create ran after one superuser write had already happened.
    expect(order).toEqual(['create:sessions:1']);
    expect(result.ride).toMatchObject({ counted: true, changed: true, failed: false });
    expect(result.session?.id).toBe('s9');
    expect(result.refusal).toBeNull();
  });

  it('keeps the ride when the month is full, and says which wall to show', async () => {
    const superuser = fakeClient({});
    const refused = refusingClient(SESSION_REFUSALS.quotaFull);
    const result = await logSession({
      client: refused.client,
      superuser: superuser.client,
      rider,
      input,
      now,
    });
    expect(superuser.calls).toHaveLength(1);
    expect(result.ride.changed).toBe(true);
    expect(result.session).toBeNull();
    expect(result.refusal).toEqual({
      kind: 'quota',
      message: SESSION_REFUSALS.quotaFull,
      status: 403,
    });
  });

  it('names the grace and the clip refusals, and anything else as other', async () => {
    const superuser = fakeClient({});
    for (const [message, kind, status] of [
      [SESSION_REFUSALS.graceUsed, 'grace_used', 403],
      [SESSION_REFUSALS.clipNotOnPlan, 'clip', 403],
      [SESSION_REFUSALS.clipCap, 'clip', 403],
      [SESSION_REFUSALS.spotHidden, 'other', 400],
    ] as const) {
      const result = await logSession({
        client: refusingClient(message, status).client,
        superuser: superuser.client,
        rider,
        input,
        now,
        useGrace: true,
      });
      expect(result.refusal?.kind, message).toBe(kind);
    }
  });

  it('moves no streak for a session backfilled to another day', async () => {
    const superuser = fakeClient({});
    const riderClient = fakeClient({});
    const result = await logSession({
      client: riderClient.client,
      superuser: superuser.client,
      rider,
      input: { ...input, startedAt: '2026-09-10T10:00:00Z' },
      now,
    });
    expect(superuser.calls).toHaveLength(0);
    expect(result.ride).toMatchObject({ counted: false, changed: false, result: null });
  });

  it('does not write the streak twice on a day the rider already tapped', async () => {
    const superuser = fakeClient({});
    const result = await logSession({
      client: fakeClient({}).client,
      superuser: superuser.client,
      rider: {
        ...rider,
        last_ride: '2026-09-13 12:00:00.000Z',
        rides_this_week: 1,
        week_start: '2026-09-07',
      } as UsersRecord,
      input,
      now,
    });
    expect(superuser.calls).toHaveLength(0);
    expect(result.ride).toMatchObject({ counted: true, changed: false });
  });

  it('reports a ride it could not write, and still tries the session', async () => {
    const riderClient = fakeClient({});
    const result = await logSession({
      client: riderClient.client,
      superuser: null,
      rider,
      input,
      now,
    });
    expect(result.ride).toMatchObject({ counted: true, failed: true, changed: false });
    expect(riderClient.calls.some((c) => c.method === 'create')).toBe(true);
  });

  it('sends the month on the rider’s clock and the clip exactly as pasted', async () => {
    const riderClient = fakeClient({});
    await logSession({
      client: riderClient.client,
      superuser: null,
      rider: { ...rider, timezone: 'Pacific/Auckland' } as UsersRecord,
      input: {
        ...input,
        startedAt: '2026-09-30T23:00:00Z',
        clip: 'https://youtu.be/dQw4w9WgXcQ?si=x',
      },
      now: Date.parse('2026-09-30T23:30:00Z'),
    });
    const created = riderClient.calls.find((c) => c.method === 'create')?.args[0] as Record<
      string,
      unknown
    >;
    expect(created.month_key).toBe('2026-10');
    expect(created.clip_id).toBe('https://youtu.be/dQw4w9WgXcQ?si=x');
    expect(created.visibility).toBe('private');
    expect(created.grace).toBe(false);
  });
});

describe('updateSession', () => {
  it('adds, re-flags and removes trick entries, and never touches trick_progress', async () => {
    const existing = [
      { id: 'e1', session: 's1', trick: 'keep', landed: false },
      { id: 'e2', session: 's1', trick: 'drop', landed: true },
    ];
    const { client, calls } = fakeClient({
      list: (c) => (c === 'session_tricks' ? existing : []),
    });
    await updateSession(client, 's1', {
      notes: 'Edited',
      tricks: [
        { trickId: 'keep', landed: true },
        { trickId: 'new', landed: false },
      ],
    });
    expect(calls.some((c) => c.collection === 'trick_progress')).toBe(false);
    expect(calls).toContainEqual({ collection: 'session_tricks', method: 'delete', args: ['e2'] });
    expect(calls).toContainEqual({
      collection: 'session_tricks',
      method: 'update',
      args: ['e1', { landed: true, stage_pick: '' }],
    });
    const created = calls.find((c) => c.collection === 'session_tricks' && c.method === 'create');
    expect(created?.args[0]).toMatchObject({ session: 's1', trick: 'new', landed: false });
  });

  it('saves the stage the rider picked, and clears one they took back', async () => {
    // The pick is a request; the hook decides what it does. What this holds is
    // that the request reaches it, and that taking it back reaches it too.
    const existing = [
      { id: 'e1', session: 's1', trick: 'keep', landed: true, stage_pick: 'most' },
      { id: 'e2', session: 's1', trick: 'also', landed: false, stage_pick: '' },
    ];
    const { client, calls } = fakeClient({
      list: (c) => (c === 'session_tricks' ? existing : []),
    });
    await updateSession(client, 's1', {
      tricks: [
        { trickId: 'keep', landed: false, stagePick: null },
        { trickId: 'also', landed: true, stagePick: 'some' },
      ],
    });
    expect(calls).toContainEqual({
      collection: 'session_tricks',
      method: 'update',
      args: ['e1', { landed: false, stage_pick: '' }],
    });
    expect(calls).toContainEqual({
      collection: 'session_tricks',
      method: 'update',
      args: ['e2', { landed: true, stage_pick: 'some' }],
    });
  });

  it('leaves an entry alone when neither the landing nor the pick changed', async () => {
    const existing = [{ id: 'e1', session: 's1', trick: 'keep', landed: true, stage_pick: 'most' }];
    const { client, calls } = fakeClient({
      list: (c) => (c === 'session_tricks' ? existing : []),
    });
    await updateSession(client, 's1', {
      tricks: [{ trickId: 'keep', landed: true, stagePick: 'most' }],
    });
    expect(calls.some((c) => c.collection === 'session_tricks' && c.method === 'update')).toBe(
      false,
    );
  });
});
