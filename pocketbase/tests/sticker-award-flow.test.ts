import { beforeAll, describe, expect, it } from 'vitest';

import { baseFixtures, call, ensureRecord, makeRider, superuser, type Rider } from './helpers';

/**
 * The sticker award flow, end to end and over HTTP (plan §7, T10).
 *
 * The claim being proved is not "the rules are right" — `packages/core` holds
 * that, in unit tests. It is the harder one plan §3 makes: **the award happens
 * on the server, from stats the server recomputed, and a client has no path to
 * one.** `rider_stickers.createRule` is `null` and the hook on `trick_progress`
 * is the only writer, so a sticker is earned or it does not exist.
 *
 * Everything below is a request and a status code. A test that read the hook's
 * rule map would prove somebody typed a string (LESSONS §5).
 */

/** The sticker records the flow is judged against. Created once, shared. */
async function stickerFixtures() {
  await ensureRecord('stickers', "slug = 'first-land'", {
    slug: 'first-land',
    name: 'First Land',
    hue: '#FF5A8A',
    ico: 'check',
    cond: 'Log your first trick',
    is_live: true,
  });
  await ensureRecord('stickers', "slug = 'gnarly'", {
    slug: 'gnarly',
    name: 'Gnarly',
    hue: '#16140F',
    ico: 'skull',
    cond: 'difficulty 5 tricks landed',
    n: 1,
    is_live: true,
  });
  // Award-era (T24): a kind-based record. The rule shape is the hook's
  // `KIND_RULES.streak`; the record carries only the threshold.
  await ensureRecord('stickers', "slug = 'hot-streak'", {
    slug: 'hot-streak',
    name: 'Hot Streak',
    hue: '#e0392b',
    ico: 'star',
    cond: 'weeks in a row',
    n: 4,
    kind: 'streak',
    img: 'hot-streak.png',
    stars: 1,
    is_live: true,
  });
  // A trick award (T24) keyed to the shared fixture trick.
  await ensureRecord('stickers', "slug = 'fixture-bunny-hop'", {
    slug: 'fixture-bunny-hop',
    name: 'Bunny Hop',
    sport: 'scooter',
    hue: '#ffc23f',
    ico: 'star',
    cond: 'Land the Bunny Hop',
    kind: 'trick',
    trick: 'fixture-bunny-hop',
    img: 'bunny-hop.png',
    stars: 1,
    is_live: true,
  });
  await ensureRecord('stickers', "slug = 'on-the-map'", {
    slug: 'on-the-map',
    name: 'On The Map',
    hue: '#ff5a1f',
    ico: 'star',
    cond: 'Get a spot you found onto the map',
    kind: 'spots-approved',
    is_live: true,
  });
  await ensureRecord('stickers', "slug = 'showed-up'", {
    slug: 'showed-up',
    name: 'Showed Up',
    hue: '#8a3be0',
    ico: 'star',
    cond: 'Mark yourself going to an event',
    kind: 'events-going',
    is_live: true,
  });
  await ensureRecord('stickers', "slug = 'supporter'", {
    slug: 'supporter',
    name: 'Supporter',
    hue: '#8a3be0',
    ico: 'star',
    cond: 'Back Land The Trick with a paid plan',
    kind: 'supporter',
    is_live: true,
  });
  await ensureRecord('stickers', "slug = 'comeback'", {
    slug: 'comeback',
    name: 'Comeback',
    hue: '#e0392b',
    ico: 'star',
    cond: 'Ride again after two months away',
    kind: 'comeback',
    is_live: true,
  });
  await ensureRecord('stickers', "slug = 'keeping-it-real'", {
    slug: 'keeping-it-real',
    name: 'Keeping It Real',
    hue: '#ffc23f',
    ico: 'star',
    cond: 'Move a trick down a stage. Honesty counts',
    kind: 'stage-drop',
    is_live: true,
  });
  await ensureRecord('stickers', "slug = 'both-feet'", {
    slug: 'both-feet',
    name: 'Crossover',
    hue: '#2EC4B6',
    ico: 'grid',
    cond: 'Land tricks on two different sports',
    is_live: true,
  });
  // Deliberately created **live**, which is not how it ships (issue #77): the
  // point of the test below is that switching a retired sticker back on from
  // the admin portal still cannot award it, because the rule is gone from the
  // server rather than merely hidden.
  await ensureRecord('stickers', "slug = 'upside'", {
    slug: 'upside',
    name: 'Upside Down',
    sport: 'scooter',
    hue: '#FF3D78',
    ico: 'rotate',
    cond: 'Retired',
    is_live: true,
  });
}

/** The `upside` rule named this slug. The trick has to exist for its absence to mean anything. */
async function flipTrick(): Promise<string> {
  const record = await ensureRecord('tricks', "slug = 'backflip'", {
    slug: 'backflip',
    name: 'Backflip',
    sport: 'scooter',
    cat: 'air',
    diff: 5,
    is_live: true,
  });
  return record.id;
}

async function bmxTrick(): Promise<string> {
  const record = await ensureRecord('tricks', "slug = 'fixture-bmx-hop'", {
    slug: 'fixture-bmx-hop',
    name: 'Fixture BMX Hop',
    sport: 'bmx',
    cat: 'flat',
    diff: 1,
    is_live: true,
  });
  return record.id;
}

/** Track a trick at a landed stage, the way the app does. */
async function track(rider: Rider, trickId: string, stage = 'some') {
  return call('POST', '/api/collections/trick_progress/records', {
    token: rider.token,
    body: { user: rider.id, trick: trickId, stage },
  });
}

interface RiderSticker {
  id: string;
  sticker: string;
  earned_at: string;
  seen_at: string;
}

/** What the rider holds, with the sticker slug resolved. */
async function held(rider: Rider): Promise<Record<string, RiderSticker>> {
  const rows = await call<{ items: RiderSticker[] }>(
    'GET',
    '/api/collections/rider_stickers/records',
    { token: rider.token, query: { filter: `user = "${rider.id}"`, perPage: '200' } },
  );
  const stickers = await call<{ items: { id: string; slug: string }[] }>(
    'GET',
    '/api/collections/stickers/records',
    { token: rider.token, query: { perPage: '200' } },
  );
  const slugOf = new Map((stickers.body.items ?? []).map((s) => [s.id, s.slug]));

  const out: Record<string, RiderSticker> = {};
  for (const row of rows.body.items ?? []) {
    const slug = slugOf.get(row.sticker);
    if (slug) out[slug] = row;
  }
  return out;
}

beforeAll(async () => {
  await baseFixtures();
  await stickerFixtures();
});

describe('the server awards stickers, and only the server', () => {
  it('awards on the write, from stats it recomputed itself', async () => {
    const { freeTrick } = await baseFixtures();
    const rider = await makeRider();

    expect(await held(rider)).toEqual({});

    const tracked = await track(rider, freeTrick);
    expect(tracked.status).toBe(200);

    const after = await held(rider);
    expect(Object.keys(after)).toContain('first-land');
    expect(after['first-land']?.earned_at).toBeTruthy();
    // Never announced yet. This is the field that makes "once" true (plan §3).
    expect(after['first-land']?.seen_at).toBe('');
  });

  it('refuses a rider inventing one for themselves', async () => {
    const rider = await makeRider();
    const sticker = await ensureRecord('stickers', "slug = 'gnarly'", {});

    const forged = await call('POST', '/api/collections/rider_stickers/records', {
      token: rider.token,
      body: { user: rider.id, sticker: sticker.id, earned_at: new Date().toISOString() },
    });

    // `createRule: null` — there is no client path at all, which is what makes
    // "achievements are never for sale" a fact rather than a promise (plan §1).
    expect([400, 403, 404]).toContain(forged.status);
    expect(await held(rider)).toEqual({});
  });

  it('lets a rider mark one seen, and nothing else', async () => {
    const { freeTrick } = await baseFixtures();
    const rider = await makeRider();
    await track(rider, freeTrick);

    const row = (await held(rider))['first-land'];
    expect(row).toBeDefined();

    const seen = await call('PATCH', `/api/collections/rider_stickers/records/${row!.id}`, {
      token: rider.token,
      body: { seen_at: new Date().toISOString() },
    });
    expect(seen.status).toBe(200);
    expect((await held(rider))['first-land']?.seen_at).not.toBe('');

    // Moving the award itself is refused: a rider who could rewrite
    // `earned_at`, or point the row at a different sticker, could hand
    // themselves any badge on the wall.
    const forged = await call('PATCH', `/api/collections/rider_stickers/records/${row!.id}`, {
      token: rider.token,
      body: { earned_at: '2020-01-01 00:00:00.000Z' },
    });
    expect(forged.status).toBe(403);
  });

  it('never re-awards, so a seen sticker is never announced twice', async () => {
    const { freeTrick, freeTrickSkate } = await baseFixtures();
    const rider = await makeRider();
    await track(rider, freeTrick);

    const first = (await held(rider))['first-land'];
    await call('PATCH', `/api/collections/rider_stickers/records/${first!.id}`, {
      token: rider.token,
      body: { seen_at: new Date().toISOString() },
    });

    // A second write re-runs every rule. The row it would create already
    // exists, so nothing is re-created and `seen_at` is left where the rider
    // put it.
    const again = await track(rider, freeTrickSkate);
    expect(again.status).toBe(200);

    const after = (await held(rider))['first-land'];
    expect(after?.id).toBe(first!.id);
    expect(after?.seen_at).not.toBe('');
  });
});

describe('what the rules award, judged over HTTP', () => {
  it('counts weeks, not days, on the streak sticker (issue #10)', async () => {
    const { freeTrick } = await baseFixtures();

    const short = await makeRider({}, { streak: 3 });
    await track(short, freeTrick);
    expect(Object.keys(await held(short))).not.toContain('hot-streak');

    const long = await makeRider({}, { streak: 4 });
    await track(long, freeTrick);
    expect(Object.keys(await held(long))).toContain('hot-streak');
  });

  it('counts two or more sports, not scooter and skate (issue from T21)', async () => {
    const { freeTrick } = await baseFixtures();
    const bmx = await bmxTrick();

    const rider = await makeRider({ sports: ['scooter', 'bmx'] });
    await track(rider, freeTrick);
    expect(Object.keys(await held(rider))).not.toContain('both-feet');

    await track(rider, bmx);
    // The server-side copy said `scooter && skate` until T10, so a rider on
    // scooter and BMX was shown this sticker by the client and refused it here.
    expect(Object.keys(await held(rider))).toContain('both-feet');
  });

  it('never badges an inversion, even with the record switched live (issue #77)', async () => {
    const flip = await flipTrick();
    const rider = await makeRider({}, { plan: 'shredder' });

    const tracked = await track(rider, flip, 'every');
    expect(tracked.status).toBe(200);

    const after = await held(rider);
    // The difficulty-5 recognition still lands — it just does not name a target.
    expect(Object.keys(after)).toContain('gnarly');
    expect(Object.keys(after)).not.toContain('upside');
  });
});

/**
 * The award era (T24), judged over HTTP like everything above: every new
 * award source is a server hook, and the client's only part is the ordinary
 * write that triggered it.
 */
describe('the award era, over HTTP', () => {
  it('awards a trick badge from its kind, on the progress write', async () => {
    const { freeTrick } = await baseFixtures();
    const rider = await makeRider();

    await track(rider, freeTrick);
    const after = await held(rider);
    // `fixture-bunny-hop` is a kind-based record (`kind: 'trick'`) — no
    // slug-keyed rule exists for it in the hook, so this passing is the kind
    // resolution working end to end.
    expect(Object.keys(after)).toContain('fixture-bunny-hop');
  });

  it('awards the contributor when staff approve their spot, and not before', async () => {
    const rider = await makeRider();

    const submitted = await call<{ id: string }>('POST', '/api/collections/spots/records', {
      token: rider.token,
      body: {
        name: `Award Fixture Park ${rider.id.slice(0, 6)}`,
        town: 'Skegness',
        lat: 53.143,
        lng: 0.343,
        sports: ['scooter'],
        status: 'pending',
        submitted_by: rider.id,
      },
    });
    expect(submitted.status).toBe(200);
    // Pending reaches nobody, including the award pass.
    expect(Object.keys(await held(rider))).not.toContain('on-the-map');

    const approved = await call('PATCH', `/api/collections/spots/records/${submitted.body.id}`, {
      token: await superuser(),
      body: { status: 'live' },
    });
    expect(approved.status).toBe(200);
    expect(Object.keys(await held(rider))).toContain('on-the-map');
  });

  it(`awards "I'm going" the moment the attendance row lands`, async () => {
    const event = await ensureRecord('events', "slug = 'fixture-award-jam'", {
      slug: 'fixture-award-jam',
      name: 'Fixture Award Jam',
      kind: 'Jam',
      town: 'Hull',
      date: '2026-10-01 10:00:00.000Z',
      is_live: true,
    });
    const rider = await makeRider();

    const going = await call('POST', '/api/collections/event_attendance/records', {
      token: rider.token,
      body: { user: rider.id, event: event.id },
    });
    expect(going.status).toBe(200);
    expect(Object.keys(await held(rider))).toContain('showed-up');
  });

  it('recognises a supporter from the server-resolved plan, never a client claim', async () => {
    // `makeRider` sets the plan with a superuser call — the same server-owned
    // write Stripe's webhook path uses. The users hook awards on it directly.
    const paying = await makeRider({}, { plan: 'shredder' });
    expect(Object.keys(await held(paying))).toContain('supporter');

    const free = await makeRider();
    expect(Object.keys(await held(free))).not.toContain('supporter');
  });

  it('grants the comeback on the ride after a two-month gap, and only then', async () => {
    const rider = await makeRider();
    const token = await superuser();

    // First ride, recorded. No previous ride, so no gap and no badge.
    const first = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      token,
      body: { last_ride: '2026-06-01 00:00:00.000Z' },
    });
    expect(first.status).toBe(200);
    expect(Object.keys(await held(rider))).not.toContain('comeback');

    // A ride within the window moves the date without a badge.
    await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      token,
      body: { last_ride: '2026-06-20 00:00:00.000Z' },
    });
    expect(Object.keys(await held(rider))).not.toContain('comeback');

    // Two months away, then back on the deck.
    const back = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      token,
      body: { last_ride: '2026-08-29 00:00:00.000Z' },
    });
    expect(back.status).toBe(200);
    expect(Object.keys(await held(rider))).toContain('comeback');
  });

  it('rewards moving a trick down a stage — the honesty award', async () => {
    const { freeTrick } = await baseFixtures();
    const rider = await makeRider();

    // Up first: land it, and log the landing the way the app does.
    const tracked = await call<{ id: string }>('POST', '/api/collections/trick_progress/records', {
      token: rider.token,
      body: { user: rider.id, trick: freeTrick, stage: 'most' },
    });
    expect(tracked.status).toBe(200);
    await call('POST', '/api/collections/trick_log/records', {
      token: rider.token,
      body: { user: rider.id, trick: freeTrick, stage: 'most', at: '2026-08-20 10:00:00.000Z' },
    });
    expect(Object.keys(await held(rider))).not.toContain('keeping-it-real');

    // Honesty: it stopped being "most", and the rider says so.
    await call('POST', '/api/collections/trick_log/records', {
      token: rider.token,
      body: { user: rider.id, trick: freeTrick, stage: 'some', at: '2026-08-27 10:00:00.000Z' },
    });
    const downgraded = await call(
      'PATCH',
      `/api/collections/trick_progress/records/${tracked.body.id}`,
      { token: rider.token, body: { stage: 'some' } },
    );
    expect(downgraded.status).toBe(200);
    expect(Object.keys(await held(rider))).toContain('keeping-it-real');
  });
});
