import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { baseFixtures, call, makeRider, superuser } from './helpers';

/**
 * Export and erasure (T18; plan §6.5).
 *
 * **Deletion is anonymise-and-retain** — owner decision, Rachid, 2026-08-17, in
 * chat. That is not the obvious reading of "delete my account", so the tests
 * below are written to pin both halves: what has to be *gone* afterwards, and
 * what has to still be *there*. A change that quietly turned this into a hard
 * delete would take the child-safety trail with it and pass every test that
 * only checked the first half.
 *
 * Both routes are exercised with a rider's own token over HTTP, because a rule
 * proven by reading the client is not proven (plan §3).
 */

interface ExportPayload {
  account: Record<string, unknown>;
  trick_progress: { trick: string; stage: string; updated: string }[];
  trick_log: { trick: string; stage: string; at: string }[];
  trick_notes: { trick: string; body: string }[];
  clips: { trick: string; video_id: string; video_url: string }[];
  reports_filed: { detail: string }[];
  guardian_consents: Record<string, unknown>[];
  message?: string;
}

const exportFor = (token: string) =>
  call<ExportPayload>('POST', '/api/landit/account/export', { token, body: {} });

const deleteAccount = (token: string, body: Record<string, unknown>) =>
  call<{ deleted: boolean; pseudonym: string; records_removed: number; message: string }>(
    'POST',
    '/api/landit/account/delete',
    { token, body },
  );

const password = 'a-long-local-test-password';

describe('taking your data with you', () => {
  it('hands back the rider’s own records and nobody else’s', async () => {
    const fixtures = await baseFixtures();
    const rider = await makeRider();
    const stranger = await makeRider();

    await call('POST', '/api/collections/trick_progress/records', {
      token: rider.token,
      body: { user: rider.id, trick: fixtures.freeTrick, stage: 'some' },
    });
    await call('POST', '/api/collections/trick_notes/records', {
      token: rider.token,
      body: { user: rider.id, trick: fixtures.freeTrick, body: 'Land it with the knees bent.' },
    });
    await call('POST', '/api/collections/trick_progress/records', {
      token: stranger.token,
      body: { user: stranger.id, trick: fixtures.freeTrick, stage: 'most' },
    });

    const mine = await exportFor(rider.token);
    expect(mine.status).toBe(200);
    expect(mine.body.account.id).toBe(rider.id);
    expect(mine.body.trick_progress).toHaveLength(1);
    expect(mine.body.trick_notes[0]?.body).toBe('Land it with the knees bent.');

    // There is no account parameter on the route at all: the subject is the
    // token holder and only the token holder.
    const serialised = JSON.stringify(mine.body);
    expect(serialised).not.toContain(stranger.id);
    expect(serialised).not.toContain(stranger.email);
  });

  it('is written in words a rider can read, not in row ids', async () => {
    // Until 2026-08-30 this route answered a subject access request in database
    // keys — `"trick": "mew7o75ag0ig9jy"` on every row of a rider's history —
    // which is complete without being intelligible. Owner decision, in chat, on
    // the readability of the download itself.
    const fixtures = await baseFixtures();
    const rider = await makeRider();

    await call('POST', '/api/collections/trick_progress/records', {
      token: rider.token,
      body: { user: rider.id, trick: fixtures.freeTrick, stage: 'some' },
    });
    // Written explicitly: a `trick_progress` write does not leave a `trick_log`
    // row behind, and both lists resolve their trick separately.
    const logged = await call('POST', '/api/collections/trick_log/records', {
      token: rider.token,
      body: {
        user: rider.id,
        trick: fixtures.freeTrick,
        stage: 'some',
        at: '2026-08-18 16:31:37.983Z',
      },
    });
    expect(logged.status).toBe(200);

    const mine = await exportFor(rider.token);
    expect(mine.status).toBe(200);

    // The trick is named, and the stage is the words the app puts on screen.
    expect(mine.body.trick_progress[0]?.trick).toBe('Fixture Bunny Hop');
    expect(mine.body.trick_progress[0]?.stage).toBe('Sometimes');
    expect(mine.body.trick_log[0]?.trick).toBe('Fixture Bunny Hop');
    expect(mine.body.trick_log[0]?.at).toBe('18 Aug 2026, 16:31 UTC');

    // `users.plan` holds a slug; the download says what the plan is called.
    expect(mine.body.account.plan).toBe('Rookie');

    // Every timestamp, spelled out. The account was made moments ago, so
    // `created` is the one date a fresh rider is guaranteed to have.
    expect(mine.body.account.created).toMatch(/^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} UTC$/);
    expect(mine.body.trick_progress[0]?.updated).toMatch(
      /^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} UTC$/,
    );

    // The catalogue id is gone from the body entirely — not merely replaced on
    // the row the assertions above happen to read.
    const serialised = JSON.stringify(mine.body);
    expect(serialised).not.toContain(fixtures.freeTrick);

    // The one id that stays, because it is the number to quote when writing to
    // us about this file, and it is already public on the rider's profile.
    expect(mine.body.account.id).toBe(rider.id);
  });

  it('is refused signed out', async () => {
    expect((await call('POST', '/api/landit/account/export', { body: {} })).status).toBe(401);
  });

  it('leaves out reports filed *about* the rider', async () => {
    const rider = await makeRider();
    const accuser = await makeRider();

    const about = await call<{ id: string }>('POST', '/api/collections/reports/records', {
      token: accuser.token,
      body: {
        subject_type: 'profile',
        subject_id: rider.id,
        reason: 'harassment',
        detail: 'A thing that was said.',
      },
    });
    expect(about.status).toBe(200);

    const mine = await exportFor(rider.token);
    expect(mine.status).toBe(200);
    // A subject access request is not a way to find out who reported you.
    expect(JSON.stringify(mine.body)).not.toContain('A thing that was said.');
    expect(mine.body.reports_filed).toHaveLength(0);
  });

  it('refuses the sixth download in an hour', async () => {
    const rider = await makeRider();
    for (let i = 0; i < 5; i += 1) expect((await exportFor(rider.token)).status).toBe(200);
    expect((await exportFor(rider.token)).status).toBe(429);
  });
});

describe('ending an account', () => {
  it('needs the password and the typed word, and changes nothing without both', async () => {
    const rider = await makeRider();

    expect((await deleteAccount(rider.token, { password, confirm: 'yes' })).status).toBe(400);
    expect(
      (await deleteAccount(rider.token, { password: 'wrong', confirm: 'DELETE' })).status,
    ).toBe(400);

    // Still signed in, still themselves.
    const still = await call<{ handle: string }>(
      'GET',
      `/api/collections/users/records/${rider.id}`,
      { token: rider.token },
    );
    expect(still.status).toBe(200);
    expect(still.body.handle).toBe(rider.handle);
  });

  it('is refused signed out', async () => {
    expect(
      (await call('POST', '/api/landit/account/delete', { body: { password, confirm: 'DELETE' } }))
        .status,
    ).toBe(401);
  });

  it('wipes the rider, their content and their session', async () => {
    const fixtures = await baseFixtures();
    const rider = await makeRider();

    await call('POST', '/api/collections/trick_progress/records', {
      token: rider.token,
      body: { user: rider.id, trick: fixtures.freeTrick, stage: 'some' },
    });
    await call('POST', '/api/collections/trick_notes/records', {
      token: rider.token,
      body: { user: rider.id, trick: fixtures.freeTrick, body: 'A private note.' },
    });

    const gone = await deleteAccount(rider.token, { password, confirm: 'DELETE' });
    expect(gone.status).toBe(200);
    expect(gone.body.pseudonym).toMatch(/^exrider_[0-9a-f]{8}$/);
    expect(gone.body.records_removed).toBeGreaterThanOrEqual(2);

    // Every token the caller held stops working — `refreshTokenKey`, not just a
    // new password.
    expect((await exportFor(rider.token)).status).toBe(401);
    expect(
      (
        await call('POST', '/api/collections/users/auth-with-password', {
          body: { identity: rider.email, password },
        })
      ).status,
    ).toBe(400);

    const token = await superuser();
    const after = await call<Record<string, string>>(
      'GET',
      `/api/collections/users/records/${rider.id}`,
      { token },
    );
    expect(after.status).toBe(200);
    expect(after.body.handle).toBe(gone.body.pseudonym);
    expect(after.body.name).toBe('');
    expect(after.body.email).not.toBe(rider.email);
    expect(after.body.privacy).toBe('private');
    expect(after.body.suspended).toBe(true);
    expect(after.body.anonymised_at).toBeTruthy();

    const notes = await call<{ totalItems: number }>(
      'GET',
      '/api/collections/trick_notes/records',
      {
        token,
        query: { filter: `user = "${rider.id}"` },
      },
    );
    expect(notes.body.totalItems).toBe(0);
  });

  it('keeps the safeguarding trail, with the identity reduced to a pseudonym', async () => {
    const rider = await makeRider();
    const token = await superuser();

    // Something they reported, and something reported about them.
    const filed = await call<{ id: string }>('POST', '/api/collections/reports/records', {
      token: rider.token,
      body: { subject_type: 'spot', reason: 'unsafe', detail: 'The coping is loose.' },
    });
    expect(filed.status).toBe(200);

    const accuser = await makeRider();
    const against = await call<{ id: string }>('POST', '/api/collections/reports/records', {
      token: accuser.token,
      body: {
        subject_type: 'profile',
        subject_id: rider.id,
        reason: 'harassment',
        detail: 'Kept turning up on my board.',
      },
    });
    expect(against.status).toBe(200);

    const gone = await deleteAccount(rider.token, { password, confirm: 'DELETE' });
    expect(gone.status).toBe(200);

    // Both reports survive. The one *about* them still names the account, which
    // is the whole point of anonymise-and-retain: a service whose moderation
    // record can be erased by the person it is about has no moderation record.
    const kept = await call<{ subject_id: string; detail: string }>(
      'GET',
      `/api/collections/reports/records/${against.body.id}`,
      { token },
    );
    expect(kept.status).toBe(200);
    expect(kept.body.subject_id).toBe(rider.id);

    const theirs = await call<{ reporter: string; reporter_email: string; detail: string }>(
      'GET',
      `/api/collections/reports/records/${filed.body.id}`,
      { token },
    );
    expect(theirs.status).toBe(200);
    expect(theirs.body.reporter).toBe(rider.id);
    expect(theirs.body.detail).toBe('The coping is loose.');

    // And the audit trail is relabelled rather than emptied.
    const trail = await call<{ items: { action: string; actor_label: string }[] }>(
      'GET',
      '/api/collections/audit_log/records',
      { token, query: { filter: `actor = "${rider.id}"`, perPage: '200' } },
    );
    expect(trail.status).toBe(200);
    expect(trail.body.items.length).toBeGreaterThan(0);
    for (const row of trail.body.items) expect(row.actor_label).toBe(gone.body.pseudonym);
    expect(trail.body.items.some((row) => row.action === 'account_anonymised')).toBe(true);
  });

  it('cannot be blocked by somebody squatting the pseudonym', async () => {
    // Found by the security review of this branch. The pseudonym is derived from
    // the account id, the account id is public (it is in the "Report this
    // profile" link), and sign-up is open — so a stranger can compute the handle
    // and email a given rider's erasure will want, and take them first with a
    // free account. With the deletions running first, that turned an erasure
    // into: every trick, note and sticker destroyed, name and email and working
    // password intact, permanently, because every retry failed the same way.
    const victim = await makeRider();
    const pseudonym = `exrider_${createHash('sha256').update(victim.id).digest('hex').slice(0, 8)}`;

    // The squatter takes both unique columns the erasure wants.
    const squatter = await call('POST', '/api/collections/users/records', {
      body: {
        email: `erased-${pseudonym}@landthetrick.invalid`,
        password,
        passwordConfirm: password,
        name: 'Squatter',
        handle: pseudonym,
        country: 'GB',
        age_band: 'adult',
      },
    });
    expect(squatter.status).toBe(200);

    const gone = await deleteAccount(victim.token, { password, confirm: 'DELETE' });
    expect(gone.status).toBe(200);
    // Stepped around, not collided with — and the audit trail is labelled with
    // the name that actually stuck rather than the one that was taken.
    expect(gone.body.pseudonym).not.toBe(pseudonym);
    expect(gone.body.pseudonym).toMatch(/^exrider_[0-9a-f]{8}/);

    const token = await superuser();
    const after = await call<Record<string, string>>(
      'GET',
      `/api/collections/users/records/${victim.id}`,
      { token },
    );
    expect(after.body.handle).toBe(gone.body.pseudonym);
    expect(after.body.name).toBe('');
    expect(after.body.anonymised_at).toBeTruthy();
  });

  it('will not let an account stamp itself erased and skip the wipe', async () => {
    // Also from the security review. `users.updateRule` lets a rider PATCH their
    // own record, and the delete route reads `anonymised_at` to decide it has
    // nothing to do — so a stamp the client could write would turn erasure into
    // a no-op that reports success. The account screen clears the cookie and
    // redirects on that response, so nobody would ever look again.
    const rider = await makeRider();

    const stamped = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      token: rider.token,
      body: { anonymised_at: '2020-01-01 00:00:00.000Z' },
    });
    expect(stamped.status).toBe(403);

    // And the real thing still works, which is what says the guard is aimed at
    // the client rather than at the route.
    const gone = await deleteAccount(rider.token, { password, confirm: 'DELETE' });
    expect(gone.status).toBe(200);
    expect(gone.body.records_removed).toBeGreaterThanOrEqual(0);
  });

  it('is not a way to get out of the consent gate', async () => {
    // `guardian_consents` is evidence and §6.2 says it is never hard-deleted.
    const rider = await makeRider({ age_band: 'under_13', country: 'GB' });
    const asked = await call('POST', '/api/landit/consent/request', {
      token: rider.token,
      body: { guardian_email: `guardian-${Date.now()}@example.invalid` },
    });
    expect(asked.status).toBe(200);

    const gone = await deleteAccount(rider.token, { password, confirm: 'DELETE' });
    expect(gone.status).toBe(200);

    const token = await superuser();
    const consents = await call<{ totalItems: number }>(
      'GET',
      '/api/collections/guardian_consents/records',
      { token, query: { filter: `user = "${rider.id}"` } },
    );
    expect(consents.body.totalItems).toBe(1);
  });
});

/**
 * The other door (`1787702400_users_no_self_delete.js`).
 *
 * Erasure had two routes and only one of them was the decision. The tests above
 * pin what `/api/landit/account/delete` does; these pin that it is the *only*
 * way out, because a plain row delete cascades `guardian_consents` away and
 * leaves the moderation trail pointing at nothing.
 */
describe('the users row is not deletable by the rider it belongs to', () => {
  it('refuses a rider deleting their own record, and the record survives', async () => {
    const rider = await makeRider();

    const attempt = await call('DELETE', `/api/collections/users/records/${rider.id}`, {
      token: rider.token,
    });
    expect(attempt.status).toBe(403);

    // The assertion that matters: a refusal that still deleted the row would
    // pass a status check and fail the guarantee.
    const still = await call('GET', `/api/collections/users/records/${rider.id}`, {
      token: rider.token,
    });
    expect(still.status).toBe(200);
  });

  it('does not let a row delete take the guardian consent record with it', async () => {
    // The whole reason the rule is closed. `guardian_consents.user` is
    // `cascadeDelete`, so this request succeeding would destroy §6.2 evidence
    // on nothing but a session token — no password, no audit row.
    const rider = await makeRider({ age_band: 'under_13', country: 'GB' });
    const asked = await call('POST', '/api/landit/consent/request', {
      token: rider.token,
      body: { guardian_email: `guardian-${Date.now()}@example.invalid` },
    });
    expect(asked.status).toBe(200);

    await call('DELETE', `/api/collections/users/records/${rider.id}`, { token: rider.token });

    const token = await superuser();
    const consents = await call<{ totalItems: number }>(
      'GET',
      '/api/collections/guardian_consents/records',
      { token, query: { filter: `user = "${rider.id}"` } },
    );
    expect(consents.body.totalItems).toBe(1);
  });

  it('refuses a rider deleting somebody else’s record', async () => {
    const rider = await makeRider();
    const stranger = await makeRider();

    const attempt = await call('DELETE', `/api/collections/users/records/${stranger.id}`, {
      token: rider.token,
    });
    expect(attempt.status).toBe(403);

    const still = await call('GET', `/api/collections/users/records/${stranger.id}`, {
      token: stranger.token,
    });
    expect(still.status).toBe(200);
  });

  it('still lets the superuser delete a row, which is the cleanup path', async () => {
    // Test accounts and bad imports are deleted from the dashboard, with the
    // box's own credentials. Closing the rider's route must not close that one.
    const rider = await makeRider();

    const removed = await call('DELETE', `/api/collections/users/records/${rider.id}`, {
      token: await superuser(),
    });
    expect(removed.status).toBe(204);

    const gone = await call('GET', `/api/collections/users/records/${rider.id}`, {
      token: await superuser(),
    });
    expect(gone.status).toBe(404);
  });
});
