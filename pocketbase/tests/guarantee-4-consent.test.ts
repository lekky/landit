import { beforeAll, describe, expect, it } from 'vitest';

import {
  baseFixtures,
  call,
  ensureRecord,
  makeRider,
  superuser,
  uploadClip,
  type Fixtures,
  type Rider,
} from './helpers';

/**
 * Plan §3, guarantee 4 — the consent gate is server-side (added 2026-08-16).
 *
 * A rider whose `consent_state` is `pending` or `revoked` may read and write
 * only their own data. Everything that makes them visible, reachable or
 * billable refuses them: `crews`, `crew_members`, `crew_invites`, `spots`
 * create, `event_attendance`, `clips`, `subscriptions`, and any view rule that
 * would surface their profile to another rider.
 *
 * "A client-side consent gate protects nobody, and this one is a promise made
 * to a parent." Every refusal below is therefore observed over HTTP.
 */
describe('guarantee 4 — the guardian-consent gate is enforced by the API', () => {
  let fixtures: Fixtures;
  let pending: Rider;
  let revoked: Rider;
  let granted: Rider;
  let onlooker: Rider;

  beforeAll(async () => {
    fixtures = await baseFixtures();
    pending = await makeRider(
      { privacy: 'public' },
      { consent_state: 'pending', age_band: 'under_13', country: 'GB', plan: 'shredder' },
    );
    revoked = await makeRider(
      { privacy: 'public' },
      { consent_state: 'revoked', age_band: 'under_13', country: 'GB' },
    );
    granted = await makeRider(
      { privacy: 'public' },
      { consent_state: 'granted', age_band: 'under_13', country: 'GB' },
    );
    onlooker = await makeRider({ privacy: 'public' }, { consent_state: 'not_required' });
  });

  // --------------------------------------------------- what they still can --

  it('still lets a pending rider sign in and read their own record', async () => {
    const own = await call<{ consent_state: string }>(
      'GET',
      `/api/collections/users/records/${pending.id}`,
      { token: pending.token },
    );
    expect(own.status).toBe(200);
    expect(own.body.consent_state).toBe('pending');
  });

  it('still lets a pending rider browse the library and log their own tricks', async () => {
    const library = await call<{ items: unknown[] }>('GET', '/api/collections/tricks/records', {
      token: pending.token,
    });
    expect(library.status).toBe(200);
    expect(library.body.items.length).toBeGreaterThan(0);

    const progress = await call('POST', '/api/collections/trick_progress/records', {
      token: pending.token,
      body: { user: pending.id, trick: fixtures.freeTrick, stage: 'every' },
    });
    expect(progress.status).toBe(200);

    const note = await call('POST', '/api/collections/trick_notes/records', {
      token: pending.token,
      body: { user: pending.id, trick: fixtures.freeTrick, body: 'still allowed' },
    });
    expect(note.status).toBe(200);
  });

  // ------------------------------------------------------- invisibility ----

  it('hides a pending rider’s profile from every other rider, whatever they set', async () => {
    // The rider chose `public`; the gate overrides that, in both directions.
    const seen = await call('GET', `/api/collections/users/records/${pending.id}`, {
      token: onlooker.token,
    });
    expect(seen.status).toBe(404);

    const guest = await call('GET', `/api/collections/users/records/${pending.id}`);
    expect(guest.status).toBe(404);

    const revokedSeen = await call('GET', `/api/collections/users/records/${revoked.id}`, {
      token: onlooker.token,
    });
    expect(revokedSeen.status).toBe(404);

    const grantedSeen = await call('GET', `/api/collections/users/records/${granted.id}`, {
      token: onlooker.token,
    });
    expect(grantedSeen.status).toBe(200);
  });

  it('hides a pending rider’s progress from every other rider', async () => {
    const listed = await call<{ items: { user: string }[] }>(
      'GET',
      '/api/collections/trick_progress/records',
      { token: onlooker.token, query: { perPage: '500' } },
    );
    const users = new Set(listed.body.items.map((item) => item.user));
    expect(users.has(pending.id)).toBe(false);
  });

  it('stops a pending rider reading other riders', async () => {
    const seen = await call('GET', `/api/collections/users/records/${onlooker.id}`, {
      token: pending.token,
    });
    expect(seen.status).toBe(404);
  });

  // --------------------------------------------------------- the refusals --

  it('refuses to let a pending rider create a crew', async () => {
    const result = await call('POST', '/api/collections/crews/records', {
      token: pending.token,
      body: { name: 'Not Allowed', slug: `nope-${pending.handle}` },
    });
    expect(result.status).toBe(400);
  });

  it('refuses to let a pending rider join a crew with a valid invite', async () => {
    const crew = await call<{ id: string }>('POST', '/api/collections/crews/records', {
      token: onlooker.token,
      body: { name: 'Consent Crew', slug: `consent-${onlooker.handle}` },
    });
    expect(crew.status).toBe(200);

    const invite = await call<{ code: string }>('POST', '/api/collections/crew_invites/records', {
      token: onlooker.token,
      body: { crew: crew.body.id },
    });
    expect(invite.status).toBe(200);

    for (const rider of [pending, revoked]) {
      const joined = await call('POST', '/api/landit/crews/join', {
        token: rider.token,
        body: { code: invite.body.code },
      });
      expect(joined.status).toBe(403);
    }

    // ...and the same code works for a rider whose consent is granted.
    const ok = await call('POST', '/api/landit/crews/join', {
      token: granted.token,
      body: { code: invite.body.code },
    });
    expect(ok.status).toBe(200);
  });

  it('refuses a pending rider a crew membership even when the server writes it', async () => {
    const token = await superuser();
    const crew = await call<{ id: string }>('POST', '/api/collections/crews/records', {
      token: onlooker.token,
      body: { name: 'Server Crew', slug: `server-${onlooker.handle}` },
    });
    expect(crew.status).toBe(200);

    const forced = await call('POST', '/api/collections/crew_members/records', {
      token,
      body: { crew: crew.body.id, user: pending.id, role: 'member' },
    });
    expect(forced.status).toBe(403);
  });

  it('keeps a consent-limited rider off a crew board they are somehow in', async () => {
    const token = await superuser();
    const crew = await call<{ id: string }>('POST', '/api/collections/crews/records', {
      token: onlooker.token,
      body: { name: 'Board Consent Crew', slug: `boardc-${onlooker.handle}` },
    });

    // Join while consent is granted, then have it revoked by a guardian.
    const lapsing = await makeRider({ privacy: 'public' }, { consent_state: 'granted' });
    const invite = await call<{ code: string }>('POST', '/api/collections/crew_invites/records', {
      token: onlooker.token,
      body: { crew: crew.body.id },
    });
    const joined = await call('POST', '/api/landit/crews/join', {
      token: lapsing.token,
      body: { code: invite.body.code },
    });
    expect(joined.status).toBe(200);

    const before = await call<{ riders: { id: string }[] }>(
      'GET',
      `/api/landit/crew-board/${crew.body.id}`,
      { token: onlooker.token },
    );
    expect(before.body.riders.map((r) => r.id)).toContain(lapsing.id);

    await call('PATCH', `/api/collections/users/records/${lapsing.id}`, {
      token,
      body: { consent_state: 'revoked' },
    });

    const after = await call<{ riders: { id: string }[] }>(
      'GET',
      `/api/landit/crew-board/${crew.body.id}`,
      { token: onlooker.token },
    );
    expect(after.body.riders.map((r) => r.id)).not.toContain(lapsing.id);
  });

  it('refuses to let a pending rider mint a crew invite', async () => {
    const crew = await call<{ id: string }>('POST', '/api/collections/crews/records', {
      token: onlooker.token,
      body: { name: 'Invite Crew', slug: `invite-${onlooker.handle}` },
    });
    const result = await call('POST', '/api/collections/crew_invites/records', {
      token: pending.token,
      body: { crew: crew.body.id },
    });
    expect(result.status).toBe(400);
  });

  it('refuses to let a pending rider submit a spot', async () => {
    const result = await call('POST', '/api/collections/spots/records', {
      token: pending.token,
      body: { name: 'Nowhere', town: 'Nowhere', lat: 53.4, lng: -2.9 },
    });
    expect(result.status).toBe(400);

    const allowed = await call('POST', '/api/collections/spots/records', {
      token: granted.token,
      body: { name: 'Somewhere', town: 'Leeds', lat: 53.8, lng: -1.5 },
    });
    expect(allowed.status).toBe(200);
  });

  it('refuses to let a pending rider say they are going to an event', async () => {
    const event = await ensureRecord('events', "slug = 'fixture-jam'", {
      slug: 'fixture-jam',
      name: 'Fixture Jam',
      kind: 'Jam',
      town: 'Manchester',
      date: '2026-09-01 10:00:00.000Z',
      is_live: true,
    });

    const refused = await call('POST', '/api/collections/event_attendance/records', {
      token: pending.token,
      body: { user: pending.id, event: event.id },
    });
    expect(refused.status).toBe(400);

    const allowed = await call('POST', '/api/collections/event_attendance/records', {
      token: granted.token,
      body: { user: granted.id, event: event.id },
    });
    expect(allowed.status).toBe(200);
  });

  it('refuses to let a pending rider save a clip, even on a paid plan', async () => {
    const attempt = await uploadClip(pending, fixtures.freeTrick, 256);
    expect([400, 403]).toContain(attempt.status);
  });

  it('refuses to let a pending rider hold a subscription, even server-side', async () => {
    const token = await superuser();
    const plans = await call<{ items: { id: string }[] }>('GET', '/api/collections/plans/records', {
      token,
      query: { filter: "slug = 'shredder'" },
    });

    const refused = await call('POST', '/api/collections/subscriptions/records', {
      token,
      body: {
        user: pending.id,
        plan: plans.body.items[0]!.id,
        source: 'stripe',
        status: 'active',
      },
    });
    expect(refused.status).toBe(403);

    const allowed = await call('POST', '/api/collections/subscriptions/records', {
      token,
      body: {
        user: granted.id,
        plan: plans.body.items[0]!.id,
        source: 'stripe',
        status: 'active',
        // T15 added two more conditions to holding a subscription (plan §6.2,
        // `55_subscriptions.pb.js`): the payer confirms they are 18 or over,
        // and an under-16 rider's is bought by their guardian. `granted` is an
        // under-13, so both apply. This test's subject is the consent gate, not
        // the payer rule — the two lines are here so it can still get past the
        // rule that moved (LESSONS §3).
        payer_kind: 'guardian',
        payer_adult_confirmed: true,
      },
    });
    expect(allowed.status).toBe(200);
  });

  // ------------------------------------------------- the field itself ------

  it('refuses to let a rider write their own consent_state', async () => {
    const attempt = await call('PATCH', `/api/collections/users/records/${pending.id}`, {
      token: pending.token,
      body: { consent_state: 'granted' },
    });
    expect(attempt.status).toBe(403);

    const still = await call<{ consent_state: string }>(
      'GET',
      `/api/collections/users/records/${pending.id}`,
      { token: pending.token },
    );
    expect(still.body.consent_state).toBe('pending');
  });

  it('refuses to let a rider age themselves out of the gate', async () => {
    const attempt = await call('PATCH', `/api/collections/users/records/${pending.id}`, {
      token: pending.token,
      body: { age_band: 'adult' },
    });
    expect(attempt.status).toBe(403);
  });

  it('ignores a consent_state smuggled into sign-up', async () => {
    const sneaky = await makeRider({ consent_state: 'granted' });
    const seen = await call<{ consent_state: string }>(
      'GET',
      `/api/collections/users/records/${sneaky.id}`,
      { token: sneaky.token },
    );
    expect(seen.body.consent_state).toBe('not_required');
  });

  it('keeps guardian_consents readable only by the rider it is about', async () => {
    const token = await superuser();
    const consent = await call<{ id: string }>(
      'POST',
      '/api/collections/guardian_consents/records',
      {
        token,
        body: {
          user: pending.id,
          guardian_email: 'guardian@landit.invalid',
          method: 'email_approval',
          requested: '2026-08-16 09:00:00.000Z',
          approval_token_hash: 'hashed-approval-token',
          revocation_token_hash: 'hashed-revocation-token',
        },
      },
    );
    expect(consent.status).toBe(200);

    const own = await call<{ approval_token_hash?: string }>(
      'GET',
      `/api/collections/guardian_consents/records/${consent.body.id}`,
      { token: pending.token },
    );
    expect(own.status).toBe(200);
    // Hashed tokens are hidden fields — they never leave the server, not even
    // to the rider the record is about.
    expect(own.body.approval_token_hash).toBeUndefined();

    const other = await call(
      'GET',
      `/api/collections/guardian_consents/records/${consent.body.id}`,
      { token: onlooker.token },
    );
    expect(other.status).toBe(404);

    // Revocation is a state, not a delete — there is no client delete path.
    const deleted = await call(
      'DELETE',
      `/api/collections/guardian_consents/records/${consent.body.id}`,
      { token: pending.token },
    );
    expect(deleted.status).toBe(403);
  });
});
