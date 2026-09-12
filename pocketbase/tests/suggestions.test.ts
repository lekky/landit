import { describe, expect, it } from 'vitest';

import { call, makeRider, superuser } from './helpers';

/**
 * The suggestion box, proven over HTTP (2026-09-12).
 *
 * `/suggest` exists because ideas were arriving through `/report` — the only
 * free-text box in the product — filed under a harm reason into the queue staff
 * have promised to answer within one working day. The fix was a second
 * collection rather than a sixth `subject_type`, and **the reason is a safety
 * one**: `reports` is capped at five an hour and twenty open, so a rider who
 * spent that allowance on trick requests could not then report a child in
 * danger.
 *
 * That claim is the last test in this file, and it is the one worth keeping.
 * Everything above it is the ordinary shape of a create hook.
 */

const suggest = async (body: Record<string, unknown>, token?: string) =>
  call<{ id: string; rider: string; status: string; note: string; message: string }>(
    'POST',
    '/api/collections/suggestions/records',
    {
      ...(token ? { token } : {}),
      body: {
        topic: 'trick',
        detail: 'The Bri Flip is not in the scooter library.',
        ...body,
      },
    },
  );

describe('who may send us an idea', () => {
  it('takes one from a signed-in rider', async () => {
    const rider = await makeRider();
    const filed = await suggest({}, rider.token);

    expect(filed.status).toBe(200);
    expect(filed.body.rider).toBe(rider.id);
    expect(filed.body.status).toBe('new');
    expect(filed.body.note).toBe('');
  });

  it('refuses one signed out, where `/report` would have taken it', async () => {
    // The difference between the two routes, asserted. `reports.createRule` is
    // the empty string because the OSA codes require a route for somebody with
    // no account; no duty asks the same of a suggestion box, and an open one is
    // a spam target with a person at the end of it.
    const filed = await suggest({});
    expect(filed.status).toBe(400);
  });

  it('cannot be filed under somebody else’s name', async () => {
    const rider = await makeRider();
    const stranger = await makeRider();

    const filed = await suggest({ rider: stranger.id }, rider.token);
    expect(filed.status).toBe(200);
    expect(filed.body.rider).toBe(rider.id);
  });

  it('cannot arrive already judged, or with staff’s note already written', async () => {
    const rider = await makeRider();
    const filed = await suggest({ status: 'declined', note: 'Nope.' }, rider.token);

    expect(filed.status).toBe(200);
    expect(filed.body.status).toBe('new');
    expect(filed.body.note).toBe('');
  });
});

describe('what an idea has to say', () => {
  it('needs a topic from the list', async () => {
    const rider = await makeRider();
    expect((await suggest({ topic: 'spot' }, rider.token)).status).toBe(400);
    expect((await suggest({ topic: '' }, rider.token)).status).toBe(400);
  });

  it('needs words, and not too many of them', async () => {
    const rider = await makeRider();
    expect((await suggest({ detail: '   ' }, rider.token)).status).toBe(400);
    expect((await suggest({ detail: 'x'.repeat(1001) }, rider.token)).status).toBe(400);
  });
});

describe('who may read one back', () => {
  it('is the rider who sent it, and nobody else', async () => {
    const rider = await makeRider();
    const filed = await suggest({ detail: 'An idea I had.' }, rider.token);
    expect(filed.status).toBe(200);

    // Its author: yes.
    expect(
      (
        await call(`GET`, `/api/collections/suggestions/records/${filed.body.id}`, {
          token: rider.token,
        })
      ).status,
    ).toBe(200);

    // Another rider: nothing. There is no idea board and no voting, so one
    // rider's typing is never rendered to another (plan §6.1).
    const stranger = await makeRider();
    expect(
      (
        await call('GET', `/api/collections/suggestions/records/${filed.body.id}`, {
          token: stranger.token,
        })
      ).status,
    ).toBe(404);

    // Signed out: nothing.
    expect(
      (await call('GET', `/api/collections/suggestions/records/${filed.body.id}`)).status,
    ).toBe(404);
  });

  it('cannot be edited or deleted by its author — status and note are staff’s', async () => {
    const rider = await makeRider();
    const filed = await suggest({}, rider.token);

    /*
     * `403`, not the `404` the read tests above get, and the difference is
     * PocketBase's rather than ours: a rule that resolves to "nobody" refuses
     * outright, where a rule the caller simply falls outside of hides the row.
     * Asserted as it actually answers — a test that wrote down the wrong number
     * and passed would be testing nothing.
     */
    const patched = await call('PATCH', `/api/collections/suggestions/records/${filed.body.id}`, {
      token: rider.token,
      body: { status: 'accepted', note: 'I accept my own idea.' },
    });
    expect(patched.status).toBe(403);

    const deleted = await call('DELETE', `/api/collections/suggestions/records/${filed.body.id}`, {
      token: rider.token,
    });
    expect(deleted.status).toBe(403);

    // And it is still as it was filed.
    const unchanged = await call<{ status: string; note: string }>(
      'GET',
      `/api/collections/suggestions/records/${filed.body.id}`,
      { token: rider.token },
    );
    expect(unchanged.body.status).toBe('new');
    expect(unchanged.body.note).toBe('');
  });
});

describe('an idea never spends the safeguarding budget', () => {
  /*
   * **The reason this collection exists**, and the one test here that is about
   * more than a create hook.
   *
   * If suggestions had shipped as a sixth `reports.subject_type`, the limiter
   * in `95_reports.pb.js` would count them: five an hour, shared. A rider with
   * a few ideas would then be refused when they tried to report something
   * unsafe, and the refusal would arrive at the worst possible moment with a
   * message about sending too much. Two collections is what stops that, and
   * nothing but a test will stop somebody merging them back together later.
   */
  it('leaves the report route wide open after the idea limit is spent', async () => {
    const rider = await makeRider();

    // Spend the suggestion allowance — three an hour, per the hook.
    for (let i = 0; i < 3; i += 1) {
      const filed = await suggest({ detail: `Idea number ${i}.` }, rider.token);
      expect(filed.status).toBe(200);
    }

    // The fourth is refused, as 429 rather than 400: it is a well-formed
    // request that would have been allowed an hour ago.
    const refused = await suggest({ detail: 'One idea too many.' }, rider.token);
    expect(refused.status).toBe(429);

    // And the safeguarding route is untouched, which is the whole point.
    const report = await call<{ status: string }>('POST', '/api/collections/reports/records', {
      token: rider.token,
      body: {
        subject_type: 'profile',
        reason: 'unsafe',
        detail: 'Something that actually needs looking at.',
      },
    });
    expect(report.status).toBe(200);
    expect(report.body.status).toBe('open');
  });

  it('counts its own table, so a pile of reports does not block an idea', async () => {
    // The other direction of the same guarantee.
    const rider = await makeRider();

    for (let i = 0; i < 5; i += 1) {
      const filed = await call('POST', '/api/collections/reports/records', {
        token: rider.token,
        body: {
          subject_type: 'profile',
          reason: 'spam',
          detail: `A report, number ${i}.`,
        },
      });
      expect(filed.status).toBe(200);
    }

    expect((await suggest({ detail: 'Still able to suggest things.' }, rider.token)).status).toBe(
      200,
    );
  });
});

describe('staff triage', () => {
  it('is the only way status and note move, and the rider reads the note back', async () => {
    const rider = await makeRider();
    const filed = await suggest({ detail: 'Add a dark mode.' }, rider.token);
    expect(filed.status).toBe(200);

    const triaged = await call('PATCH', `/api/collections/suggestions/records/${filed.body.id}`, {
      token: await superuser(),
      body: { status: 'accepted', note: 'Good shout — it is on the list.' },
    });
    expect(triaged.status).toBe(200);

    const readBack = await call<{ status: string; note: string }>(
      'GET',
      `/api/collections/suggestions/records/${filed.body.id}`,
      { token: rider.token },
    );
    expect(readBack.status).toBe(200);
    expect(readBack.body.status).toBe('accepted');
    expect(readBack.body.note).toBe('Good shout — it is on the list.');
  });
});
