import { beforeAll, describe, expect, it } from 'vitest';

import { baseFixtures, call, ensureRecord, makeRider, superuser, type Rider } from './helpers';

/**
 * Crews, invites, the board and the feed — over HTTP (T11).
 *
 * Two plan sections are on trial here and neither of them is a preference:
 *
 * - **§6.1, no stranger-contact surface.** Crews are invite-only with no
 *   discovery, the only way in is a code, and the code is minted by the server.
 *   The tests below try each of those from the outside.
 * - **§3 guarantees 1 and 4.** A private rider still appears on the crew board
 *   by name and score, and *only* there — their activity is not in the feed. A
 *   rider held behind the guardian-consent gate appears nowhere and cannot join
 *   a crew at all.
 *
 * Everything is asserted as observed API behaviour (LESSONS §5). Nothing here
 * reads a rule string.
 */

const CODE_ALPHABET = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{10}$/;

interface CrewRecord {
  id: string;
  name: string;
  slug: string;
  owner: string;
}

interface BoardRow {
  id: string;
  name: string;
  handle: string;
  landed: number;
  sessions: number;
  flair: boolean;
  role: string;
  [key: string]: unknown;
}

interface FeedItem {
  id: string;
  kind: string;
  at: string;
  rider: { id: string; name: string; handle: string; flair: boolean };
  trick?: string;
  stage?: string;
  sticker?: string;
}

async function makeCrew(
  rider: Rider,
  body: Record<string, unknown> = {},
): Promise<{ status: number; body: CrewRecord & { message?: string } }> {
  return call<CrewRecord & { message?: string }>('POST', '/api/collections/crews/records', {
    token: rider.token,
    body: { name: `Crew ${Math.random().toString(36).slice(2, 8)}`, ...body },
  });
}

async function mintInvite(
  rider: Rider,
  crewId: string,
  extra: Record<string, unknown> = {},
): Promise<{
  status: number;
  body: { id: string; code: string; max_uses: number; expires: string };
}> {
  return call<{ id: string; code: string; max_uses: number; expires: string }>(
    'POST',
    '/api/collections/crew_invites/records',
    { token: rider.token, body: { crew: crewId, ...extra } },
  );
}

const join = (rider: Rider, code: string) =>
  call<{ crew?: string; joined?: boolean; message?: string }>('POST', '/api/landit/crews/join', {
    token: rider.token,
    body: { code },
  });

const board = (rider: Rider, crewId: string, month?: string) =>
  call<{ riders?: BoardRow[]; month?: string; message?: string }>(
    'GET',
    `/api/landit/crew-board/${crewId}`,
    { token: rider.token, ...(month ? { query: { month } } : {}) },
  );

/** This month, on UTC's clock — which is a plausible month key everywhere. */
const thisMonth = () => new Date().toISOString().slice(0, 7);

/** A live spot to hang a session on. Sessions need one; the hook checks. */
async function liveSpot(): Promise<string> {
  const created = await call<{ id: string }>('POST', '/api/collections/spots/records', {
    token: await superuser(),
    body: {
      name: `Crew Park ${Math.random().toString(36).slice(2, 8)}`,
      town: 'Leeds',
      type: 'Concrete',
      lat: 53.8,
      lng: -1.55,
      status: 'live',
    },
  });
  if (created.status !== 200) throw new Error(`spot failed: ${JSON.stringify(created)}`);
  return created.body.id;
}

/** Open a rider's profile far enough for the feed's own gate to let them through. */
const openProfile = (rider: Rider, privacy: string) =>
  call('PATCH', `/api/collections/users/records/${rider.id}`, {
    token: rider.token,
    body: { privacy },
  });

/** One session, logged the way the app logs one. */
const logSession = (rider: Rider, spot: string, visibility: string) =>
  call<{ id: string; month_key: string }>('POST', '/api/collections/sessions/records', {
    token: rider.token,
    body: {
      user: rider.id,
      started_at: new Date(Date.now() - 3_600_000).toISOString(),
      duration_minutes: 60,
      sport: 'scooter',
      spot,
      feel: 'good',
      visibility,
    },
  });

const feed = (rider: Rider, crewId: string) =>
  call<{ items?: FeedItem[]; message?: string }>('GET', `/api/landit/crew-feed/${crewId}`, {
    token: rider.token,
  });

/** A landed stage, written the way the app writes it. */
async function land(rider: Rider, trickId: string, stage = 'every'): Promise<void> {
  const progress = await call('POST', '/api/collections/trick_progress/records', {
    token: rider.token,
    body: { user: rider.id, trick: trickId, stage },
  });
  expect(progress.status).toBe(200);
  const log = await call('POST', '/api/collections/trick_log/records', {
    token: rider.token,
    body: { user: rider.id, trick: trickId, stage, at: new Date().toISOString() },
  });
  expect(log.status).toBe(200);
}

describe('crews are invite-only, with no discovery (plan §6.1)', () => {
  let owner: Rider;
  let stranger: Rider;
  let crew: CrewRecord;

  beforeAll(async () => {
    owner = await makeRider();
    stranger = await makeRider();
    const created = await makeCrew(owner, { name: 'Ramp Rats' });
    expect(created.status).toBe(200);
    crew = created.body;
  });

  it('puts the creator in the crew as its owner', async () => {
    const members = await call<{ items: { user: string; role: string }[] }>(
      'GET',
      '/api/collections/crew_members/records',
      { token: owner.token, query: { filter: `crew = "${crew.id}"` } },
    );
    expect(members.status).toBe(200);
    expect(members.body.items).toHaveLength(1);
    expect(members.body.items[0]!.user).toBe(owner.id);
    expect(members.body.items[0]!.role).toBe('owner');
  });

  it('does not let a rider claim ownership of a crew they did not make', async () => {
    const created = await makeCrew(stranger, { owner: owner.id });
    expect(created.status).toBe(200);
    expect(created.body.owner).toBe(stranger.id);
  });

  it('gives the crew a server-chosen slug, whatever the body asked for', async () => {
    const created = await makeCrew(owner, { name: 'Bay Eight', slug: 'ramp-rats' });
    expect(created.status).toBe(200);
    expect(created.body.slug).not.toBe('ramp-rats');
    expect(created.body.slug).toMatch(/^bay-eight-[a-z0-9]{6}$/);
  });

  it('refuses a crew name carrying a line break', async () => {
    const created = await makeCrew(owner, { name: 'Ramp\nRats' });
    expect(created.status).toBe(400);
  });

  it('hides a crew from every rider who is not in it', async () => {
    const listed = await call<{ items: CrewRecord[] }>('GET', '/api/collections/crews/records', {
      token: stranger.token,
    });
    expect(listed.status).toBe(200);
    expect(listed.body.items.map((c) => c.id)).not.toContain(crew.id);

    const viewed = await call('GET', `/api/collections/crews/records/${crew.id}`, {
      token: stranger.token,
    });
    expect(viewed.status).toBe(404);
  });

  it('offers no client path into a crew that skips a code', async () => {
    const forced = await call('POST', '/api/collections/crew_members/records', {
      token: stranger.token,
      body: { crew: crew.id, user: stranger.id, role: 'member' },
    });
    expect(forced.status).toBe(403);

    const stillAlone = await board(stranger, crew.id);
    expect(stillAlone.status).toBe(403);
  });

  it('refuses the board and the feed to a rider who is not in the crew', async () => {
    expect((await board(stranger, crew.id)).status).toBe(403);
    expect((await feed(stranger, crew.id)).status).toBe(403);
  });
});

describe('invite codes are minted by the server', () => {
  let owner: Rider;
  let crew: CrewRecord;

  beforeAll(async () => {
    owner = await makeRider();
    crew = (await makeCrew(owner)).body;
  });

  it('ignores a code the client chose, so no crew can be made guessable', async () => {
    const invite = await mintInvite(owner, crew.id, { code: 'RAMPRATS1' });
    expect(invite.status).toBe(200);
    expect(invite.body.code).not.toBe('RAMPRATS1');
    expect(invite.body.code).toMatch(CODE_ALPHABET);
  });

  it('gives every invite an expiry and a use ceiling', async () => {
    const invite = await mintInvite(owner, crew.id, { max_uses: 100000, expires: '' });
    expect(invite.status).toBe(200);
    expect(invite.body.max_uses).toBe(25);
    expect(invite.body.expires).not.toBe('');
  });

  it('lets a rider redeem a code exactly once, and refuses a wrong one', async () => {
    const mate = await makeRider();
    const invite = await mintInvite(owner, crew.id);

    const first = await join(mate, invite.body.code);
    expect(first.status).toBe(200);
    expect(first.body.joined).toBe(true);

    const second = await join(mate, invite.body.code);
    expect(second.status).toBe(200);
    expect(second.body.joined).toBe(false);

    const wrong = await join(await makeRider(), 'ZZZZZZZZZZ');
    expect(wrong.status).toBe(400);
  });

  it('does not let a rider mint an invite to a crew they are not in', async () => {
    const stranger = await makeRider();
    const invite = await mintInvite(stranger, crew.id);
    expect(invite.status).toBe(400);
  });
});

describe('guarantee 1: a private rider is on the board, and only on the board', () => {
  let owner: Rider;
  let quiet: Rider;
  let crew: CrewRecord;

  beforeAll(async () => {
    const fixtures = await baseFixtures();
    owner = await makeRider();
    quiet = await makeRider();
    crew = (await makeCrew(owner)).body;

    const invite = await mintInvite(owner, crew.id);
    expect((await join(quiet, invite.body.code)).status).toBe(200);

    await land(owner, fixtures.freeTrick);
    await land(quiet, fixtures.freeTrick);

    const closed = await call('PATCH', `/api/collections/users/records/${quiet.id}`, {
      token: quiet.token,
      body: { privacy: 'private' },
    });
    expect(closed.status).toBe(200);
  });

  it('refuses the private rider’s record to a crewmate', async () => {
    const direct = await call('GET', `/api/collections/users/records/${quiet.id}`, {
      token: owner.token,
    });
    expect(direct.status).toBe(404);
  });

  it('still shows them on the board, by name and score', async () => {
    const result = await board(owner, crew.id);
    expect(result.status).toBe(200);
    const row = result.body.riders!.find((r) => r.id === quiet.id);
    expect(row).toBeDefined();
    expect(row!.handle).toBe(quiet.handle);
    expect(row!.landed).toBe(1);
  });

  it('never carries a plan, an email or a consent state across to another rider', async () => {
    const result = await board(owner, crew.id);
    const row = result.body.riders![0]!;
    for (const leak of ['email', 'plan', 'role_', 'town', 'age_band', 'consent_state', 'country']) {
      expect(Object.keys(row)).not.toContain(leak);
    }
  });

  it('keeps the private rider’s activity out of the feed', async () => {
    const result = await feed(owner, crew.id);
    expect(result.status).toBe(200);
    const ids = result.body.items!.map((i) => i.rider.id);
    expect(ids).toContain(owner.id);
    expect(ids).not.toContain(quiet.id);
  });

  it('still shows a private rider their own activity', async () => {
    const result = await feed(quiet, crew.id);
    expect(result.status).toBe(200);
    expect(result.body.items!.map((i) => i.rider.id)).toContain(quiet.id);
  });

  it('shows a "riders only" crewmate to a signed-in crewmate', async () => {
    const opened = await call('PATCH', `/api/collections/users/records/${quiet.id}`, {
      token: quiet.token,
      body: { privacy: 'members' },
    });
    expect(opened.status).toBe(200);

    const result = await feed(owner, crew.id);
    expect(result.body.items!.map((i) => i.rider.id)).toContain(quiet.id);
  });
});

describe('guarantee 4: a rider waiting on a guardian is in no crew at all', () => {
  let owner: Rider;
  let pending: Rider;
  let crew: CrewRecord;
  let code: string;

  beforeAll(async () => {
    owner = await makeRider();
    pending = await makeRider({ age_band: 'under_13', country: 'GB' });
    crew = (await makeCrew(owner)).body;
    code = (await mintInvite(owner, crew.id)).body.code;
  });

  it('is actually in the pending state the rest of this block assumes', async () => {
    const me = await call<{ consent_state: string }>(
      'GET',
      `/api/collections/users/records/${pending.id}`,
      { token: pending.token },
    );
    expect(me.body.consent_state).toBe('pending');
  });

  it('cannot create a crew', async () => {
    const created = await makeCrew(pending);
    expect(created.status).toBe(400);
  });

  it('cannot redeem an invite code', async () => {
    const attempt = await join(pending, code);
    expect(attempt.status).toBe(403);
  });

  it('does not appear on a board once a guardian revokes consent', async () => {
    const fixtures = await baseFixtures();
    const mate = await makeRider();
    expect((await join(mate, code)).status).toBe(200);

    // Something to disappear. Without a landed trick — and without a privacy
    // setting that would show it — the feed assertion below would pass against
    // an empty list and prove nothing (LESSONS §5).
    await call('PATCH', `/api/collections/users/records/${mate.id}`, {
      token: mate.token,
      body: { privacy: 'members' },
    });
    await land(mate, fixtures.freeTrick);
    const seen = await feed(owner, crew.id);
    expect(seen.body.items!.map((i) => i.rider.id)).toContain(mate.id);

    const before = await board(owner, crew.id);
    expect(before.body.riders!.map((r) => r.id)).toContain(mate.id);

    const revoked = await call('PATCH', `/api/collections/users/records/${mate.id}`, {
      token: await superuser(),
      body: { consent_state: 'revoked' },
    });
    expect(revoked.status).toBe(200);

    const after = await board(owner, crew.id);
    expect(after.body.riders!.map((r) => r.id)).not.toContain(mate.id);

    const afterFeed = await feed(owner, crew.id);
    expect(afterFeed.body.items!.map((i) => i.rider.id)).not.toContain(mate.id);
  });
});

describe('Legend flair is an entitlement, never a plan id', () => {
  let owner: Rider;
  let legend: Rider;
  let crew: CrewRecord;

  beforeAll(async () => {
    await baseFixtures();
    // The entitlement lives on the plan record (plan §2.4). A seeded database
    // carries it; this suite's fixtures may predate the field, so it is written
    // here rather than assumed.
    const plan = await ensureRecord('plans', "slug = 'legend'", {
      slug: 'legend',
      name: 'Legend',
      is_live: true,
    });
    await call('PATCH', `/api/collections/plans/records/${plan.id}`, {
      token: await superuser(),
      body: { includes_flair: true },
    });

    owner = await makeRider();
    legend = await makeRider({}, { plan: 'legend' });
    crew = (await makeCrew(owner)).body;
    const invite = await mintInvite(owner, crew.id);
    expect((await join(legend, invite.body.code)).status).toBe(200);
  });

  it('is on for the rider whose plan carries it, and off for the one whose does not', async () => {
    const result = await board(owner, crew.id);
    expect(result.status).toBe(200);
    const rows = result.body.riders!;
    expect(rows.find((r) => r.id === legend.id)!.flair).toBe(true);
    expect(rows.find((r) => r.id === owner.id)!.flair).toBe(false);
  });

  it('does not move anybody up the board — achievements are never for sale', async () => {
    const fixtures = await baseFixtures();
    await land(owner, fixtures.freeTrick);
    const result = await board(owner, crew.id);
    const rows = result.body.riders!;
    expect(rows[0]!.id).toBe(owner.id);
    expect(rows[0]!.landed).toBe(1);
  });
});

describe('the feed is chronological, scoped and made of our own sentences', () => {
  let owner: Rider;
  let mate: Rider;
  let crew: CrewRecord;

  beforeAll(async () => {
    const fixtures = await baseFixtures();
    owner = await makeRider();
    mate = await makeRider();
    crew = (await makeCrew(owner)).body;
    const invite = await mintInvite(owner, crew.id);
    expect((await join(mate, invite.body.code)).status).toBe(200);

    await call('PATCH', `/api/collections/users/records/${mate.id}`, {
      token: mate.token,
      body: { privacy: 'members' },
    });

    await land(mate, fixtures.freeTrick, 'trying');
    await land(mate, fixtures.freeTrickSkate, 'every');
  });

  it('carries only fields the product wrote, never free text from a rider', async () => {
    const result = await feed(owner, crew.id);
    expect(result.status).toBe(200);
    expect(result.body.items!.length).toBeGreaterThan(0);
    for (const item of result.body.items!) {
      expect(['stage', 'sticker']).toContain(item.kind);
      expect(Object.keys(item).sort()).toEqual(
        item.kind === 'stage'
          ? ['at', 'id', 'kind', 'rider', 'sport', 'stage', 'trick']
          : ['at', 'hue', 'id', 'kind', 'rider', 'sticker'],
      );
      expect(Object.keys(item.rider).sort()).toEqual([
        'avatar_key',
        'flair',
        'handle',
        'id',
        'name',
      ]);
    }
  });

  it('is newest first', async () => {
    const result = await feed(owner, crew.id);
    const times = result.body.items!.map((i) => i.at);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it('includes a sticker somebody earned', async () => {
    const sticker = await ensureRecord('stickers', "slug = 'fixture-first-drop'", {
      slug: 'fixture-first-drop',
      name: 'Fixture First Drop',
      hue: '#FFC23F',
      is_live: true,
    });
    const awarded = await call('POST', '/api/collections/rider_stickers/records', {
      token: await superuser(),
      body: { user: mate.id, sticker: sticker.id, earned_at: new Date().toISOString() },
    });
    expect(awarded.status).toBe(200);

    const result = await feed(owner, crew.id);
    expect(result.body.items!.some((i) => i.sticker === 'Fixture First Drop')).toBe(true);
  });
});

describe('a crew keeps an owner when its owner leaves (issue #143)', () => {
  /** The crew as the server holds it, read with the fixture superuser. */
  const crewRecord = async (id: string) =>
    call<CrewRecord>('GET', `/api/collections/crews/records/${id}`, { token: await superuser() });

  const members = (rider: Rider, crewId: string) =>
    call<{ items: { id: string; user: string; role: string }[] }>(
      'GET',
      '/api/collections/crew_members/records',
      { token: rider.token, query: { filter: `crew = "${crewId}"`, sort: 'created' } },
    );

  it('hands the crew to the longest-standing member when the owner leaves', async () => {
    const owner = await makeRider();
    const first = await makeRider();
    const second = await makeRider();
    const crew = (await makeCrew(owner, { name: 'Handover' })).body;

    const invite = await mintInvite(owner, crew.id);
    expect((await join(first, invite.body.code)).status).toBe(200);
    expect((await join(second, invite.body.code)).status).toBe(200);

    const before = await members(owner, crew.id);
    const ownRow = before.body.items.find((row) => row.user === owner.id);
    expect(ownRow?.role).toBe('owner');

    // The rider's own row, under `deleteRule: OWN` — what `leaveCrew` does.
    const left = await call('DELETE', `/api/collections/crew_members/records/${ownRow!.id}`, {
      token: owner.token,
    });
    expect(left.status).toBe(204);

    const after = await members(first, crew.id);
    const roles = Object.fromEntries(after.body.items.map((row) => [row.user, row.role]));
    expect(roles[first.id]).toBe('owner');
    expect(roles[second.id]).toBe('member');
    expect(roles[owner.id]).toBeUndefined();

    // `crews.owner` is what every rule reads, so it moves too — the heir can
    // now do the one thing only an owner can, which is retire an invite.
    expect((await crewRecord(crew.id)).body.owner).toBe(first.id);
    const retired = await call(
      'DELETE',
      `/api/collections/crew_invites/records/${invite.body.id}`,
      {
        token: first.token,
      },
    );
    expect(retired.status).toBe(204);
  });

  it('does the same when the owner closes their account', async () => {
    // The erasure path deletes the rows with `app.delete`, not over HTTP —
    // which is why the hook is model-level. Same outcome expected.
    const owner = await makeRider();
    const mate = await makeRider();
    const crew = (await makeCrew(owner, { name: 'Left Behind' })).body;
    const invite = await mintInvite(owner, crew.id);
    expect((await join(mate, invite.body.code)).status).toBe(200);

    const gone = await call('POST', '/api/landit/account/delete', {
      token: owner.token,
      body: { password: owner.password, confirm: 'DELETE' },
    });
    expect(gone.status).toBe(200);

    expect((await crewRecord(crew.id)).body.owner).toBe(mate.id);
    const after = await members(mate, crew.id);
    expect(after.body.items).toHaveLength(1);
    expect(after.body.items[0]!.role).toBe('owner');
  });

  it('leaves a member alone when a member leaves, and an empty crew as it is', async () => {
    const owner = await makeRider();
    const mate = await makeRider();
    const crew = (await makeCrew(owner, { name: 'Still Mine' })).body;
    const invite = await mintInvite(owner, crew.id);
    expect((await join(mate, invite.body.code)).status).toBe(200);

    const rows = await members(owner, crew.id);
    const mateRow = rows.body.items.find((row) => row.user === mate.id)!;
    expect(
      (
        await call('DELETE', `/api/collections/crew_members/records/${mateRow.id}`, {
          token: mate.token,
        })
      ).status,
    ).toBe(204);
    expect((await crewRecord(crew.id)).body.owner).toBe(owner.id);

    const ownRow = rows.body.items.find((row) => row.user === owner.id)!;
    expect(
      (
        await call('DELETE', `/api/collections/crew_members/records/${ownRow.id}`, {
          token: owner.token,
        })
      ).status,
    ).toBe(204);
    // Nobody left to promote: the crew stays, ownerless, rather than being
    // deleted from under people — that is the decision the issue leaves open.
    expect((await crewRecord(crew.id)).status).toBe(200);
  });
});

/* ------------------------------------------------------ sessions (2026-09-13) -- */

describe('the board counts sessions this month, and the feed carries them', () => {
  let spot: string;

  beforeAll(async () => {
    spot = await liveSpot();
  });

  it('counts every session a rider logged this month, whatever its visibility', async () => {
    /*
     * The weeks column became a session count (Rachid, 2026-09-13, in chat),
     * and the count is the board's, not the feed's: it counts all three
     * visibilities, exactly as `landed` counts every landed trick whatever the
     * rider's privacy. Plan §3 guarantee 1 is the licence and also the limit —
     * "by name and score" — and a number opens nothing.
     */
    const owner = await makeRider();
    const mate = await makeRider();
    const crew = (await makeCrew(owner, { name: 'Counting' })).body;
    expect((await join(mate, (await mintInvite(owner, crew.id)).body.code)).status).toBe(200);

    for (const visibility of ['public', 'members', 'private']) {
      expect((await logSession(mate, spot, visibility)).status).toBe(200);
    }

    const rows = (await board(owner, crew.id, thisMonth())).body;
    expect(rows.month).toBe(thisMonth());
    expect(rows.riders?.find((r) => r.id === mate.id)?.sessions).toBe(3);
    expect(rows.riders?.find((r) => r.id === owner.id)?.sessions).toBe(0);
  });

  it('counts none for a month the caller invented, rather than counting that month', async () => {
    // The key is bounds-checked against "now somewhere on earth", so a caller
    // cannot ask the board to score a month of their choosing — and an absent
    // month counts nothing rather than guessing at one.
    const owner = await makeRider();
    const crew = (await makeCrew(owner, { name: 'Bounded' })).body;
    expect((await logSession(owner, spot, 'private')).status).toBe(200);

    expect((await board(owner, crew.id, '1999-01')).body.riders?.[0]?.sessions).toBe(0);
    expect((await board(owner, crew.id)).body.riders?.[0]?.sessions).toBe(0);
    expect((await board(owner, crew.id, thisMonth())).body.riders?.[0]?.sessions).toBe(1);
  });

  it('puts a crew-mate’s public and crew sessions in the feed, and never a private one', async () => {
    const owner = await makeRider();
    const mate = await makeRider();
    const crew = (await makeCrew(owner, { name: 'Just Happened' })).body;
    expect((await join(mate, (await mintInvite(owner, crew.id)).body.code)).status).toBe(200);
    // The rider gate first: a `private` profile is in no feed at all, whatever
    // any one session says. This one opens far enough to be tested on the
    // session's own setting.
    expect((await openProfile(mate, 'members')).status).toBe(200);

    const shown = [
      (await logSession(mate, spot, 'public')).body.id,
      (await logSession(mate, spot, 'members')).body.id,
    ];
    const hidden = (await logSession(mate, spot, 'private')).body.id;

    const items = (await feed(owner, crew.id)).body.items ?? [];
    const sessions = items.filter((item) => item.kind === 'session');
    expect(sessions.map((item) => item.id).sort()).toEqual([...shown].sort());
    expect(sessions.map((item) => item.id)).not.toContain(hidden);
  });

  it('keeps a private profile’s sessions out, however open the session itself is', async () => {
    // The two gates in order: this rider's *profile* is private, so nothing of
    // theirs is in the feed — a `public` session included.
    const owner = await makeRider();
    const mate = await makeRider();
    const crew = (await makeCrew(owner, { name: 'Closed Door' })).body;
    expect((await join(mate, (await mintInvite(owner, crew.id)).body.code)).status).toBe(200);
    expect((await logSession(mate, spot, 'public')).status).toBe(200);

    const items = (await feed(owner, crew.id)).body.items ?? [];
    expect(items.filter((i) => i.rider.id === mate.id)).toEqual([]);
  });

  it('shows a rider their own private session, because it is theirs', async () => {
    const owner = await makeRider();
    const crew = (await makeCrew(owner, { name: 'My Own' })).body;
    const mine = (await logSession(owner, spot, 'private')).body.id;

    const items = (await feed(owner, crew.id)).body.items ?? [];
    expect(items.filter((i) => i.kind === 'session').map((i) => i.id)).toEqual([mine]);
  });

  it('carries nothing about a session but that it happened', async () => {
    /*
     * A session says where a rider was and when (plan §1 D1). The feed payload
     * is checked key by key rather than by reading the sentence, because it is
     * the *payload* that would leak — a screen can only draw what it is sent.
     */
    const owner = await makeRider();
    const mate = await makeRider();
    const crew = (await makeCrew(owner, { name: 'Nothing Else' })).body;
    expect((await join(mate, (await mintInvite(owner, crew.id)).body.code)).status).toBe(200);
    expect((await openProfile(mate, 'members')).status).toBe(200);
    expect((await logSession(mate, spot, 'public')).status).toBe(200);

    const item = (await feed(owner, crew.id)).body.items!.find((i) => i.kind === 'session')!;
    expect(Object.keys(item).sort()).toEqual(['at', 'id', 'kind', 'rider', 'sport']);
    expect(JSON.stringify(item)).not.toContain(spot);
  });
});
