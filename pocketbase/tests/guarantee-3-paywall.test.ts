import { beforeAll, describe, expect, it } from 'vitest';

import { baseFixtures, call, makeRider, superuser, type Fixtures, type Rider } from './helpers';

/**
 * Plan §3, guarantee 3 — the paywall is a data-layer rule, not a UI rule.
 *
 * "The `trick_progress` create hook rejects a paid trick for a rookie-plan
 * rider, whatever the client sends. If the paywall only lives in the client it
 * is a suggestion."
 *
 * Whatever the client sends is the interesting half, so the tests below try the
 * obvious ways round it: another rider's id in the body, an update instead of a
 * create, the log instead of the progress row, and a superuser token.
 */
describe('guarantee 3 — the paywall holds at the data layer', () => {
  let fixtures: Fixtures;
  let rookie: Rider;
  let shredder: Rider;

  beforeAll(async () => {
    fixtures = await baseFixtures();
    rookie = await makeRider({}, { plan: 'rookie', consent_state: 'not_required' });
    shredder = await makeRider({}, { plan: 'shredder', consent_state: 'not_required' });
  });

  it('lets a rookie-plan rider track a free trick', async () => {
    const result = await call('POST', '/api/collections/trick_progress/records', {
      token: rookie.token,
      body: { user: rookie.id, trick: fixtures.freeTrick, stage: 'trying' },
    });
    expect(result.status).toBe(200);
  });

  it('refuses a rookie-plan rider a paid trick on create', async () => {
    const result = await call<{ message: string }>(
      'POST',
      '/api/collections/trick_progress/records',
      {
        token: rookie.token,
        body: { user: rookie.id, trick: fixtures.paidTrick, stage: 'want' },
      },
    );
    expect(result.status).toBe(403);
  });

  it('refuses it however the stage is dressed up', async () => {
    for (const stage of ['want', 'trying', 'some', 'most', 'every']) {
      const result = await call('POST', '/api/collections/trick_progress/records', {
        token: rookie.token,
        body: { user: rookie.id, trick: fixtures.paidTrick, stage },
      });
      expect(result.status).toBe(403);
    }
  });

  it('refuses a rookie writing paid progress against somebody else’s id', async () => {
    const result = await call('POST', '/api/collections/trick_progress/records', {
      token: rookie.token,
      body: { user: shredder.id, trick: fixtures.paidTrick, stage: 'every' },
    });
    expect(result.status).toBe(400);
  });

  it('refuses the paid trick on the log as well as the progress row', async () => {
    const result = await call('POST', '/api/collections/trick_log/records', {
      token: rookie.token,
      body: {
        user: rookie.id,
        trick: fixtures.paidTrick,
        stage: 'every',
        at: '2026-08-01 12:00:00.000Z',
      },
    });
    expect(result.status).toBe(403);
  });

  it('refuses a rookie moving an existing free row onto a paid trick', async () => {
    const solo = await makeRider({}, { plan: 'rookie', consent_state: 'not_required' });
    const created = await call<{ id: string }>('POST', '/api/collections/trick_progress/records', {
      token: solo.token,
      body: { user: solo.id, trick: fixtures.freeTrick, stage: 'some' },
    });
    expect(created.status).toBe(200);

    const moved = await call(
      'PATCH',
      `/api/collections/trick_progress/records/${created.body.id}`,
      {
        token: solo.token,
        body: { trick: fixtures.paidTrick },
      },
    );
    expect(moved.status).toBe(403);
  });

  it('refuses it even to a superuser token — the hook is below the request layer', async () => {
    const token = await superuser();
    const result = await call('POST', '/api/collections/trick_progress/records', {
      token,
      body: { user: rookie.id, trick: fixtures.paidTrick, stage: 'every' },
    });
    expect(result.status).toBe(403);
  });

  it('lets a paid-plan rider track the same paid trick', async () => {
    const result = await call('POST', '/api/collections/trick_progress/records', {
      token: shredder.token,
      body: { user: shredder.id, trick: fixtures.paidTrick, stage: 'every' },
    });
    expect(result.status).toBe(200);
  });

  it('refuses a rider who tries to grant themselves a plan', async () => {
    const climber = await makeRider({}, { plan: 'rookie', consent_state: 'not_required' });
    const attempt = await call('PATCH', `/api/collections/users/records/${climber.id}`, {
      token: climber.token,
      body: { plan: 'legend' },
    });
    expect(attempt.status).toBe(403);

    const still = await call<{ plan: string }>(
      'GET',
      `/api/collections/users/records/${climber.id}`,
      { token: climber.token },
    );
    expect(still.body.plan).toBe('rookie');
  });

  it('refuses a rider who tries to make themselves staff', async () => {
    const climber = await makeRider({}, { consent_state: 'not_required' });
    const attempt = await call('PATCH', `/api/collections/users/records/${climber.id}`, {
      token: climber.token,
      body: { role: 'staff' },
    });
    expect(attempt.status).toBe(403);
  });

  it('ignores a plan or role smuggled into sign-up', async () => {
    const sneaky = await makeRider({ plan: 'legend', role: 'staff' });
    const seen = await call<{ plan: string; role: string }>(
      'GET',
      `/api/collections/users/records/${sneaky.id}`,
      { token: sneaky.token },
    );
    expect(seen.body.plan).toBe('rookie');
    expect(seen.body.role).toBe('rider');
  });
});
