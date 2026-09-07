import { describe, expect, it } from 'vitest';

import { call, makeRider, superuser } from './helpers';

/**
 * `users.last_seen` — the stamp the staff Riders table reads.
 *
 * That column was headed "Last active" and showed `last_ride`, so a rider who
 * used the app daily and never tapped "I rode today" read as an account nobody
 * had opened. This field answers the question the heading was asking.
 *
 * Everything below is a request and a status code. Asserting that the guard
 * lists a field name would prove only that somebody typed a string
 * (LESSONS §5), and asserting that the hook file contains the word "stamp"
 * would prove less than that.
 */

const password = 'a-long-local-test-password';

const ISO_ISH = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/;

/** The stamp as the server holds it, read with a token that may see it. */
async function lastSeenOf(id: string): Promise<string> {
  const record = await call<{ last_seen: string }>('GET', `/api/collections/users/records/${id}`, {
    token: await superuser(),
  });
  expect(record.status).toBe(200);
  return record.body.last_seen;
}

/** The session refresh the web app makes on every server render of a page. */
function refresh(token: string) {
  return call('POST', '/api/collections/users/auth-refresh', { token });
}

describe('last_seen is written by the server, on authentication', () => {
  it('is empty on a freshly created account, before anybody signs in', async () => {
    // Created the way sign-up creates one, and deliberately not signed into:
    // `makeRider` authenticates, which is the thing under test here.
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(-12);
    const created = await call<{ id: string }>('POST', '/api/collections/users/records', {
      body: {
        email: `unseen-${suffix}@landit.invalid`,
        password,
        passwordConfirm: password,
        name: 'Unseen Rider',
        handle: `unseen${suffix}`,
        country: 'GB',
        age_band: 'adult',
        // Offered at sign-up, and pinned away by the guard: an account cannot
        // arrive claiming to have been here already.
        last_seen: '2020-01-01 00:00:00.000Z',
      },
    });
    expect(created.status).toBe(200);

    expect(await lastSeenOf(created.body.id)).toBe('');
  });

  it('is stamped when a rider signs in', async () => {
    const rider = await makeRider();

    const stamp = await lastSeenOf(rider.id);
    expect(stamp).toMatch(ISO_ISH);

    // Recent, not merely present: a default value would also be a non-empty
    // string. Ten minutes is loose enough for a slow CI box and far tighter
    // than anything a stale or fixed value could pass through.
    const age = Date.now() - Date.parse(stamp);
    expect(age).toBeLessThan(10 * 60 * 1000);
    expect(age).toBeGreaterThanOrEqual(0);
  });

  it('is stamped by a session refresh, which is what makes it "used the app"', async () => {
    const rider = await makeRider();

    // Wound back past the throttle, as the server: the state of a rider who
    // signed in an hour ago and has just opened a page.
    const backdated = '2026-08-01 09:00:00.000Z';
    const wound = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      token: await superuser(),
      body: { last_seen: backdated },
    });
    expect(wound.status).toBe(200);

    // No sign-in and no password — this is the whole difference between
    // "last used the app" and "last tapped one button".
    expect((await refresh(rider.token)).status).toBe(200);

    const stamp = await lastSeenOf(rider.id);
    expect(stamp).not.toBe(backdated);
    expect(Date.now() - Date.parse(stamp)).toBeLessThan(10 * 60 * 1000);
  });

  it('does not rewrite the stamp on every refresh — the 15-minute throttle', async () => {
    const rider = await makeRider();
    const first = await lastSeenOf(rider.id);
    expect(first).toMatch(ISO_ISH);

    // Three more refreshes, immediately. `users` is the hottest collection in
    // the app and the web app refreshes on every server render, so an
    // unthrottled stamp is a database write per page view.
    for (let i = 0; i < 3; i += 1) {
      expect((await refresh(rider.token)).status).toBe(200);
    }

    expect(await lastSeenOf(rider.id)).toBe(first);
  });

  it('treats a future stamp as due, rather than trusting it', async () => {
    const rider = await makeRider();

    // A clock that ran ahead once must not freeze the column for good.
    const wound = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      token: await superuser(),
      body: { last_seen: '2099-01-01 00:00:00.000Z' },
    });
    expect(wound.status).toBe(200);

    expect((await refresh(rider.token)).status).toBe(200);

    const stamp = await lastSeenOf(rider.id);
    expect(Date.parse(stamp)).toBeLessThan(Date.parse('2099-01-01T00:00:00.000Z'));
  });
});

describe('last_seen is server-owned (owner grant, 2026-09-07)', () => {
  it('refuses a rider patching their own stamp', async () => {
    const rider = await makeRider();

    const patched = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      token: rider.token,
      body: { last_seen: '2020-01-01 00:00:00.000Z' },
    });

    expect(patched.status).toBe(403);
  });

  it('refuses a stamp smuggled in alongside a change the rider may make', async () => {
    const rider = await makeRider();
    const before = await lastSeenOf(rider.id);

    const patched = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      token: rider.token,
      body: { town: 'Bristol', last_seen: '2020-01-01 00:00:00.000Z' },
    });
    expect(patched.status).toBe(403);

    // The legitimate half did not land either: the guard runs before the write,
    // so the whole request is refused rather than half-applied.
    const after = await call<{ town: string }>(
      'GET',
      `/api/collections/users/records/${rider.id}`,
      {
        token: rider.token,
      },
    );
    expect(after.body.town).not.toBe('Bristol');
    expect(await lastSeenOf(rider.id)).toBe(before);
  });
});

describe('last_seen is inside the account guarantees', () => {
  it('is written into the rider’s own data export', async () => {
    const rider = await makeRider();

    const mine = await call<{ account: Record<string, unknown> }>(
      'POST',
      '/api/landit/account/export',
      { token: rider.token, body: {} },
    );
    expect(mine.status).toBe(200);

    // Spelled out in words like every other date in the download, not as a
    // machine stamp. A rider is entitled to know we hold this.
    expect(mine.body.account.last_seen).toMatch(/^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} UTC$/);
  });

  it('is cleared when the account is erased', async () => {
    const rider = await makeRider();
    expect(await lastSeenOf(rider.id)).toMatch(ISO_ISH);

    const gone = await call('POST', '/api/landit/account/delete', {
      token: rider.token,
      body: { password, confirm: 'DELETE' },
    });
    expect(gone.status).toBe(200);

    // The row survives erasure by design — anonymise-and-retain — so a stamp
    // left on it would be a record of when a closed account was last used.
    expect(await lastSeenOf(rider.id)).toBe('');
  });
});
