import { describe, expect, it } from 'vitest';

import { call, makeRider, superuser } from './helpers';

/**
 * Spot submission, as observed HTTP behaviour (plan §7, T13).
 *
 * Three promises live on the server, and only on the server:
 *
 * - **A submitted spot reaches nobody until a human approves it** (plan §6.1).
 *   That is `60_ownership.pb.js` pinning `status` and `submitted_by`, and the
 *   `spots` list rule hiding a `pending` row from everybody but its author.
 * - **A submission describes a findable place**, or it is refused —
 *   `62_spots.pb.js`.
 * - **A rider cannot flood the queue.** Three an hour, ten waiting.
 *
 * Everything below goes over the API with a rider's own token, because that is
 * the only thing that proves a browser cannot do it either. Each refusal was
 * watched fail with the hook removed before it was believed (LESSONS §5): with
 * `62_spots.pb.js` deleted, seven of these turn red and the two `pending` tests
 * stay green, which is what tells the two hooks apart.
 */

const somewhere = { lat: 53.4695, lng: -2.9877 };

const submit = async (token: string, body: Record<string, unknown> = {}) =>
  call<{ id: string; status: string; submitted_by: string; message: string }>(
    'POST',
    '/api/collections/spots/records',
    {
      token,
      body: {
        name: 'Test Spot',
        town: 'Liverpool',
        type: 'Concrete',
        ...somewhere,
        sports: ['scooter'],
        ...body,
      },
    },
  );

describe('a rider submitting a spot', () => {
  it('lands it as pending, owned by them, whatever the body claimed', async () => {
    const rider = await makeRider();
    const created = await submit(rider.token, { name: 'Pending Spot', status: 'live' });

    expect(created.status).toBe(200);
    expect(created.body.status).toBe('pending');
    expect(created.body.submitted_by).toBe(rider.id);
  });

  it('shows it to nobody else, which is the whole point of the queue', async () => {
    const author = await makeRider();
    const stranger = await makeRider();
    const created = await submit(author.token, { name: 'Invisible Spot' });

    const asAuthor = await call('GET', `/api/collections/spots/records/${created.body.id}`, {
      token: author.token,
    });
    expect(asAuthor.status).toBe(200);

    const asStranger = await call('GET', `/api/collections/spots/records/${created.body.id}`, {
      token: stranger.token,
    });
    expect(asStranger.status).toBe(404);

    const asVisitor = await call('GET', `/api/collections/spots/records/${created.body.id}`);
    expect(asVisitor.status).toBe(404);
  });

  it('cannot approve their own spot afterwards', async () => {
    const rider = await makeRider();
    const created = await submit(rider.token, { name: 'Self Approved' });

    const patched = await call('PATCH', `/api/collections/spots/records/${created.body.id}`, {
      token: rider.token,
      body: { status: 'live' },
    });
    // `updateRule` is null: there is no client path to `live` at all.
    expect(patched.status).toBe(403);
  });
});

describe('a submission has to describe a findable place', () => {
  it('refuses one with no name', async () => {
    const rider = await makeRider();
    expect((await submit(rider.token, { name: '   ' })).status).toBe(400);
  });

  it('refuses a type that is not one of the three, but takes no type at all', async () => {
    // The form insists on one (`spotSubmissionProblems` in `@landit/core`); the
    // server only refuses a value that would make the queue's facet a lie.
    const rider = await makeRider();
    expect((await submit(rider.token, { type: 'Rooftop' })).status).toBe(400);
    expect((await submit(rider.token, { type: '', name: 'No Type' })).status).toBe(200);
  });

  it('refuses a spot with no location, including the empty-field zero', async () => {
    const rider = await makeRider();

    // An unset number field reads as 0. Accepting it would put a Liverpool
    // skatepark six hundred miles off the coast of Ghana.
    expect((await submit(rider.token, { lat: 0, lng: 0 })).status).toBe(400);
    expect((await submit(rider.token, { lat: 91, lng: 0 })).status).toBe(400);
    expect((await submit(rider.token, { lat: 0, lng: 181 })).status).toBe(400);
  });

  it('trims what it stores, so " Rampworx " and "Rampworx" are one place', async () => {
    const rider = await makeRider();
    const created = await submit(rider.token, { name: '  Trimmed Spot  ', town: '  Leeds  ' });
    expect(created.status).toBe(200);

    const read = await call<{ name: string; town: string }>(
      'GET',
      `/api/collections/spots/records/${created.body.id}`,
      { token: rider.token },
    );
    expect(read.body.name).toBe('Trimmed Spot');
    expect(read.body.town).toBe('Leeds');
  });
});

describe('a rider cannot flood the review queue', () => {
  it('refuses the fourth submission in an hour with a 429', async () => {
    const rider = await makeRider();

    for (let i = 0; i < 3; i += 1) {
      const allowed = await submit(rider.token, { name: `Burst ${i}` });
      expect(allowed.status).toBe(200);
    }

    const refused = await submit(rider.token, { name: 'Burst 4' });
    expect(refused.status).toBe(429);
    // A sentence a fourteen year old can act on, not a status code.
    expect(String(refused.body.message)).toMatch(/give it a bit/i);
  });

  it('counts per rider, so one rider’s burst does not stop another', async () => {
    const noisy = await makeRider();
    const quiet = await makeRider();

    for (let i = 0; i < 3; i += 1) await submit(noisy.token, { name: `Noisy ${i}` });
    expect((await submit(noisy.token, { name: 'Noisy 4' })).status).toBe(429);

    expect((await submit(quiet.token, { name: 'Quiet 1' })).status).toBe(200);
  });

  it('caps how many may be waiting at once, so tomorrow is not a way round it', async () => {
    const rider = await makeRider();
    const token = await superuser();

    // Written with a superuser token, which is the only way to get a rider to
    // ten pending without the hourly window refusing the fourth. That the
    // superuser path skips the limit is the design (staff publish spots on
    // riders' behalf), and it is why the backlog check has to come first: with
    // ten waiting, this rider is refused for the reason that is true of them.
    for (let i = 0; i < 10; i += 1) {
      const written = await call('POST', '/api/collections/spots/records', {
        token,
        body: {
          name: `Backlog ${i} ${rider.handle}`,
          town: 'Leeds',
          type: 'Concrete',
          ...somewhere,
          status: 'pending',
          submitted_by: rider.id,
        },
      });
      expect(written.status).toBe(200);
    }

    const refused = await submit(rider.token, { name: 'One too many' });
    expect(refused.status).toBe(429);
    expect(String(refused.body.message)).toMatch(/waiting to be checked/i);
  });
});

describe('the numbers the form quotes are the numbers the server keeps', () => {
  it('matches the constants in @landit/core', async () => {
    // `packages/core` defines the limits so the form can warn before the server
    // refuses; this hook enforces them. Two copies is the plan's arrangement
    // (§3) — a drift between them is a form that lies, so it fails here.
    //
    // Both files are read as text rather than imported: the hook is a
    // PocketBase JSVM module that no bundler can load, and matching it against
    // the rule package's own source keeps the check symmetrical.
    const { readFileSync } = await import('node:fs');
    const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
    const hook = read('../hooks/62_spots.pb.js');
    const rules = read('../../packages/core/src/rules/spots.ts');

    const numberIn = (source: string, name: string): string => {
      const found = new RegExp(`${name}\\s*=\\s*(\\d+)`).exec(source);
      if (!found) throw new Error(`${name} is not in that file any more.`);
      return found[1]!;
    };

    expect(numberIn(hook, 'SPOT_WINDOW_MINUTES')).toBe(
      numberIn(rules, 'SPOT_SUBMISSION_WINDOW_MINUTES'),
    );
    expect(numberIn(hook, 'SPOT_MAX_PER_WINDOW')).toBe(
      numberIn(rules, 'SPOT_SUBMISSION_MAX_PER_WINDOW'),
    );
    expect(numberIn(hook, 'SPOT_MAX_PENDING')).toBe(numberIn(rules, 'SPOT_SUBMISSION_MAX_PENDING'));
    expect(numberIn(hook, 'SPOT_MAX_TAGS')).toBe(numberIn(rules, 'SPOT_MAX_TAGS'));
  });
});
