import { describe, expect, it } from 'vitest';

import { call, makeRider, superuser } from './helpers';

/**
 * `users.stickers_seen_at` — when this rider last opened their sticker wall
 * (2026-09-18), and the whole of what the library's sticker shelf stores.
 *
 * The same shape as `whats_new_seen_at` beside it, so this file stands in the
 * same doors as `whats-new-seen.test.ts`: pinned empty on create, written by
 * its owner with their own token, refused on anybody else's record by
 * `users.updateRule`, and inside the account guarantees at both ends.
 *
 * Every assertion is a request and a status code rather than a reading of the
 * guard's source — a test that asserts a field name is absent from a list
 * proves only that somebody typed a string (LESSONS §5). And the cross-rider
 * cases assert the 404 *and* the unchanged value, because 404 is the rule
 * refusing before any hook runs, which is a different mechanism from the
 * guard's 403 and a session tightening either should see the right test go red.
 */

const password = 'a-long-local-test-password';

const ISO_ISH = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/;

const STAMP = '2026-09-18 12:00:00.000Z';

/** The stamp as the server holds it, read with a token that may see it. */
async function seenAtOf(id: string): Promise<string> {
  const record = await call<{ stickers_seen_at: string }>(
    'GET',
    `/api/collections/users/records/${id}`,
    { token: await superuser() },
  );
  expect(record.status).toBe(200);
  return record.body.stickers_seen_at;
}

describe('a rider owns their own sticker-wall bookmark', () => {
  it('starts empty, so a new rider has seen nothing', async () => {
    // Which is what makes the shelf's flag honest on a first visit: every
    // award a rider holds is one they have not been to the wall to look at.
    const rider = await makeRider();
    expect(await seenAtOf(rider.id)).toBe('');
  });

  it('cannot arrive already set, however the sign-up was shaped', async () => {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(-12);
    const created = await call<{ id: string }>('POST', '/api/collections/users/records', {
      body: {
        email: `wall-${suffix}@landit.invalid`,
        password,
        passwordConfirm: password,
        name: 'Wall Rider',
        handle: `wall${suffix}`,
        country: 'GB',
        age_band: 'adult',
        stickers_seen_at: '2099-01-01 00:00:00.000Z',
      },
    });
    expect(created.status).toBe(200);

    expect(await seenAtOf(created.body.id)).toBe('');
  });

  it('is written by the rider, with their own token', async () => {
    const rider = await makeRider();

    const patched = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      token: rider.token,
      body: { stickers_seen_at: STAMP },
    });
    expect(patched.status).toBe(200);

    expect(Date.parse(await seenAtOf(rider.id))).toBe(Date.parse('2026-09-18T12:00:00.000Z'));
  });

  it('can be moved again, because visiting the wall twice is two visits', async () => {
    const rider = await makeRider();

    for (const stamp of ['2026-09-18 12:00:00.000Z', '2026-09-19 09:30:00.000Z']) {
      const patched = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
        token: rider.token,
        body: { stickers_seen_at: stamp },
      });
      expect(patched.status).toBe(200);
    }

    expect(Date.parse(await seenAtOf(rider.id))).toBe(Date.parse('2026-09-19T09:30:00.000Z'));
  });

  it('does not drag a frozen field along with it', async () => {
    const rider = await makeRider();

    // The assertion that says the new field did not widen the guard: the whole
    // request is refused before the write, so the half a rider may make does
    // not land either.
    const patched = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      token: rider.token,
      body: { stickers_seen_at: STAMP, streak: 99 },
    });
    expect(patched.status).toBe(403);

    expect(await seenAtOf(rider.id)).toBe('');
  });
});

describe('a rider cannot set anybody else’s sticker-wall bookmark', () => {
  it('refuses a rider patching another rider’s stamp, and changes nothing', async () => {
    const [mine, theirs] = await Promise.all([makeRider(), makeRider()]);

    const patched = await call('PATCH', `/api/collections/users/records/${theirs.id}`, {
      token: mine.token,
      body: { stickers_seen_at: STAMP },
    });

    // 404, not 403: `users.updateRule` is `id = @request.auth.id`, so another
    // rider's record is not found rather than forbidden.
    expect(patched.status).toBe(404);
    expect(await seenAtOf(theirs.id)).toBe('');
  });

  it('refuses an unauthenticated write', async () => {
    const rider = await makeRider();

    const patched = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      body: { stickers_seen_at: STAMP },
    });

    expect(patched.status).toBe(404);
    expect(await seenAtOf(rider.id)).toBe('');
  });
});

describe('the sticker-wall bookmark is inside the account guarantees', () => {
  const stamp = async (rider: { id: string; token: string }) => {
    const patched = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      token: rider.token,
      body: { stickers_seen_at: STAMP },
    });
    expect(patched.status).toBe(200);
  };

  it('is written into the rider’s own data export', async () => {
    const rider = await makeRider();
    await stamp(rider);

    const mine = await call<{ account: Record<string, unknown> }>(
      'POST',
      '/api/landit/account/export',
      { token: rider.token, body: {} },
    );
    expect(mine.status).toBe(200);

    // In words, like every other date in the download. A rider is entitled to
    // know we hold this one too.
    expect(mine.body.account.stickers_seen_at).toMatch(
      /^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} UTC$/,
    );
  });

  it('is cleared when the account is erased', async () => {
    const rider = await makeRider();
    await stamp(rider);
    expect(await seenAtOf(rider.id)).toMatch(ISO_ISH);

    const gone = await call('POST', '/api/landit/account/delete', {
      token: rider.token,
      body: { password, confirm: 'DELETE' },
    });
    expect(gone.status).toBe(200);

    // The row survives erasure by design — anonymise-and-retain — so a stamp
    // left on it would be a record of when a closed account was last used.
    expect(await seenAtOf(rider.id)).toBe('');
  });
});
