import { randomBytes } from 'node:crypto';

import { SESSION_REFUSALS } from '@landit/core';
import { beforeAll, describe, expect, it } from 'vitest';

import { baseFixtures, call, makeRider, superuser, type Fixtures, type Rider } from './helpers';

/**
 * Sessions (T36), as observed HTTP behaviour against the real binary.
 *
 * Every owner's decision that has a server half is driven here, and every
 * refusal is asserted — status **and** the world afterwards (LESSONS §5):
 *
 * - **G1 / D2 — the stricter of session and profile wins.** The full matrix:
 *   three profile settings × three session settings × owner, crew-mate,
 *   signed-in stranger, signed-out visitor. Trick entries follow their session.
 * - **G4 — a consent-limited or suspended rider's sessions reach nobody**, and a
 *   consent-limited viewer sees nobody's.
 * - **D3 — "rode with" is crew-mates only**, and another rider is only sent the
 *   tagged ids whose profiles they could open.
 * - **D4 / D5 — clip links** are parsed to `{ platform, id }`, Rookie holds
 *   none, Shredder's cap is read off the record and filled, Legend is
 *   unlimited — and a **superuser client cannot exceed either**.
 * - **D6 — four a month on Rookie**, then refused, then the once-per-account
 *   grace, which deleting the session does not give back. A superuser cannot
 *   exceed the quota either.
 * - **One-way promotion** — a landed entry moves the stage once; re-saving,
 *   unticking, removing the entry and deleting the session never move it back.
 *
 * **On fixtures** (LESSONS §5): nothing here edits a shared `plans` row. Caps are
 * read back off the records and each test fills its *own* rider.
 *
 * ---
 *
 * **Which door each test stands in** — observed, not assumed. Each guard was
 * broken on purpose, the suite re-run, and the reds counted (T36, 2026-09-13):
 *
 * | Guard broken | Red |
 * | --- | --- |
 * | `enrichSession` returns at once (no strip) | "names a tagged rider only to a viewer who could open that rider's profile" |
 * | `sessionCreateDecision` always `'allow'` (hook copy) | the three quota tests — Rookie's four, **the superuser one**, the lying month key |
 * | "once" removed from `sessionStagePromotion` (hook copy) | "moves a landed trick one stage, once, and never back" |
 * | Crew clause in the view rule replaced by "signed in" | the `public` and `members` profile matrices, and "lists only what the viewer may see" |
 * | The clip allowance check skipped | "are not part of Rookie" and "fill to Shredder's cap", **both including the superuser write** |
 *
 * The `private`-profile matrix stays green when the crew clause goes, because a
 * private profile never reaches that arm — which is the ceiling working, not a
 * gap in the test.
 */

interface SessionRow {
  id: string;
  user: string;
  spot: string;
  event: string;
  visibility: string;
  rode_with: string[];
  clip_platform: string;
  clip_id: string;
  month_key?: string;
  grace?: boolean;
  notes: string;
  started_at: string;
  message?: string;
}

interface EntryRow {
  id: string;
  session: string;
  user: string;
  trick: string;
  landed: boolean;
  stage_from: string;
  stage_to: string;
  message?: string;
}

let fixtures: Fixtures;
let spotId: string;
let eventId: string;

const uniq = () => randomBytes(4).toString('hex');
const anHourAgo = () => new Date(Date.now() - 3_600_000).toISOString();

async function liveSpot(name: string): Promise<string> {
  const created = await call<{ id: string }>('POST', '/api/collections/spots/records', {
    token: await superuser(),
    body: { name, town: 'Leeds', type: 'Concrete', lat: 53.8, lng: -1.55, status: 'live' },
  });
  if (created.status !== 200) throw new Error(`spot failed: ${JSON.stringify(created)}`);
  return created.body.id;
}

async function event(isLive: boolean): Promise<string> {
  const created = await call<{ id: string }>('POST', '/api/collections/events/records', {
    token: await superuser(),
    body: {
      slug: `session-jam-${uniq()}`,
      name: 'Session Jam',
      kind: 'Jam',
      date: '2026-09-13 10:00:00.000Z',
      is_live: isLive,
    },
  });
  if (created.status !== 200) throw new Error(`event failed: ${JSON.stringify(created)}`);
  return created.body.id;
}

function sessionBody(rider: Rider, overrides: Record<string, unknown> = {}) {
  return {
    user: rider.id,
    started_at: anHourAgo(),
    duration_minutes: 60,
    sport: 'scooter',
    spot: spotId,
    feel: 'good',
    ...overrides,
  };
}

const log = (rider: Rider, overrides: Record<string, unknown> = {}, token?: string) =>
  call<SessionRow>('POST', '/api/collections/sessions/records', {
    token: token ?? rider.token,
    body: sessionBody(rider, overrides),
  });

const view = (id: string, token?: string | null) =>
  call<SessionRow>('GET', `/api/collections/sessions/records/${id}`, { token: token ?? null });

async function ownSessionCount(riderId: string): Promise<number> {
  const listed = await call<{ totalItems: number }>('GET', '/api/collections/sessions/records', {
    token: await superuser(),
    query: { filter: `user = "${riderId}"` },
  });
  return listed.body.totalItems;
}

/** A crew owned by `owner` with `members` joined through real invites. */
async function crewOf(owner: Rider, members: Rider[]): Promise<string> {
  const crew = await call<{ id: string }>('POST', '/api/collections/crews/records', {
    token: owner.token,
    body: { name: `Crew ${uniq()}` },
  });
  if (crew.status !== 200) throw new Error(`crew failed: ${JSON.stringify(crew)}`);
  for (const member of members) {
    const invite = await call<{ code: string }>('POST', '/api/collections/crew_invites/records', {
      token: owner.token,
      body: { crew: crew.body.id },
    });
    const joined = await call('POST', '/api/landit/crews/join', {
      token: member.token,
      body: { code: invite.body.code },
    });
    if (joined.status !== 200) throw new Error(`join failed: ${JSON.stringify(joined)}`);
  }
  return crew.body.id;
}

async function setPrivacy(rider: Rider, privacy: string): Promise<void> {
  const patched = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
    token: rider.token,
    body: { privacy },
  });
  if (patched.status !== 200) throw new Error(`privacy failed: ${JSON.stringify(patched)}`);
}

async function planRecord(slug: string): Promise<Record<string, number | boolean>> {
  const found = await call<{ items: Record<string, number | boolean>[] }>(
    'GET',
    '/api/collections/plans/records',
    { token: await superuser(), query: { filter: `slug = "${slug}"` } },
  );
  return found.body.items[0]!;
}

beforeAll(async () => {
  fixtures = await baseFixtures();
  spotId = await liveSpot(`Session Park ${uniq()}`);
  eventId = await event(true);
});

/* ---------------------------------------------------------------- schema -- */

describe('the schema', () => {
  it('has the three collections and the new plan and profile fields', async () => {
    const token = await superuser();
    const collections = await call<{ items: { name: string; fields: { name: string }[] }[] }>(
      'GET',
      '/api/collections',
      { token, query: { perPage: '200' } },
    );
    const byName = new Map(collections.body.items.map((c) => [c.name, c]));
    for (const name of ['sessions', 'session_tricks', 'session_grace']) {
      expect(byName.has(name), name).toBe(true);
    }
    const planFields = byName.get('plans')!.fields.map((f) => f.name);
    for (const field of [
      'session_month_cap',
      'sessions_unlimited',
      'session_clip_cap',
      'session_clips_unlimited',
    ]) {
      expect(planFields).toContain(field);
    }
    expect(byName.get('users')!.fields.map((f) => f.name)).toContain('session_visibility_default');
  });
});

/* ------------------------------------------------------- shape and owner -- */

describe('a session write', () => {
  it('is the caller’s own, dated, placed and private by default', async () => {
    const rider = await makeRider();
    const created = await log(rider);
    expect(created.status).toBe(200);
    expect(created.body.user).toBe(rider.id);
    expect(created.body.visibility).toBe('private');
    expect(created.body.month_key).toMatch(/^\d{4}-\d{2}$/);
  });

  it('cannot be written into another rider’s diary', async () => {
    const rider = await makeRider();
    const victim = await makeRider();
    const attempt = await call('POST', '/api/collections/sessions/records', {
      token: rider.token,
      body: sessionBody(victim),
    });
    expect(attempt.status).not.toBe(200);
    expect(await ownSessionCount(victim.id)).toBe(0);
  });

  it('normalises an unrecognised visibility to private rather than trusting it', async () => {
    const rider = await makeRider();
    const created = await log(rider, { visibility: 'everyone' });
    expect(created.status).toBe(200);
    expect(created.body.visibility).toBe('private');
  });

  it('refuses a malformed shape, in the shared words', async () => {
    const rider = await makeRider();
    const cases: [Record<string, unknown>, string][] = [
      [{ duration_minutes: 45 }, SESSION_REFUSALS.durationMinutes],
      [{ started_at: new Date(Date.now() + 3 * 3_600_000).toISOString() }, SESSION_REFUSALS.future],
      [{ aim: 'x'.repeat(121) }, ''],
    ];
    for (const [overrides, message] of cases) {
      const refused = await log(rider, overrides);
      expect(refused.status, JSON.stringify(overrides)).toBe(400);
      if (message) expect(refused.body.message).toBe(message);
    }
    expect(await ownSessionCount(rider.id)).toBe(0);
  });

  it('must be at a spot the rider could see, and at a live event', async () => {
    const rider = await makeRider();
    const stranger = await makeRider();
    const pending = await call<{ id: string }>('POST', '/api/collections/spots/records', {
      token: stranger.token,
      body: { name: `Hidden ${uniq()}`, town: 'Leeds', type: 'Concrete', lat: 53.8, lng: -1.5 },
    });

    const theirs = await log(rider, { spot: pending.body.id });
    expect(theirs.status).toBe(400);
    expect(theirs.body.message).toBe(SESSION_REFUSALS.spotHidden);

    const mine = await log(stranger, { spot: pending.body.id });
    expect(mine.status).toBe(200);

    const offCalendar = await log(rider, { event: await event(false) });
    expect(offCalendar.status).toBe(400);
    expect(offCalendar.body.message).toBe(SESSION_REFUSALS.eventHidden);

    const atJam = await log(rider, { event: eventId });
    expect(atJam.status).toBe(200);
    expect(atJam.body.event).toBe(eventId);
  });

  it('keeps who it belongs to and which month it counted in, whatever an edit says', async () => {
    const rider = await makeRider();
    const other = await makeRider();
    const created = await log(rider);
    const edited = await call<SessionRow>(
      'PATCH',
      `/api/collections/sessions/records/${created.body.id}`,
      { token: rider.token, body: { month_key: '1999-01', grace: true, notes: 'Reworded' } },
    );
    expect(edited.status).toBe(200);
    expect(edited.body.notes).toBe('Reworded');
    expect(edited.body.month_key).toBe(created.body.month_key);
    expect(edited.body.grace).toBe(false);

    const moved = await call('PATCH', `/api/collections/sessions/records/${created.body.id}`, {
      token: await superuser(),
      body: { user: other.id },
    });
    expect(moved.status).not.toBe(200);
  });

  it('replaces a month key no timezone is in with this month', async () => {
    const rider = await makeRider();
    const created = await log(rider, { month_key: '1999-01' });
    expect(created.status).toBe(200);
    expect(created.body.month_key).not.toBe('1999-01');
  });

  it('lets a rider waiting on a guardian keep a diary', async () => {
    const pending = await makeRider({ age_band: 'under_13' }, { consent_state: 'pending' });
    expect((await log(pending)).status).toBe(200);
  });
});

/* ---------------------------------------------------- visibility matrix -- */

describe('who can see a session — the stricter of session and profile (G1, D2)', () => {
  const profiles = ['public', 'members', 'private'] as const;
  const settings = ['public', 'members', 'private'] as const;

  // Expected for [stranger, crew-mate, signed out], indexed by profile then session.
  const expected: Record<string, Record<string, [boolean, boolean, boolean]>> = {
    public: {
      public: [true, true, true],
      members: [false, true, false],
      private: [false, false, false],
    },
    members: {
      public: [true, true, false],
      members: [false, true, false],
      private: [false, false, false],
    },
    private: {
      public: [false, false, false],
      members: [false, false, false],
      private: [false, false, false],
    },
  };

  for (const profile of profiles) {
    it(`on a ${profile} profile`, async () => {
      const owner = await makeRider();
      const mate = await makeRider();
      const stranger = await makeRider();
      await crewOf(owner, [mate]);
      await setPrivacy(owner, profile);

      for (const visibility of settings) {
        const created = await log(owner, { visibility });
        expect(created.status).toBe(200);
        const id = created.body.id;
        const [strangerSees, mateSees, guestSees] = expected[profile]![visibility]!;
        const at = `${visibility} session, ${profile} profile`;

        expect((await view(id, owner.token)).status, `${at}: owner`).toBe(200);
        expect((await view(id, stranger.token)).status, `${at}: stranger`).toBe(
          strangerSees ? 200 : 404,
        );
        expect((await view(id, mate.token)).status, `${at}: crew-mate`).toBe(mateSees ? 200 : 404);
        expect((await view(id)).status, `${at}: signed out`).toBe(guestSees ? 200 : 404);

        const entry = await call<EntryRow>('POST', '/api/collections/session_tricks/records', {
          token: owner.token,
          body: { session: id, trick: fixtures.freeTrick, landed: false },
        });
        expect(entry.status).toBe(200);
        const entryAs = (token?: string) =>
          call('GET', `/api/collections/session_tricks/records/${entry.body.id}`, {
            token: token ?? null,
          });
        expect((await entryAs(stranger.token)).status, `${at}: stranger, entry`).toBe(
          strangerSees ? 200 : 404,
        );
        expect((await entryAs(mate.token)).status, `${at}: crew-mate, entry`).toBe(
          mateSees ? 200 : 404,
        );
        expect((await entryAs()).status, `${at}: signed out, entry`).toBe(guestSees ? 200 : 404);
      }
    });
  }

  it('lists only what the viewer may see', async () => {
    const owner = await makeRider();
    const stranger = await makeRider();
    await setPrivacy(owner, 'public');
    for (const visibility of settings) await log(owner, { visibility });
    const listed = await call<{ items: SessionRow[] }>('GET', '/api/collections/sessions/records', {
      token: stranger.token,
      query: { filter: `user = "${owner.id}"` },
    });
    expect(listed.body.items.map((s) => s.visibility)).toEqual(['public']);
  });

  it('shows a consent-limited or suspended rider’s sessions to nobody, and a limited viewer nothing (G4)', async () => {
    const owner = await makeRider();
    const stranger = await makeRider();
    const limitedViewer = await makeRider({ age_band: 'under_13' }, { consent_state: 'pending' });
    await setPrivacy(owner, 'public');
    const open = await log(owner, { visibility: 'public' });
    expect((await view(open.body.id, stranger.token)).status).toBe(200);
    expect((await view(open.body.id, limitedViewer.token)).status).toBe(404);

    await call('PATCH', `/api/collections/users/records/${owner.id}`, {
      token: await superuser(),
      body: { consent_state: 'revoked' },
    });
    expect((await view(open.body.id, stranger.token)).status).toBe(404);
    expect((await view(open.body.id)).status).toBe(404);
    expect((await view(open.body.id, owner.token)).status).toBe(200);

    const suspended = await makeRider();
    await setPrivacy(suspended, 'public');
    const theirs = await log(suspended, { visibility: 'public' });
    await call('PATCH', `/api/collections/users/records/${suspended.id}`, {
      token: await superuser(),
      body: { suspended: true },
    });
    expect((await view(theirs.body.id, stranger.token)).status).toBe(404);
  });
});

/* ------------------------------------------------------------ rode with -- */

describe('"rode with" (D3)', () => {
  it('takes crew-mates, and refuses anybody else or the rider themself', async () => {
    const rider = await makeRider();
    const mate = await makeRider();
    const stranger = await makeRider();
    await crewOf(rider, [mate]);

    const withStranger = await log(rider, { rode_with: [stranger.id] });
    expect(withStranger.status).toBe(400);
    expect(withStranger.body.message).toBe(SESSION_REFUSALS.crewNotMate);

    expect((await log(rider, { rode_with: [rider.id] })).status).toBe(400);

    const withMate = await log(rider, { rode_with: [mate.id] });
    expect(withMate.status).toBe(200);
    expect(withMate.body.rode_with).toEqual([mate.id]);

    // Adding a stranger to an existing session is refused the same way.
    const added = await call('PATCH', `/api/collections/sessions/records/${withMate.body.id}`, {
      token: rider.token,
      body: { rode_with: [mate.id, stranger.id] },
    });
    expect(added.status).toBe(400);
  });

  it('refuses a crew-mate whose guardian has withdrawn consent (G4)', async () => {
    const rider = await makeRider();
    const mate = await makeRider();
    await crewOf(rider, [mate]);
    await call('PATCH', `/api/collections/users/records/${mate.id}`, {
      token: await superuser(),
      body: { consent_state: 'revoked' },
    });
    const refused = await log(rider, { rode_with: [mate.id] });
    expect(refused.status).toBe(400);
  });

  it('names a tagged rider only to a viewer who could open that rider’s profile', async () => {
    const owner = await makeRider();
    const closed = await makeRider(); // private profile — the default
    const riders = await makeRider();
    const stranger = await makeRider();
    await crewOf(owner, [closed, riders]);
    await setPrivacy(owner, 'public');
    await setPrivacy(riders, 'members');

    const created = await log(owner, { visibility: 'public', rode_with: [closed.id, riders.id] });
    expect(created.status).toBe(200);

    const asOwner = await view(created.body.id, owner.token);
    expect([...asOwner.body.rode_with].sort()).toEqual([closed.id, riders.id].sort());
    expect(asOwner.body.month_key).toMatch(/^\d{4}-\d{2}$/);

    const asStranger = await view(created.body.id, stranger.token);
    expect(asStranger.status).toBe(200);
    expect(asStranger.body.rode_with).toEqual([riders.id]);
    // The owner's quota bookkeeping is nobody else's business.
    expect(asStranger.body.month_key).toBeUndefined();
    expect(asStranger.body.grace).toBeUndefined();

    const asGuest = await view(created.body.id);
    expect(asGuest.status).toBe(200);
    expect(asGuest.body.rode_with).toEqual([]);

    // The closed rider can see themself on it.
    expect((await view(created.body.id, closed.token)).body.rode_with).toContain(closed.id);

    // And a list read is filtered the same way, not only a single view.
    const listed = await call<{ items: SessionRow[] }>('GET', '/api/collections/sessions/records', {
      token: stranger.token,
      query: { filter: `id = "${created.body.id}"` },
    });
    expect(listed.body.items[0]!.rode_with).toEqual([riders.id]);
  });
});

/* ----------------------------------------------------------------- clips -- */

describe('session clips (D4, D5)', () => {
  it('are not part of Rookie, including through a superuser client', async () => {
    const rookie = await makeRider();
    const refused = await log(rookie, { clip_id: 'https://youtu.be/dQw4w9WgXcQ' });
    expect(refused.status).toBe(403);
    expect(refused.body.message).toBe(SESSION_REFUSALS.clipNotOnPlan);

    const asStaff = await log(
      rookie,
      { clip_id: 'https://youtu.be/dQw4w9WgXcQ' },
      await superuser(),
    );
    expect(asStaff.status).toBe(403);
    expect(await ownSessionCount(rookie.id)).toBe(0);
  });

  it('store the platform and the id, never the pasted string', async () => {
    const rider = await makeRider({}, { plan: 'shredder' });
    const reel = await log(rider, {
      clip_id: 'https://www.instagram.com/reel/C8xYz_1-AbC/?igsh=tracking',
    });
    expect(reel.status).toBe(200);
    expect(reel.body.clip_platform).toBe('instagram');
    expect(reel.body.clip_id).toBe('C8xYz_1-AbC');

    const tiktok = await log(rider, {
      clip_id: 'https://www.tiktok.com/@a.rider/video/7234567890123456789?is_from_webapp=1',
      clip_platform: 'youtube', // a lying platform is overwritten too
    });
    expect(tiktok.body.clip_platform).toBe('tiktok');
    expect(tiktok.body.clip_id).toBe('7234567890123456789');

    const short = await log(rider, { clip_id: 'https://vm.tiktok.com/ZMabc1234/' });
    expect(short.status).toBe(400);
    expect(short.body.message).toBe(SESSION_REFUSALS.clipShortlink);

    const other = await log(rider, { clip_id: 'javascript:alert(1)' });
    expect(other.status).toBe(400);
    expect(other.body.message).toBe(SESSION_REFUSALS.clipUnsupported);

    // An edit that leaves the stored clip alone does not re-parse the bare id.
    const kept = await call<SessionRow>(
      'PATCH',
      `/api/collections/sessions/records/${reel.body.id}`,
      {
        token: rider.token,
        body: { notes: 'Kept the clip', clip_id: 'C8xYz_1-AbC', clip_platform: 'instagram' },
      },
    );
    expect(kept.status).toBe(200);
    expect(kept.body.clip_id).toBe('C8xYz_1-AbC');
  });

  it('fill to Shredder’s cap, read off the plan, and no further — not even as a superuser', async () => {
    const plan = await planRecord('shredder');
    const cap = Number(plan.session_clip_cap);
    expect(cap).toBeGreaterThan(0);
    expect(plan.session_clips_unlimited).toBe(false);

    const rider = await makeRider({}, { plan: 'shredder' });
    let first = '';
    for (let n = 0; n < cap; n += 1) {
      const created = await log(rider, { clip_id: 'https://youtu.be/dQw4w9WgXcQ' });
      expect(created.status, `clip ${n + 1}`).toBe(200);
      if (!first) first = created.body.id;
    }

    const over = await log(rider, { clip_id: 'https://youtu.be/dQw4w9WgXcQ' });
    expect(over.status).toBe(403);
    expect(over.body.message).toBe(SESSION_REFUSALS.clipCap);
    expect(
      (await log(rider, { clip_id: 'https://youtu.be/dQw4w9WgXcQ' }, await superuser())).status,
    ).toBe(403);

    // A session without a clip is still fine, and swapping a held clip is not adding one.
    expect((await log(rider)).status).toBe(200);
    const swapped = await call<SessionRow>('PATCH', `/api/collections/sessions/records/${first}`, {
      token: rider.token,
      body: { clip_id: 'https://www.youtube.com/shorts/oHg5SJYRHA0' },
    });
    expect(swapped.status).toBe(200);
    expect(swapped.body.clip_id).toBe('oHg5SJYRHA0');

    // Removing one makes room for another.
    await call('PATCH', `/api/collections/sessions/records/${first}`, {
      token: rider.token,
      body: { clip_id: '' },
    });
    expect((await log(rider, { clip_id: 'https://youtu.be/dQw4w9WgXcQ' })).status).toBe(200);
  });

  it('are unlimited on Legend', async () => {
    const shredderCap = Number((await planRecord('shredder')).session_clip_cap);
    const legend = await makeRider({}, { plan: 'legend' });
    for (let n = 0; n <= shredderCap; n += 1) {
      expect((await log(legend, { clip_id: 'https://youtu.be/dQw4w9WgXcQ' })).status).toBe(200);
    }
  });

  it('on a public session are visible with it, to a signed-out visitor', async () => {
    const rider = await makeRider({}, { plan: 'shredder' });
    await setPrivacy(rider, 'public');
    const created = await log(rider, {
      visibility: 'public',
      clip_id: 'https://youtu.be/dQw4w9WgXcQ',
    });
    const asGuest = await view(created.body.id);
    expect(asGuest.status).toBe(200);
    expect(asGuest.body.clip_id).toBe('dQw4w9WgXcQ');
  });
});

/* ----------------------------------------------------------------- quota -- */

describe('the monthly quota and the grace (D6)', () => {
  it('logs Rookie’s four, refuses the fifth, saves it once on the grace, and never again', async () => {
    const plan = await planRecord('rookie');
    const cap = Number(plan.session_month_cap);
    expect(cap).toBe(4);

    const rider = await makeRider();
    for (let n = 0; n < cap; n += 1)
      expect((await log(rider)).status, `session ${n + 1}`).toBe(200);

    const fifth = await log(rider);
    expect(fifth.status).toBe(403);
    expect(fifth.body.message).toBe(SESSION_REFUSALS.quotaFull);

    const graced = await log(rider, { grace: true });
    expect(graced.status).toBe(200);
    expect(graced.body.grace).toBe(true);

    const graceRows = await call<{ items: { month_key: string; session: string }[] }>(
      'GET',
      '/api/collections/session_grace/records',
      { token: rider.token },
    );
    expect(graceRows.body.items).toHaveLength(1);
    expect(graceRows.body.items[0]!.session).toBe(graced.body.id);

    const again = await log(rider, { grace: true });
    expect(again.status).toBe(403);
    expect(again.body.message).toBe(SESSION_REFUSALS.graceUsed);
    expect(await ownSessionCount(rider.id)).toBe(cap + 1);

    // Deleting the session the grace saved does not give the grace back.
    expect(
      (
        await call('DELETE', `/api/collections/sessions/records/${graced.body.id}`, {
          token: rider.token,
        })
      ).status,
    ).toBe(204);
    expect((await log(rider, { grace: true })).status).toBe(403);

    // And the grace row is not the rider's to delete or write.
    const row = await call<{ items: { id: string }[] }>(
      'GET',
      '/api/collections/session_grace/records',
      {
        token: rider.token,
      },
    );
    const del = await call(
      'DELETE',
      `/api/collections/session_grace/records/${row.body.items[0]!.id}`,
      {
        token: rider.token,
      },
    );
    expect(del.status).not.toBe(204);
    const forged = await call('POST', '/api/collections/session_grace/records', {
      token: rider.token,
      body: { user: rider.id },
    });
    expect(forged.status).not.toBe(200);
  });

  it('does not spend the grace when there is room', async () => {
    const rider = await makeRider();
    const created = await log(rider, { grace: true });
    expect(created.status).toBe(200);
    expect(created.body.grace).toBe(false);
    const graceRows = await call<{ items: unknown[] }>(
      'GET',
      '/api/collections/session_grace/records',
      {
        token: rider.token,
      },
    );
    expect(graceRows.body.items).toHaveLength(0);
  });

  it('cannot be exceeded by a superuser client', async () => {
    const rider = await makeRider();
    const token = await superuser();
    for (let n = 0; n < 4; n += 1) expect((await log(rider, {}, token)).status).toBe(200);
    const over = await log(rider, {}, token);
    expect(over.status).toBe(403);
    expect(await ownSessionCount(rider.id)).toBe(4);
  });

  it('does not count a lying month key as a different month', async () => {
    const rider = await makeRider();
    for (let n = 0; n < 4; n += 1) expect((await log(rider)).status).toBe(200);
    expect((await log(rider, { month_key: '1999-01' })).status).toBe(403);
  });

  it('does not apply on the paid plans', async () => {
    const rider = await makeRider({}, { plan: 'shredder' });
    for (let n = 0; n < 6; n += 1) expect((await log(rider)).status).toBe(200);
  });
});

/* ------------------------------------------------------------- promotion -- */

describe('one-way stage promotion', () => {
  const progressOf = async (rider: Rider, trick: string) => {
    const found = await call<{ items: { stage: string }[] }>(
      'GET',
      '/api/collections/trick_progress/records',
      { token: rider.token, query: { filter: `user = "${rider.id}" && trick = "${trick}"` } },
    );
    return found.body.items[0]?.stage ?? null;
  };
  const entry = (rider: Rider, body: Record<string, unknown>) =>
    call<EntryRow>('POST', '/api/collections/session_tricks/records', { token: rider.token, body });
  const patchEntry = (rider: Rider, id: string, body: Record<string, unknown>) =>
    call<EntryRow>('PATCH', `/api/collections/session_tricks/records/${id}`, {
      token: rider.token,
      body,
    });

  it('moves a landed trick one stage, once, and never back', async () => {
    const rider = await makeRider();
    await call('POST', '/api/collections/trick_progress/records', {
      token: rider.token,
      body: { user: rider.id, trick: fixtures.freeTrick, stage: 'trying' },
    });

    const session = await log(rider);
    const landed = await entry(rider, {
      session: session.body.id,
      trick: fixtures.freeTrick,
      landed: true,
      stage_from: 'want',
      stage_to: 'every', // a lying body is overwritten by the server's move
    });
    expect(landed.status).toBe(200);
    expect(landed.body.user).toBe(rider.id);
    expect(landed.body.stage_from).toBe('trying');
    expect(landed.body.stage_to).toBe('some');
    expect(await progressOf(rider, fixtures.freeTrick)).toBe('some');

    const history = await call<{ items: { stage: string }[] }>(
      'GET',
      '/api/collections/trick_log/records',
      {
        token: rider.token,
        query: { filter: `user = "${rider.id}" && trick = "${fixtures.freeTrick}"` },
      },
    );
    expect(history.body.items.map((row) => row.stage)).toEqual(['some']);

    // Re-saving, editing the session, and unticking then re-ticking: no second move.
    await patchEntry(rider, landed.body.id, { landed: true });
    await call('PATCH', `/api/collections/sessions/records/${session.body.id}`, {
      token: rider.token,
      body: { notes: 'Edited' },
    });
    const unticked = await patchEntry(rider, landed.body.id, { landed: false, stage_to: '' });
    expect(unticked.body.stage_to).toBe('some');
    expect(await progressOf(rider, fixtures.freeTrick)).toBe('some');
    const reticked = await patchEntry(rider, landed.body.id, { landed: true });
    expect(reticked.body.stage_to).toBe('some');
    expect(await progressOf(rider, fixtures.freeTrick)).toBe('some');

    // Removing the entry and deleting the session leave the stage where it is.
    await call('DELETE', `/api/collections/session_tricks/records/${landed.body.id}`, {
      token: rider.token,
    });
    expect(await progressOf(rider, fixtures.freeTrick)).toBe('some');

    const second = await log(rider);
    await entry(rider, { session: second.body.id, trick: fixtures.freeTrick, landed: true });
    expect(await progressOf(rider, fixtures.freeTrick)).toBe('most');
    await call('DELETE', `/api/collections/sessions/records/${second.body.id}`, {
      token: rider.token,
    });
    expect(await progressOf(rider, fixtures.freeTrick)).toBe('most');
  });

  it('starts an untracked trick at Sometimes, and moves nothing that was not landed', async () => {
    const rider = await makeRider();
    const session = await log(rider);
    const tried = await entry(rider, {
      session: session.body.id,
      trick: fixtures.freeTrickSkate,
      landed: false,
      stage_to: 'every',
    });
    expect(tried.body.stage_to).toBe('');
    expect(await progressOf(rider, fixtures.freeTrickSkate)).toBeNull();

    const flipped = await patchEntry(rider, tried.body.id, { landed: true });
    expect(flipped.body.stage_from).toBe('');
    expect(flipped.body.stage_to).toBe('some');
    expect(await progressOf(rider, fixtures.freeTrickSkate)).toBe('some');
  });

  it('keeps the paywall: a Rookie cannot log a paid trick into a session', async () => {
    const rider = await makeRider();
    const session = await log(rider);
    const refused = await entry(rider, {
      session: session.body.id,
      trick: fixtures.paidTrick,
      landed: true,
    });
    expect(refused.status).toBe(403);
    expect(await progressOf(rider, fixtures.paidTrick)).toBeNull();
  });

  it('cannot put an entry on somebody else’s session', async () => {
    const owner = await makeRider();
    const other = await makeRider();
    const session = await log(owner);
    const attempt = await entry(other, {
      session: session.body.id,
      trick: fixtures.freeTrick,
      landed: true,
    });
    expect(attempt.status).not.toBe(200);
    expect(await progressOf(owner, fixtures.freeTrick)).toBeNull();
  });
});

/* ------------------------------------------------ profile, export, erasure -- */

describe('the profile default, the export and erasure', () => {
  it('lets a rider choose who sees new sessions, from the three ids only', async () => {
    const rider = await makeRider();
    const set = await call<{ session_visibility_default: string }>(
      'PATCH',
      `/api/collections/users/records/${rider.id}`,
      { token: rider.token, body: { session_visibility_default: 'members' } },
    );
    expect(set.status).toBe(200);
    expect(set.body.session_visibility_default).toBe('members');
    const bad = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      token: rider.token,
      body: { session_visibility_default: 'everyone' },
    });
    expect(bad.status).toBe(400);
  });

  it('puts a rider’s sessions in their export, in words, and takes them on erasure', async () => {
    const rider = await makeRider();
    const session = await log(rider, { feel: 'sent', weather: 'rain', event: eventId });
    await call('POST', '/api/collections/session_tricks/records', {
      token: rider.token,
      body: { session: session.body.id, trick: fixtures.freeTrick, landed: true },
    });

    const exported = await call<{
      sessions: { feel: string; weather: string; duration: string; spot: string; event: string }[];
      session_tricks: { trick: string; stage_to: string }[];
    }>('POST', '/api/landit/account/export', { token: rider.token, body: {} });
    expect(exported.status).toBe(200);
    expect(exported.body.sessions).toHaveLength(1);
    expect(exported.body.sessions[0]).toMatchObject({
      feel: 'Sent it',
      weather: 'Rain',
      duration: '1h',
      event: 'Session Jam',
    });
    expect(exported.body.sessions[0]!.spot).toMatch(/^Session Park/);
    expect(exported.body.session_tricks[0]).toMatchObject({
      trick: 'Fixture Bunny Hop',
      stage_to: 'Sometimes',
    });

    const deleted = await call('POST', '/api/landit/account/delete', {
      token: rider.token,
      body: { password: rider.password, confirm: 'DELETE' },
    });
    expect(deleted.status).toBe(200);
    expect(await ownSessionCount(rider.id)).toBe(0);
  });
});
