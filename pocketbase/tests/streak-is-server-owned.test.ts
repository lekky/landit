import { describe, expect, it } from 'vitest';

import { call, makeRider, superuser } from './helpers';

/**
 * Issue #8: a derived number a client can write is not derived.
 *
 * `users.streak` feeds the `week-one` and `month-on` sticker rules, so a rider
 * who could PATCH it to 9999 could PATCH themselves two achievements — in a
 * product whose plan says achievements are never for sale (§1). The whole
 * weekly-streak tuple is therefore server-owned.
 *
 * Everything below is a request and a status code. Asserting that the guard
 * lists a field name would prove only that somebody typed a string (LESSONS §5).
 */

const STREAK_FIELDS = {
  streak: 9999,
  rides_this_week: 9999,
  week_start: '2026-08-10',
  last_qualifying_week: '2026-08-10',
  last_ride: '2026-08-16 09:00:00.000Z',
} as const;

describe('the weekly streak is server-owned (issue #8)', () => {
  it.each(Object.entries(STREAK_FIELDS))(
    'refuses a rider patching their own %s',
    async (field, value) => {
      const rider = await makeRider();

      const patched = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
        token: rider.token,
        body: { [field]: value },
      });

      expect(patched.status).toBe(403);
    },
  );

  it('refuses a streak smuggled in alongside a change the rider may make', async () => {
    const rider = await makeRider();

    const patched = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      token: rider.token,
      body: { town: 'Bristol', streak: 40 },
    });

    expect(patched.status).toBe(403);

    // And the legitimate half did not land either — the guard runs before the
    // write, so the whole request is refused rather than half-applied.
    const after = await call<{ town: string; streak: number }>(
      'GET',
      `/api/collections/users/records/${rider.id}`,
      { token: rider.token },
    );
    expect(after.body.town).not.toBe('Bristol');
    expect(after.body.streak).toBe(0);
  });

  it('ignores a streak offered at sign-up', async () => {
    // The rider asks to be created mid-streak. The guard pins the defaults, so
    // sign-up succeeds and the streak does not.
    const rider = await makeRider({ streak: 500, rides_this_week: 12 });

    const record = await call<{ streak: number; rides_this_week: number }>(
      'GET',
      `/api/collections/users/records/${rider.id}`,
      { token: rider.token },
    );

    expect(record.body.streak).toBe(0);
    expect(record.body.rides_this_week).toBe(0);
  });

  it('still lets the rider change what is genuinely theirs', async () => {
    const rider = await makeRider();

    const patched = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      token: rider.token,
      body: { town: 'Bristol', stance: 'goofy' },
    });

    expect(patched.status).toBe(200);
  });

  it('lets server code write the streak, which is how it is written at all', async () => {
    const rider = await makeRider();

    const patched = await call<{ streak: number; last_qualifying_week: string }>(
      'PATCH',
      `/api/collections/users/records/${rider.id}`,
      { token: await superuser(), body: { streak: 3, last_qualifying_week: '2026-08-10' } },
    );

    expect(patched.status).toBe(200);
    expect(patched.body.streak).toBe(3);
    expect(patched.body.last_qualifying_week).toBe('2026-08-10');
  });
});

describe('the weekly-streak fields exist (issue #9)', () => {
  it('stores the whole WeeklyStreakState tuple', async () => {
    const rider = await makeRider();

    // Written the only way it can be: by server code holding a superuser token.
    const written = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      token: await superuser(),
      body: {
        streak: 2,
        week_start: '2026-08-10',
        rides_this_week: 1,
        last_qualifying_week: '2026-08-03',
      },
    });
    expect(written.status).toBe(200);

    const read = await call<Record<string, unknown>>(
      'GET',
      `/api/collections/users/records/${rider.id}`,
      { token: rider.token },
    );

    expect(read.body).toMatchObject({
      streak: 2,
      week_start: '2026-08-10',
      rides_this_week: 1,
      last_qualifying_week: '2026-08-03',
    });
  });

  it('rejects a week key that is not a calendar day', async () => {
    const rider = await makeRider();

    const written = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      token: await superuser(),
      body: { week_start: 'last tuesday' },
    });

    expect(written.status).toBe(400);
  });
});
