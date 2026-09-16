import { describe, expect, it } from 'vitest';

import { call, makeRider, superuser } from './helpers';

/**
 * `users.whats_new_seen_at` — the one field What's new stores (rethink §6).
 *
 * It is the rider's own bookmark in their own news, so it is **own-write**:
 * deliberately absent from the frozen lists in `hooks/lib/landit.js`, and
 * refused on anybody else's record by `users.updateRule`.
 *
 * Every assertion below is a request and a status code, not a reading of the
 * guard's source: a test that asserts a field name is missing from a list
 * proves only that somebody typed a string (LESSONS §5).
 *
 * **Which door each test stands in matters here**, because the two mechanisms
 * are different and a session tightening one should see the right test go red.
 * `users.updateRule` is `id = @request.auth.id`, so another rider's record 404s
 * before a hook runs — which is why the cross-rider tests below assert the 404
 * *and* the unchanged value, rather than only the refusal.
 */

const ISO_ISH = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/;

const STAMP = '2026-09-16 12:00:00.000Z';

/** The stamp as the server holds it, read with a token that may see it. */
async function seenAtOf(id: string): Promise<string> {
  const record = await call<{ whats_new_seen_at: string }>(
    'GET',
    `/api/collections/users/records/${id}`,
    { token: await superuser() },
  );
  expect(record.status).toBe(200);
  return record.body.whats_new_seen_at;
}

describe('a rider owns their own What’s new bookmark', () => {
  it('starts empty, so a new rider’s whole feed is unseen', async () => {
    const rider = await makeRider();
    expect(await seenAtOf(rider.id)).toBe('');
  });

  it('is written by the rider, with their own token', async () => {
    const rider = await makeRider();

    const patched = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      token: rider.token,
      body: { whats_new_seen_at: STAMP },
    });
    expect(patched.status).toBe(200);

    expect(await seenAtOf(rider.id)).toMatch(ISO_ISH);
    expect(Date.parse(await seenAtOf(rider.id))).toBe(Date.parse('2026-09-16T12:00:00.000Z'));
  });

  it('can be moved again, because reading the panel twice is two bookmarks', async () => {
    const rider = await makeRider();

    for (const stamp of ['2026-09-16 12:00:00.000Z', '2026-09-17 09:30:00.000Z']) {
      const patched = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
        token: rider.token,
        body: { whats_new_seen_at: stamp },
      });
      expect(patched.status).toBe(200);
    }

    expect(Date.parse(await seenAtOf(rider.id))).toBe(Date.parse('2026-09-17T09:30:00.000Z'));
  });

  it('does not drag a frozen field along with it', async () => {
    const rider = await makeRider();

    // The guard runs before the write and refuses the whole request, so the
    // half a rider may make does not land either. This is the assertion that
    // says the new field did not widen the guard.
    const patched = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      token: rider.token,
      body: { whats_new_seen_at: STAMP, streak: 99 },
    });
    expect(patched.status).toBe(403);

    expect(await seenAtOf(rider.id)).toBe('');
  });
});

describe('a rider cannot set anybody else’s bookmark', () => {
  it('refuses a rider patching another rider’s stamp, and changes nothing', async () => {
    const [mine, theirs] = await Promise.all([makeRider(), makeRider()]);

    const patched = await call('PATCH', `/api/collections/users/records/${theirs.id}`, {
      token: mine.token,
      body: { whats_new_seen_at: STAMP },
    });

    /*
     * 404 rather than 403, and named here on purpose: `users.updateRule` is
     * `id = @request.auth.id`, so another rider's record is not found rather
     * than forbidden. A test asserting "not 200" would also pass against a rule
     * that had been loosened to `viewer` and a guard that happened to refuse —
     * two different mechanisms, one of which is not this field's.
     */
    expect(patched.status).toBe(404);
    expect(await seenAtOf(theirs.id)).toBe('');
  });

  it('refuses an unauthenticated write', async () => {
    const rider = await makeRider();

    const patched = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      body: { whats_new_seen_at: STAMP },
    });

    expect(patched.status).toBe(404);
    expect(await seenAtOf(rider.id)).toBe('');
  });
});

describe('the bookmark is inside the account guarantees', () => {
  it('is written into the rider’s own data export', async () => {
    const rider = await makeRider();
    expect(
      (
        await call('PATCH', `/api/collections/users/records/${rider.id}`, {
          token: rider.token,
          body: { whats_new_seen_at: STAMP },
        })
      ).status,
    ).toBe(200);

    const mine = await call<{ account: Record<string, unknown> }>(
      'POST',
      '/api/landit/account/export',
      { token: rider.token, body: {} },
    );
    expect(mine.status).toBe(200);

    // Spelled out in words like every other date in the download, not as a
    // machine stamp. A rider is entitled to know we hold this.
    expect(mine.body.account.whats_new_seen_at).toMatch(
      /^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} UTC$/,
    );
  });

  it('is cleared when the account is erased', async () => {
    const password = 'a-long-local-test-password';
    const rider = await makeRider();
    expect(
      (
        await call('PATCH', `/api/collections/users/records/${rider.id}`, {
          token: rider.token,
          body: { whats_new_seen_at: STAMP },
        })
      ).status,
    ).toBe(200);
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
