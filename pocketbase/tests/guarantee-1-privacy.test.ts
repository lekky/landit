import { beforeAll, describe, expect, it } from 'vitest';

import { baseFixtures, call, ensureRecord, makeRider, superuser, type Rider } from './helpers';

/**
 * Plan §3, guarantee 1 — profile privacy.
 *
 * `public` / `members` / `private` on the view rules for `users`,
 * `trick_progress` and `rider_stickers`; and the one thing rules alone cannot
 * do: a private rider still appearing on the crew board by name and score,
 * through a narrow server-shaped payload rather than the full record.
 */
describe('guarantee 1 — profile privacy is enforced by the API, not the UI', () => {
  let publicRider: Rider;
  let membersRider: Rider;
  let privateRider: Rider;
  let stranger: Rider;

  beforeAll(async () => {
    await baseFixtures();
    publicRider = await makeRider({ privacy: 'public' }, { consent_state: 'not_required' });
    membersRider = await makeRider({ privacy: 'members' }, { consent_state: 'not_required' });
    privateRider = await makeRider({ privacy: 'private' }, { consent_state: 'not_required' });
    stranger = await makeRider({ privacy: 'public' }, { consent_state: 'not_required' });
  });

  it('defaults a brand-new profile to private, not public (AADC standard 7)', async () => {
    const fresh = await makeRider();
    const own = await call<{ privacy: string }>(
      'GET',
      `/api/collections/users/records/${fresh.id}`,
      { token: fresh.token },
    );
    expect(own.status).toBe(200);
    expect(own.body.privacy).toBe('private');
  });

  it('shows a public profile to a signed-out visitor', async () => {
    const result = await call('GET', `/api/collections/users/records/${publicRider.id}`);
    expect(result.status).toBe(200);
  });

  it('hides a members-only profile from a signed-out visitor but shows it to a rider', async () => {
    const guest = await call('GET', `/api/collections/users/records/${membersRider.id}`);
    expect(guest.status).toBe(404);

    const signedIn = await call('GET', `/api/collections/users/records/${membersRider.id}`, {
      token: stranger.token,
    });
    expect(signedIn.status).toBe(200);
  });

  it('hides a private profile from everyone but its owner', async () => {
    const guest = await call('GET', `/api/collections/users/records/${privateRider.id}`);
    expect(guest.status).toBe(404);

    const otherRider = await call('GET', `/api/collections/users/records/${privateRider.id}`, {
      token: stranger.token,
    });
    expect(otherRider.status).toBe(404);

    const owner = await call('GET', `/api/collections/users/records/${privateRider.id}`, {
      token: privateRider.token,
    });
    expect(owner.status).toBe(200);
  });

  it('keeps a private rider out of the rider list entirely', async () => {
    const listed = await call<{ items: { id: string }[] }>(
      'GET',
      '/api/collections/users/records',
      {
        token: stranger.token,
        query: { perPage: '200' },
      },
    );
    const ids = listed.body.items.map((item) => item.id);
    expect(ids).toContain(publicRider.id);
    expect(ids).not.toContain(privateRider.id);
  });

  it('never returns another rider’s email address', async () => {
    const seen = await call<{ email?: string }>(
      'GET',
      `/api/collections/users/records/${publicRider.id}`,
      { token: stranger.token },
    );
    expect(seen.status).toBe(200);
    expect(seen.body.email).toBeFalsy();
  });

  it('refuses a rider who tries to publish their own email address', async () => {
    const attempt = await call<{ emailVisibility: boolean }>(
      'PATCH',
      `/api/collections/users/records/${publicRider.id}`,
      { token: publicRider.token, body: { emailVisibility: true } },
    );
    expect(attempt.status).toBe(200);
    expect(attempt.body.emailVisibility).toBe(false);

    const seen = await call<{ email?: string }>(
      'GET',
      `/api/collections/users/records/${publicRider.id}`,
      { token: stranger.token },
    );
    expect(seen.body.email).toBeFalsy();
  });

  it('gates trick_progress by the owner’s privacy setting, not the caller’s intent', async () => {
    const fixtures = await baseFixtures();

    for (const rider of [publicRider, membersRider, privateRider]) {
      const created = await call('POST', '/api/collections/trick_progress/records', {
        token: rider.token,
        body: { user: rider.id, trick: fixtures.freeTrick, stage: 'every' },
      });
      expect(created.status).toBe(200);
    }

    const asGuest = await call<{ items: { id: string }[] }>(
      'GET',
      '/api/collections/trick_progress/records',
      { query: { perPage: '200' } },
    );
    const guestUsers = new Set(
      (asGuest.body.items as unknown as { user: string }[]).map((item) => item.user),
    );
    expect(guestUsers.has(publicRider.id)).toBe(true);
    expect(guestUsers.has(membersRider.id)).toBe(false);
    expect(guestUsers.has(privateRider.id)).toBe(false);

    const asRider = await call<{ items: { user: string }[] }>(
      'GET',
      '/api/collections/trick_progress/records',
      { token: stranger.token, query: { perPage: '200' } },
    );
    const riderUsers = new Set(asRider.body.items.map((item) => item.user));
    expect(riderUsers.has(publicRider.id)).toBe(true);
    expect(riderUsers.has(membersRider.id)).toBe(true);
    expect(riderUsers.has(privateRider.id)).toBe(false);
  });

  it('gates rider_stickers the same way', async () => {
    const token = await superuser();
    const sticker = await ensureRecord('stickers', "slug = 'fixture-first-land'", {
      slug: 'fixture-first-land',
      name: 'Fixture First Land',
      cond: 'Log your first trick',
      is_live: true,
    });

    for (const rider of [publicRider, privateRider]) {
      await call('POST', '/api/collections/rider_stickers/records', {
        token,
        body: { user: rider.id, sticker: sticker.id, earned_at: '2026-08-01 00:00:00.000Z' },
      });
    }

    const seen = await call<{ items: { user: string }[] }>(
      'GET',
      '/api/collections/rider_stickers/records',
      { token: stranger.token, query: { perPage: '200' } },
    );
    const users = new Set(seen.body.items.map((item) => item.user));
    expect(users.has(publicRider.id)).toBe(true);
    expect(users.has(privateRider.id)).toBe(false);
  });

  it('keeps a rider’s notes private at every privacy setting', async () => {
    const fixtures = await baseFixtures();
    const note = await call<{ id: string }>('POST', '/api/collections/trick_notes/records', {
      token: publicRider.token,
      body: { user: publicRider.id, trick: fixtures.freeTrick, body: 'heel down, look ahead' },
    });
    expect(note.status).toBe(200);

    const peek = await call('GET', `/api/collections/trick_notes/records/${note.body.id}`, {
      token: stranger.token,
    });
    expect(peek.status).toBe(404);
  });

  it('shows a private rider on the crew board by name and score, and nothing else', async () => {
    const crew = await call<{ id: string }>('POST', '/api/collections/crews/records', {
      token: publicRider.token,
      body: { name: 'Board Test Crew', slug: `board-${publicRider.handle}` },
    });
    expect(crew.status).toBe(200);

    const invite = await call<{ code: string }>('POST', '/api/collections/crew_invites/records', {
      token: publicRider.token,
      body: { crew: crew.body.id },
    });
    expect(invite.status).toBe(200);

    const joined = await call('POST', '/api/landit/crews/join', {
      token: privateRider.token,
      body: { code: invite.body.code },
    });
    expect(joined.status).toBe(200);

    // The private rider's own record is still closed to the crew owner...
    const direct = await call('GET', `/api/collections/users/records/${privateRider.id}`, {
      token: publicRider.token,
    });
    expect(direct.status).toBe(404);

    // ...but they appear on the board, by name and score.
    const board = await call<{
      riders: { id: string; handle: string; landed: number; email?: string }[];
    }>('GET', `/api/landit/crew-board/${crew.body.id}`, { token: publicRider.token });
    expect(board.status).toBe(200);

    const row = board.body.riders.find((rider) => rider.id === privateRider.id);
    expect(row).toBeTruthy();
    expect(row!.handle).toBe(privateRider.handle);
    expect(row!.landed).toBeGreaterThanOrEqual(1);

    // The payload is built field by field on the server, so it cannot widen by
    // accident. `flair` was added on purpose by T11 — the Legend cosmetic tag
    // from plan §2.4, resolved from the plan record into a boolean *before* it
    // crosses, which is how the board shows flair without `plan` ever joining
    // the list. Widening this line is how a session says it meant to.
    expect(Object.keys(row!).sort()).toEqual(
      ['avatar_key', 'flair', 'handle', 'id', 'landed', 'name', 'role', 'sports', 'streak'].sort(),
    );
  });

  it('refuses the crew board to somebody who is not in the crew', async () => {
    const crew = await call<{ id: string }>('POST', '/api/collections/crews/records', {
      token: membersRider.token,
      body: { name: 'Closed Crew', slug: `closed-${membersRider.handle}` },
    });
    expect(crew.status).toBe(200);

    const outsider = await call('GET', `/api/landit/crew-board/${crew.body.id}`, {
      token: stranger.token,
    });
    expect(outsider.status).toBe(403);

    const guest = await call('GET', `/api/landit/crew-board/${crew.body.id}`);
    expect(guest.status).toBe(401);
  });

  it('will not show a crew to a rider who is not in it (no discovery)', async () => {
    const crew = await call<{ id: string }>('POST', '/api/collections/crews/records', {
      token: membersRider.token,
      body: { name: 'Hidden Crew', slug: `hidden-${membersRider.handle}` },
    });
    expect(crew.status).toBe(200);

    const peek = await call('GET', `/api/collections/crews/records/${crew.body.id}`, {
      token: stranger.token,
    });
    expect(peek.status).toBe(404);

    const own = await call('GET', `/api/collections/crews/records/${crew.body.id}`, {
      token: membersRider.token,
    });
    expect(own.status).toBe(200);
  });
});
