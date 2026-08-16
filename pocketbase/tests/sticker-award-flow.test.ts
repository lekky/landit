import { beforeAll, describe, expect, it } from 'vitest';

import { baseFixtures, call, ensureRecord, makeRider, type Rider } from './helpers';

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
  await ensureRecord('stickers', "slug = 'week-one'", {
    slug: 'week-one',
    name: 'Kept It Up',
    hue: '#FFC23F',
    ico: 'flame',
    cond: 'weeks in a row',
    n: 4,
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
    expect(Object.keys(await held(short))).not.toContain('week-one');

    const long = await makeRider({}, { streak: 4 });
    await track(long, freeTrick);
    expect(Object.keys(await held(long))).toContain('week-one');
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
