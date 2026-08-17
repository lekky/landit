import { describe, expect, it } from 'vitest';

import { call, makeRider, superuser } from './helpers';

/**
 * What a staff account can do over the API, observed rather than read off a
 * rule (plan §3, LESSONS §5).
 *
 * T16 puts the whole staff portal behind one field — `users.role` — and every
 * write it makes goes through a server-held superuser client rather than
 * through the staff member's own token. That design only holds if the role is
 * genuinely **not a credential**: if a staff token could patch a plan or read
 * the audit log directly, the portal's server actions would be a formality and
 * anybody who took a staff session could act without leaving a staff-attributed
 * row behind.
 *
 * **Two different mechanisms refuse these, and the tests say which.** Removing
 * the frozen-field branch from `guardUserWrite` in
 * `pocketbase/hooks/lib/landit.js` turns exactly one of them red — the staff
 * member editing *their own* row. The other three were never the guard's to
 * refuse: `users.updateRule` is `id = @request.auth.id`, so another rider's
 * record 404s to a staff token before a hook runs at all.
 *
 * That distinction was found by running the suite against a deliberately
 * disabled guard and watching only one test move (LESSONS §5). It matters,
 * because the cross-rider tests would otherwise have passed against a
 * completely open guard and been read as proving it. They assert the refusal
 * status as well as the unchanged field, so widening the update rule breaks
 * them too — between them the two assertions cover both doors.
 */

/** A rider whose `role` really is `staff` — set the only way it can be set. */
async function makeStaff() {
  return makeRider({}, { role: 'staff', consent_state: 'not_required' });
}

describe('a staff role is not a credential', () => {
  it('does not let a staff member raise their own plan', async () => {
    const staff = await makeStaff();

    const attempt = await call('PATCH', `/api/collections/users/records/${staff.id}`, {
      token: staff.token,
      body: { plan: 'legend' },
    });

    // The guard answers 200 and drops the field rather than refusing the whole
    // request — a profile edit that also carried a plan should still save the
    // name. What matters is what is stored, so that is what is asserted.
    const after = await call<{ plan: string }>(
      'GET',
      `/api/collections/users/records/${staff.id}`,
      {
        token: await superuser(),
      },
    );
    expect(after.body.plan).toBe('rookie');
    expect([200, 400, 403]).toContain(attempt.status);
  });

  it('does not let a staff member change another rider’s plan', async () => {
    const staff = await makeStaff();
    const rider = await makeRider();

    const attempt = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      token: staff.token,
      body: { plan: 'shredder' },
    });
    // 404, not 403: another rider's record is not merely closed to writing, it
    // is not there. That is `users.updateRule`, and asserting it is what stops
    // this test passing against a guard that had stopped guarding.
    expect(attempt.status).toBe(404);

    const after = await call<{ plan: string }>(
      'GET',
      `/api/collections/users/records/${rider.id}`,
      {
        token: await superuser(),
      },
    );
    expect(after.body.plan).toBe('rookie');
  });

  it('does not let a staff member suspend another rider', async () => {
    const staff = await makeStaff();
    const rider = await makeRider();

    const attempt = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      token: staff.token,
      body: { suspended: true },
    });
    expect(attempt.status).toBe(404);

    const after = await call<{ suspended: boolean }>(
      'GET',
      `/api/collections/users/records/${rider.id}`,
      { token: await superuser() },
    );
    expect(after.body.suspended).toBe(false);

    // And the rider can still sign in, which is the consequence that would
    // actually be felt.
    const signIn = await call('POST', '/api/collections/users/auth-with-password', {
      body: { identity: rider.email, password: rider.password },
    });
    expect(signIn.status).toBe(200);
  });

  it('does not let a staff member promote anybody else to staff', async () => {
    const staff = await makeStaff();
    const rider = await makeRider();

    const attempt = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      token: staff.token,
      body: { role: 'staff' },
    });
    expect(attempt.status).toBe(404);

    const after = await call<{ role: string }>(
      'GET',
      `/api/collections/users/records/${rider.id}`,
      {
        token: await superuser(),
      },
    );
    expect(after.body.role).toBe('rider');
  });

  it('does not let a staff member read the audit log', async () => {
    const staff = await makeStaff();

    // 403, the same answer an ordinary rider gets (`schema-and-hooks.test.ts`).
    // A `listRule: null` collection is closed to everybody but a superuser, and
    // the role buys nothing: reading the log needs the server's own client.
    const list = await call('GET', '/api/collections/audit_log/records', { token: staff.token });
    expect(list.status).toBe(403);
  });
});

describe('the audit floor under every staff change', () => {
  /**
   * The portal's server action writes a staff-attributed row *after* the
   * mutation, over HTTP, so the two are not one transaction. What makes that
   * acceptable is this: the hook writes its own row **inside** the write, so a
   * change can never land with nothing recorded — the worst case is a row that
   * names the superuser rather than the person. This is that claim, tested.
   */
  it('records a plan change made with a superuser token, unprompted', async () => {
    const rider = await makeRider();
    const token = await superuser();

    const patch = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      token,
      body: { plan: 'shredder' },
    });
    expect(patch.status).toBe(200);

    const rows = await call<{ items: { action: string; entity: string; after: unknown }[] }>(
      'GET',
      '/api/collections/audit_log/records',
      {
        token,
        query: {
          filter: `entity = "users" && entity_id = "${rider.id}"`,
          sort: '-created',
          perPage: '10',
        },
      },
    );

    expect(rows.status).toBe(200);
    const changed = rows.body.items.filter(
      (row) => (row.after as { plan?: string } | null)?.plan === 'shredder',
    );
    expect(changed.length).toBeGreaterThan(0);
  });

  it('does not record a write that touched none of the four watched fields', async () => {
    const rider = await makeRider();
    const token = await superuser();

    const before = await call<{ totalItems: number }>('GET', '/api/collections/audit_log/records', {
      token,
      query: { filter: `entity = "users" && entity_id = "${rider.id}"`, perPage: '1' },
    });

    await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      token,
      body: { town: 'Coventry' },
    });

    const after = await call<{ totalItems: number }>('GET', '/api/collections/audit_log/records', {
      token,
      query: { filter: `entity = "users" && entity_id = "${rider.id}"`, perPage: '1' },
    });

    // A log that recorded every profile edit would bury the four fields it
    // exists for. This is the hook's `changed` check, observed.
    expect(after.body.totalItems).toBe(before.body.totalItems);
  });
});
