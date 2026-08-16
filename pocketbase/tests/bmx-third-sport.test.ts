import { describe, expect, it } from 'vitest';

import { call, makeRider, superuser } from './helpers';

/**
 * BMX is accepted by the schema (T21, issue #17).
 *
 * A migration that widened nothing would leave every other test in this suite
 * green, because nothing else writes a BMX record. So this asserts the thing
 * the migration exists to do — and asserts the enum still *constrains*, since a
 * widening that accidentally dropped the option list would also let `bmx`
 * through, for the wrong reason.
 */

describe('the schema accepts BMX', () => {
  it('takes a BMX trick', async () => {
    const created = await call<{ sport: string }>('POST', '/api/collections/tricks/records', {
      token: await superuser(),
      body: {
        slug: `bmx-test-${Date.now()}`,
        name: 'Test Bunny Hop',
        sport: 'bmx',
        cat: 'flat',
        diff: 2,
        is_live: true,
      },
    });

    expect(created.status).toBe(200);
    expect(created.body.sport).toBe('bmx');
  });

  it('lets a rider ride all three sports at once', async () => {
    // `maxSelect` was 2 — the number of sports, not a product rule — so before
    // this migration a rider could pick three and save two.
    const rider = await makeRider({ sports: ['scooter', 'skate', 'bmx'] });

    const record = await call<{ sports: string[] }>(
      'GET',
      `/api/collections/users/records/${rider.id}`,
      { token: rider.token },
    );

    expect(record.body.sports).toEqual(['scooter', 'skate', 'bmx']);
  });

  it('takes a spot open to all three sports', async () => {
    const rider = await makeRider();
    const created = await call<{ sports: string[] }>('POST', '/api/collections/spots/records', {
      token: rider.token,
      // The coordinates joined this body in T13: a submitted spot has to be
      // somewhere, or it can never go on the map (`62_spots.pb.js`). What this
      // test is about is the sports enum, which is unchanged.
      body: {
        name: 'Three Sport Park',
        town: 'Corby',
        lat: 52.493,
        lng: -0.689,
        sports: ['scooter', 'skate', 'bmx'],
        status: 'pending',
      },
    });

    expect(created.status).toBe(200);
    expect(created.body.sports).toEqual(['scooter', 'skate', 'bmx']);
  });

  it('takes a BMX sticker and a BMX challenge', async () => {
    const token = await superuser();
    const unique = Date.now();

    const sticker = await call('POST', '/api/collections/stickers/records', {
      token,
      body: { slug: `bmx-test-${unique}`, name: 'BMX Test', sport: 'bmx', is_live: true },
    });
    expect(sticker.status).toBe(200);

    const challenge = await call('POST', '/api/collections/challenges/records', {
      token,
      body: {
        slug: `bmx-test-${unique}`,
        sport: 'bmx',
        title: 'BMX Test Week',
        starts: '2031-01-06 00:00:00.000Z',
        ends: '2031-01-12 00:00:00.000Z',
      },
    });
    expect(challenge.status).toBe(200);
  });

  it('still refuses a sport that does not exist', async () => {
    const created = await call('POST', '/api/collections/tricks/records', {
      token: await superuser(),
      body: {
        slug: `unicycle-test-${Date.now()}`,
        name: 'Test Wheel Walk',
        sport: 'unicycle',
        cat: 'flat',
        diff: 2,
        is_live: true,
      },
    });

    expect(created.status).toBe(400);
  });
});
