import { describe, expect, it } from 'vitest';

import { call, makeRider, superuser } from './helpers';

/**
 * The reporting route and the appeal against it (T18; plan §6.1, §6.5).
 *
 * The OSA duties this is the server half of are two sentences long and both are
 * about who can reach us: **an easy reporting route** that works for somebody
 * who is not a signed-up rider, and **a complaints procedure** covering our own
 * moderation decisions. `reports.createRule` is an empty string — deliberately
 * open — so every assertion below is about what stops an open create rule from
 * being a hole.
 *
 * Everything goes over HTTP, signed out where the duty says signed out, because
 * that is the only thing that proves a browser can do it (plan §3).
 */

const report = async (body: Record<string, unknown>, token?: string) =>
  call<{ id: string; reporter: string; status: string; outcome: string; message: string }>(
    'POST',
    '/api/collections/reports/records',
    {
      ...(token ? { token } : {}),
      body: {
        subject_type: 'profile',
        reason: 'harassment',
        detail: 'Someone is being unpleasant on a crew board.',
        ...body,
      },
    },
  );

describe('a report from somebody who is not a rider', () => {
  it('is accepted signed out, which is the whole duty', async () => {
    const filed = await report({ reporter_email: `visitor-${Date.now()}@example.invalid` });
    expect(filed.status).toBe(200);
    expect(filed.body.reporter).toBe('');
    expect(filed.body.status).toBe('open');
  });

  it('needs a return address, because we promise a reply', async () => {
    const filed = await report({ reporter_email: '' });
    expect(filed.status).toBe(400);
    expect(String(filed.body.message)).toMatch(/email address/i);
  });

  it('cannot be read back by anybody, so it is not a dead drop', async () => {
    const email = `visitor-${Date.now()}-a@example.invalid`;
    const filed = await report({ reporter_email: email, detail: 'A message left in a bottle.' });
    expect(filed.status).toBe(200);

    // Signed out: nothing.
    expect((await call('GET', `/api/collections/reports/records/${filed.body.id}`)).status).toBe(
      404,
    );

    // Signed in as somebody else: also nothing. The view rule is keyed on
    // `reporter`, and an anonymous report has none.
    const stranger = await makeRider();
    const asStranger = await call('GET', `/api/collections/reports/records/${filed.body.id}`, {
      token: stranger.token,
    });
    expect(asStranger.status).toBe(404);
  });
});

describe('what the server decides, whatever the body claimed', () => {
  it('pins the reporter to the account that sent it', async () => {
    const rider = await makeRider();
    const someoneElse = await makeRider();

    const filed = await report({ reporter: someoneElse.id }, rider.token);
    expect(filed.status).toBe(200);
    // Filing under another child's name would be a way to get that child's
    // account read by staff.
    expect(filed.body.reporter).toBe(rider.id);
  });

  it('pins status to open and clears any outcome the body invented', async () => {
    const rider = await makeRider();
    const filed = await report(
      { status: 'dismissed', outcome: 'Nothing to see here' },
      rider.token,
    );

    expect(filed.status).toBe(200);
    expect(filed.body.status).toBe('open');
    expect(filed.body.outcome).toBe('');
  });

  it('does not keep a signed-in reporter’s address a second time', async () => {
    const rider = await makeRider();
    const filed = await call<{ reporter_email: string }>(
      'POST',
      '/api/collections/reports/records',
      {
        token: rider.token,
        body: {
          subject_type: 'spot',
          reason: 'unsafe',
          detail: 'That ramp has a hole in it.',
          reporter_email: 'somebody@example.invalid',
        },
      },
    );
    expect(filed.status).toBe(200);
    expect(filed.body.reporter_email).toBe('');
  });

  it('refuses a report that says nothing', async () => {
    const rider = await makeRider();
    expect((await report({ detail: '   ' }, rider.token)).status).toBe(400);
    expect((await report({ subject_type: 'nonsense' }, rider.token)).status).toBe(400);
    expect((await report({ reason: 'vibes' }, rider.token)).status).toBe(400);
  });

  it('lets the reporter read their own report and nobody else’s', async () => {
    const rider = await makeRider();
    const stranger = await makeRider();
    const filed = await report({}, rider.token);

    expect(
      (
        await call('GET', `/api/collections/reports/records/${filed.body.id}`, {
          token: rider.token,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call('GET', `/api/collections/reports/records/${filed.body.id}`, {
          token: stranger.token,
        })
      ).status,
    ).toBe(404);
  });

  it('gives nobody a client path to change one afterwards', async () => {
    const rider = await makeRider();
    const filed = await report({}, rider.token);

    const patched = await call('PATCH', `/api/collections/reports/records/${filed.body.id}`, {
      token: rider.token,
      body: { status: 'dismissed' },
    });
    expect(patched.status).toBe(403);

    const deleted = await call('DELETE', `/api/collections/reports/records/${filed.body.id}`, {
      token: rider.token,
    });
    expect(deleted.status).toBe(403);
  });
});

describe('appealing what we did about a report', () => {
  it('takes an appeal against your own report and inherits its subject', async () => {
    const rider = await makeRider();
    const original = await report({ subject_type: 'spot', subject_id: 'abc123' }, rider.token);

    const appeal = await call<{ subject_type: string; subject_id: string; complaint_of: string }>(
      'POST',
      '/api/collections/reports/records',
      {
        token: rider.token,
        body: {
          complaint_of: original.body.id,
          subject_type: 'profile',
          subject_id: 'something-else',
          reason: 'other',
          detail: 'You closed this and I do not think you should have.',
        },
      },
    );

    expect(appeal.status).toBe(200);
    expect(appeal.body.complaint_of).toBe(original.body.id);
    // The subject comes off the parent, so an appeal cannot smuggle in a fresh
    // report about somebody else under a reference that has been through triage.
    expect(appeal.body.subject_type).toBe('spot');
    expect(appeal.body.subject_id).toBe('abc123');
  });

  it('refuses an appeal against a report that is not yours, in the same words as one that does not exist', async () => {
    const rider = await makeRider();
    const stranger = await makeRider();
    const theirs = await report({}, stranger.token);

    const notMine = await report({ complaint_of: theirs.body.id }, rider.token);
    const notReal = await report({ complaint_of: 'zzzzzzzzzzzzzzz' }, rider.token);

    expect(notMine.status).toBe(400);
    expect(notReal.status).toBe(400);
    // Identical, so the field cannot be used to test whether an id is a report.
    expect(String(notMine.body.message)).toBe(String(notReal.body.message));
  });

  it('lets a signed-out complainant appeal with the address they used', async () => {
    const email = `visitor-${Date.now()}-b@example.invalid`;
    const original = await report({ reporter_email: email });
    expect(original.status).toBe(200);

    const appeal = await report({ reporter_email: email, complaint_of: original.body.id });
    expect(appeal.status).toBe(200);

    const impostor = await report({
      reporter_email: `visitor-${Date.now()}-c@example.invalid`,
      complaint_of: original.body.id,
    });
    expect(impostor.status).toBe(400);
  });

  it('stops at one level, so an appeal against an appeal is refused', async () => {
    const rider = await makeRider();
    const original = await report({}, rider.token);
    const appeal = await report({ complaint_of: original.body.id }, rider.token);
    expect(appeal.status).toBe(200);

    const again = await report({ complaint_of: appeal.body.id }, rider.token);
    expect(again.status).toBe(400);
    expect(String(again.body.message)).toMatch(/twice/i);
  });
});

describe('a reporter cannot flood the queue a person reads', () => {
  it('refuses the sixth report in an hour from one account', async () => {
    const rider = await makeRider();
    for (let i = 0; i < 5; i += 1) {
      expect((await report({ detail: `Burst ${i}` }, rider.token)).status).toBe(200);
    }
    const refused = await report({ detail: 'Burst 6' }, rider.token);
    expect(refused.status).toBe(429);
  });

  it('counts a signed-out reporter by their address, not globally', async () => {
    const noisy = `noisy-${Date.now()}@example.invalid`;
    const quiet = `quiet-${Date.now()}@example.invalid`;

    for (let i = 0; i < 5; i += 1) {
      expect((await report({ reporter_email: noisy, detail: `Burst ${i}` })).status).toBe(200);
    }
    expect((await report({ reporter_email: noisy, detail: 'Burst 6' })).status).toBe(429);

    // One flood must not close the reporting route for everybody else — that is
    // the duty the route exists to discharge.
    expect((await report({ reporter_email: quiet })).status).toBe(200);
  });

  it('caps how many may be open at once, so tomorrow is not a way round it', async () => {
    const rider = await makeRider();
    const token = await superuser();

    // Written with a superuser token, the only way to reach twenty open without
    // the hourly window refusing the sixth first.
    for (let i = 0; i < 20; i += 1) {
      const written = await call('POST', '/api/collections/reports/records', {
        token,
        body: {
          reporter: rider.id,
          subject_type: 'other',
          reason: 'spam',
          detail: `Backlog ${i}`,
          status: 'open',
        },
      });
      expect(written.status).toBe(200);
    }

    const refused = await report({ detail: 'One too many' }, rider.token);
    expect(refused.status).toBe(429);
    expect(String(refused.body.message)).toMatch(/waiting with us/i);
  });
});

describe('the numbers the form quotes are the numbers the server keeps', () => {
  it('matches the constants in @landit/core', async () => {
    // Same arrangement as `spot-submission.test.ts`: `packages/core` defines the
    // limits so a screen can say what will happen, this hook enforces them, and
    // a drift between the two is a screen that lies. Both read as text — the
    // hook is a JSVM module no bundler can load.
    const { readFileSync } = await import('node:fs');
    const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
    const hook = read('../hooks/95_reports.pb.js');
    const rules = read('../../packages/core/src/rules/reports.ts');

    const numberIn = (source: string, name: string): string => {
      const found = new RegExp(`${name}\\s*=\\s*(\\d+)`).exec(source);
      if (!found) throw new Error(`${name} is not in that file any more.`);
      return found[1]!;
    };

    for (const name of [
      'REPORT_WINDOW_MINUTES',
      'REPORT_MAX_PER_WINDOW',
      'REPORT_MAX_OPEN',
      'DETAIL_MAX',
    ]) {
      const inRules = name === 'DETAIL_MAX' ? 'REPORT_DETAIL_MAX' : name;
      expect(numberIn(hook, name)).toBe(numberIn(rules, inRules));
    }
  });

  it('offers every reason and subject the collection will accept', async () => {
    // A value the schema allows and the form never offers is a report nobody
    // can file; a value the form offers and the schema refuses is a 400 with no
    // explanation. Both lists are checked against the migration, as text.
    const { readFileSync } = await import('node:fs');
    const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
    const migration = read('../migrations/1786838400_init_collections.js');
    const rules = read('../../packages/core/src/rules/reports.ts');

    for (const value of ['profile', 'clip', 'spot', 'other']) {
      expect(migration).toContain(`'${value}'`);
      expect(rules).toContain(`id: '${value}'`);
    }
    for (const value of [
      'harassment',
      'unsafe',
      'illegal',
      'sexual',
      'self_harm',
      'spam',
      'other',
    ]) {
      expect(rules).toContain(`id: '${value}'`);
    }
  });
});
