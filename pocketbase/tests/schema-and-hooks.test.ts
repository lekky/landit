import { beforeAll, describe, expect, it } from 'vitest';

import {
  baseFixtures,
  call,
  ensureRecord,
  makeRider,
  superuser,
  type Fixtures,
  type Rider,
} from './helpers';

/** Everything §3 asks for that is not one of the four headline guarantees. */
describe('schema, indexes and the constraint hooks', () => {
  let fixtures: Fixtures;
  let rider: Rider;

  beforeAll(async () => {
    fixtures = await baseFixtures();
    rider = await makeRider({}, { consent_state: 'not_required' });
  });

  it('created every collection §3 names', async () => {
    const token = await superuser();
    const result = await call<{ items: { name: string }[] }>('GET', '/api/collections', {
      token,
      query: { perPage: '200' },
    });
    const names = result.body.items.map((item) => item.name);

    for (const expected of [
      'users',
      'tricks',
      'trick_prereqs',
      'trick_progress',
      'trick_log',
      'trick_notes',
      'clips',
      'stickers',
      'rider_stickers',
      'plans',
      'subscriptions',
      'guardian_consents',
      'crews',
      'crew_members',
      'crew_invites',
      'challenges',
      'challenge_log',
      'spots',
      'events',
      'event_attendance',
      'announcements',
      'announcement_dismissals',
      'audit_log',
      'reports',
    ]) {
      expect(names, `missing collection: ${expected}`).toContain(expected);
    }
  });

  // ------------------------------------------------------------- handles --

  it('treats handles as case-insensitively unique', async () => {
    const taken = await makeRider({ handle: `nocase${Date.now().toString(36)}` });
    const clash = await call('POST', '/api/collections/users/records', {
      body: {
        email: `clash-${Date.now()}@landit.invalid`,
        password: 'a-long-local-test-password',
        passwordConfirm: 'a-long-local-test-password',
        handle: taken.handle.toUpperCase(),
      },
    });
    expect(clash.status).toBe(400);
  });

  it('normalises a handle to lower case rather than storing two spellings', async () => {
    const mixed = `MiXeD${Date.now().toString(36)}`;
    const created = await makeRider({ handle: mixed });
    const seen = await call<{ handle: string }>(
      'GET',
      `/api/collections/users/records/${created.id}`,
      { token: created.token },
    );
    expect(seen.body.handle).toBe(mixed.toLowerCase());
  });

  it('refuses a reserved handle', async () => {
    for (const reserved of ['admin', 'staff', 'landit', 'api', 'support']) {
      const result = await call('POST', '/api/collections/users/records', {
        body: {
          email: `reserved-${reserved}-${Date.now()}@landit.invalid`,
          password: 'a-long-local-test-password',
          passwordConfirm: 'a-long-local-test-password',
          handle: reserved,
        },
      });
      expect(result.status, `"${reserved}" should be reserved`).toBe(400);
    }
  });

  it('refuses a malformed handle', async () => {
    for (const bad of [
      'a',
      'has space',
      'Ünicode',
      '_leading',
      'trailing_',
      'way-too-long-a-handle',
    ]) {
      const result = await call('POST', '/api/collections/users/records', {
        body: {
          email: `bad-${Math.random().toString(36).slice(2)}@landit.invalid`,
          password: 'a-long-local-test-password',
          passwordConfirm: 'a-long-local-test-password',
          handle: bad,
        },
      });
      expect(result.status, `"${bad}" should be rejected`).toBe(400);
    }
  });

  // ---------------------------------------------------------- trick_log ---

  it('lets a rider create and delete their own log rows but never update one', async () => {
    const created = await call<{ id: string }>('POST', '/api/collections/trick_log/records', {
      token: rider.token,
      body: {
        user: rider.id,
        trick: fixtures.freeTrick,
        stage: 'some',
        at: '2026-08-01 12:00:00.000Z',
        estimated: true,
      },
    });
    expect(created.status).toBe(200);

    const edited = await call('PATCH', `/api/collections/trick_log/records/${created.body.id}`, {
      token: rider.token,
      body: { stage: 'every' },
    });
    expect(edited.status).toBe(403);

    const removed = await call('DELETE', `/api/collections/trick_log/records/${created.body.id}`, {
      token: rider.token,
    });
    expect(removed.status).toBe(204);
  });

  it('keeps the estimated flag the prototype depends on', async () => {
    const created = await call<{ estimated: boolean }>(
      'POST',
      '/api/collections/trick_log/records',
      {
        token: rider.token,
        body: {
          user: rider.id,
          trick: fixtures.freeTrick,
          stage: 'trying',
          at: '2026-07-01 12:00:00.000Z',
          estimated: true,
        },
      },
    );
    expect(created.body.estimated).toBe(true);
  });

  // ------------------------------------------------------ prerequisites ---

  it('refuses a prerequisite edge that crosses sports', async () => {
    const token = await superuser();
    const result = await call('POST', '/api/collections/trick_prereqs/records', {
      token,
      body: { trick: fixtures.paidTrick, prereq: fixtures.freeTrickSkate },
    });
    expect(result.status).toBe(400);
  });

  it('accepts a prerequisite edge within one sport', async () => {
    const token = await superuser();
    const result = await call('POST', '/api/collections/trick_prereqs/records', {
      token,
      body: { trick: fixtures.paidTrick, prereq: fixtures.freeTrick },
    });
    expect([200, 400]).toContain(result.status); // 400 only if the edge already exists
    if (result.status === 400) {
      const existing = await call<{ items: unknown[] }>(
        'GET',
        '/api/collections/trick_prereqs/records',
        {
          token,
          query: { filter: `trick = "${fixtures.paidTrick}" && prereq = "${fixtures.freeTrick}"` },
        },
      );
      expect(existing.body.items.length).toBe(1);
    }
  });

  it('refuses a trick that is its own prerequisite', async () => {
    const token = await superuser();
    const result = await call('POST', '/api/collections/trick_prereqs/records', {
      token,
      body: { trick: fixtures.freeTrick, prereq: fixtures.freeTrick },
    });
    expect(result.status).toBe(400);
  });

  // --------------------------------------------------------- challenges ---

  it('rejects a second challenge overlapping a live one in the same sport', async () => {
    const token = await superuser();
    const stamp = Date.now().toString(36);

    const first = await call('POST', '/api/collections/challenges/records', {
      token,
      body: {
        slug: `ov-a-${stamp}`,
        sport: 'skate',
        title: 'Overlap A',
        starts: '2027-03-01 00:00:00.000Z',
        ends: '2027-03-07 23:59:59.000Z',
        goal: 3,
      },
    });
    expect(first.status).toBe(200);

    const clash = await call('POST', '/api/collections/challenges/records', {
      token,
      body: {
        slug: `ov-b-${stamp}`,
        sport: 'skate',
        title: 'Overlap B',
        starts: '2027-03-05 00:00:00.000Z',
        ends: '2027-03-11 23:59:59.000Z',
        goal: 3,
      },
    });
    expect(clash.status).toBe(400);

    // The other sport is a different constraint, so the same week is fine.
    const otherSport = await call('POST', '/api/collections/challenges/records', {
      token,
      body: {
        slug: `ov-c-${stamp}`,
        sport: 'scooter',
        title: 'Overlap C',
        starts: '2027-03-05 00:00:00.000Z',
        ends: '2027-03-11 23:59:59.000Z',
        goal: 3,
      },
    });
    expect(otherSport.status).toBe(200);

    // And the constraint holds on update, not only on create.
    const moved = await call('PATCH', `/api/collections/challenges/records/${otherSport.body.id}`, {
      token,
      body: { sport: 'skate' },
    });
    expect(moved.status).toBe(400);
  });

  it('only lets a rider log a challenge while it is running', async () => {
    const token = await superuser();
    const stamp = Date.now().toString(36);

    const past = await call<{ id: string }>('POST', '/api/collections/challenges/records', {
      token,
      body: {
        slug: `past-${stamp}`,
        sport: 'skate',
        title: 'Finished Week',
        starts: '2025-01-06 00:00:00.000Z',
        ends: '2025-01-12 23:59:59.000Z',
        goal: 3,
      },
    });
    expect(past.status).toBe(200);

    const late = await call('POST', '/api/collections/challenge_log/records', {
      token: rider.token,
      body: { user: rider.id, challenge: past.body.id },
    });
    expect(late.status).toBe(403);

    const now = new Date();
    const live = await call<{ id: string }>('POST', '/api/collections/challenges/records', {
      token,
      body: {
        slug: `live-${stamp}`,
        sport: 'scooter',
        title: 'This Week',
        starts:
          new Date(now.getTime() - 86400000).toISOString().replace('T', ' ').slice(0, 23) + 'Z',
        ends: new Date(now.getTime() + 86400000).toISOString().replace('T', ' ').slice(0, 23) + 'Z',
        goal: 3,
      },
    });
    expect(live.status).toBe(200);

    const logged = await call('POST', '/api/collections/challenge_log/records', {
      token: rider.token,
      body: { user: rider.id, challenge: live.body.id },
    });
    expect(logged.status).toBe(200);
  });

  // ------------------------------------------------------------ stickers --

  it('awards stickers server-side and refuses to let a client forge one', async () => {
    await ensureRecord('stickers', "slug = 'first-land'", {
      slug: 'first-land',
      name: 'First Land',
      cond: 'Log your first trick',
      is_live: true,
    });

    const earner = await makeRider({}, { consent_state: 'not_required' });
    const progress = await call('POST', '/api/collections/trick_progress/records', {
      token: earner.token,
      body: { user: earner.id, trick: fixtures.freeTrick, stage: 'some' },
    });
    expect(progress.status).toBe(200);

    const held = await call<{ items: { expand?: unknown; sticker: string }[] }>(
      'GET',
      '/api/collections/rider_stickers/records',
      { token: earner.token, query: { filter: `user = "${earner.id}"` } },
    );
    expect(held.body.items.length).toBeGreaterThanOrEqual(1);

    const forged = await call('POST', '/api/collections/rider_stickers/records', {
      token: earner.token,
      body: { user: earner.id, sticker: held.body.items[0]!.sticker },
    });
    expect(forged.status).toBe(403);
  });

  it('lets a rider mark a sticker seen and nothing else', async () => {
    const earner = await makeRider({}, { consent_state: 'not_required' });
    await call('POST', '/api/collections/trick_progress/records', {
      token: earner.token,
      body: { user: earner.id, trick: fixtures.freeTrick, stage: 'every' },
    });

    const held = await call<{ items: { id: string; earned_at: string }[] }>(
      'GET',
      '/api/collections/rider_stickers/records',
      { token: earner.token, query: { filter: `user = "${earner.id}"` } },
    );
    const row = held.body.items[0]!;

    const seen = await call('PATCH', `/api/collections/rider_stickers/records/${row.id}`, {
      token: earner.token,
      body: { seen_at: '2026-08-16 10:00:00.000Z' },
    });
    expect(seen.status).toBe(200);

    const rewritten = await call('PATCH', `/api/collections/rider_stickers/records/${row.id}`, {
      token: earner.token,
      body: { earned_at: '2020-01-01 00:00:00.000Z' },
    });
    expect(rewritten.status).toBe(403);

    const removed = await call('DELETE', `/api/collections/rider_stickers/records/${row.id}`, {
      token: earner.token,
    });
    expect(removed.status).toBe(403);
  });

  // --------------------------------------------------------------- spots --

  it('puts a submitted spot in the review queue, whatever status the client sent', async () => {
    const submitted = await call<{ status: string; submitted_by: string }>(
      'POST',
      '/api/collections/spots/records',
      {
        token: rider.token,
        body: { name: 'Queue Test', town: 'Wigan', lat: 53.5, lng: -2.6, status: 'live' },
      },
    );
    expect(submitted.status).toBe(200);
    expect(submitted.body.status).toBe('pending');
    expect(submitted.body.submitted_by).toBe(rider.id);

    const otherRider = await makeRider({}, { consent_state: 'not_required' });
    const listed = await call<{ items: { status: string }[] }>(
      'GET',
      '/api/collections/spots/records',
      {
        token: otherRider.token,
        query: { perPage: '200' },
      },
    );
    expect(listed.body.items.every((item) => item.status === 'live')).toBe(true);

    // A staff-created pending spot has an empty `submitted_by`, which must not
    // match a signed-out visitor's empty auth id.
    const token = await superuser();
    const staffPending = await call<{ id: string }>('POST', '/api/collections/spots/records', {
      token,
      body: { name: 'Staff Pending', town: 'Corby', lat: 52.5, lng: -0.7, status: 'pending' },
    });
    expect(staffPending.status).toBe(200);

    const asGuest = await call<{ items: { status: string }[] }>(
      'GET',
      '/api/collections/spots/records',
      { query: { perPage: '200' } },
    );
    expect(asGuest.body.items.every((item) => item.status === 'live')).toBe(true);
  });

  // ------------------------------------------------------------- reports --

  it('accepts a report from somebody with no account, and pins its status', async () => {
    const filed = await call<{ id: string; status: string; reporter: string }>(
      'POST',
      '/api/collections/reports/records',
      {
        body: {
          subject_type: 'profile',
          subject_id: rider.id,
          reason: 'harassment',
          detail: 'filed by a guest',
          reporter_email: 'guest@landit.invalid',
          status: 'dismissed',
          outcome: 'nothing to see here',
        },
      },
    );
    expect(filed.status).toBe(200);
    expect(filed.body.status).toBe('open');
    expect(filed.body.reporter).toBe('');

    // Nobody reads the queue over the public API — that is the admin portal's
    // job through a superuser client (plan §3).
    const peek = await call('GET', `/api/collections/reports/records/${filed.body.id}`, {
      token: rider.token,
    });
    expect(peek.status).toBe(404);
  });

  // ----------------------------------------------------------- audit log --

  it('writes an audit row for a staff-collection change and never exposes the log', async () => {
    const token = await superuser();
    const trick = await ensureRecord('tricks', "slug = 'fixture-audit'", {
      slug: 'fixture-audit',
      name: 'Fixture Audit',
      sport: 'skate',
      cat: 'street',
      diff: 3,
      is_live: true,
    });

    await call('PATCH', `/api/collections/tricks/records/${trick.id}`, {
      token,
      body: { name: `Fixture Audit ${Date.now()}` },
    });

    const rows = await call<{ items: { entity: string; action: string }[] }>(
      'GET',
      '/api/collections/audit_log/records',
      { token, query: { filter: `entity = "tricks" && entity_id = "${trick.id}"`, perPage: '10' } },
    );
    expect(rows.status).toBe(200);
    expect(rows.body.items.some((item) => item.action === 'update')).toBe(true);

    const asRider = await call('GET', '/api/collections/audit_log/records', { token: rider.token });
    expect(asRider.status).toBe(403);

    const asGuest = await call('GET', '/api/collections/audit_log/records');
    expect(asGuest.status).toBe(403);
  });

  // ------------------------------------------------------------ suspend ---

  it('stops a suspended account signing in', async () => {
    const token = await superuser();
    const suspended = await makeRider({}, { consent_state: 'not_required' });
    await call('PATCH', `/api/collections/users/records/${suspended.id}`, {
      token,
      body: { suspended: true },
    });

    const auth = await call('POST', '/api/collections/users/auth-with-password', {
      body: { identity: suspended.email, password: suspended.password },
    });
    expect(auth.status).toBe(403);
  });
});
