import { beforeAll, describe, expect, it } from 'vitest';

import { baseFixtures, call, makeRider, superuser } from './helpers';

/**
 * The progress insights opt-in, as observed HTTP behaviour.
 *
 * The panel is profiling under the Children's code (plan §6.4, standard 12) and
 * an entitlement under §2.4, and the two are separate promises:
 *
 * - profiling is **off by default**, for riders who already exist as well as
 *   for new ones, and the default is the server's rather than the client's;
 * - switching it on needs the Legend entitlement, resolved from our own `plans`
 *   record and never from what the client says it is on.
 *
 * Both are tested here the way plan §3 asks for — over the API, as a rider,
 * with the statuses a browser would see. Reading the hook and agreeing with it
 * would prove nothing (LESSONS §5). Each assertion below was watched fail with
 * `guardInsightsOptIn` removed before it was believed.
 */
describe('progress insights: off by default, Legend to switch on', () => {
  beforeAll(async () => {
    await baseFixtures();
  });

  const read = async (id: string, token: string) =>
    call<{ insights_opt_in: boolean; plan: string }>(
      'GET',
      `/api/collections/users/records/${id}`,
      {
        token,
      },
    );

  const setOptIn = async (id: string, token: string, value: boolean) =>
    call('PATCH', `/api/collections/users/records/${id}`, {
      token,
      body: { insights_opt_in: value },
    });

  it('gives the schema both fields, because `migrate up` exits 0 either way', async () => {
    const token = await superuser();
    const collections = await call<{
      items: { name: string; fields: { name: string }[] }[];
    }>('GET', '/api/collections', { token, query: { perPage: '200' } });

    const fieldsOf = (name: string) =>
      collections.body.items.find((c) => c.name === name)?.fields.map((f) => f.name) ?? [];

    expect(fieldsOf('users')).toContain('insights_opt_in');
    expect(fieldsOf('plans')).toContain('includes_insights');
  });

  it('carries the entitlement on the Legend plan record and nowhere else', async () => {
    const token = await superuser();
    const plans = await call<{ items: { slug: string; includes_insights: boolean }[] }>(
      'GET',
      '/api/collections/plans/records',
      { token, query: { perPage: '50' } },
    );
    const bySlug = new Map(plans.body.items.map((p) => [p.slug, p.includes_insights]));
    expect(bySlug.get('legend')).toBe(true);
    expect(bySlug.get('shredder')).toBe(false);
    expect(bySlug.get('rookie')).toBe(false);
  });

  it('starts every new rider with profiling off', async () => {
    const rider = await makeRider();
    const me = await read(rider.id, rider.token);
    expect(me.status).toBe(200);
    expect(me.body.insights_opt_in).toBe(false);
  });

  it('starts a rider off even when the sign-up asked for it on', async () => {
    // The default has to be the server's. A client that can set it at create
    // time has set the default, whatever the field's declared default says.
    const rider = await makeRider({ insights_opt_in: true });
    const me = await read(rider.id, rider.token);
    expect(me.body.insights_opt_in).toBe(false);
  });

  it('starts a Legend rider off too — paying for it is not asking for it', async () => {
    const rider = await makeRider({ insights_opt_in: true }, { plan: 'legend' });
    const me = await read(rider.id, rider.token);
    expect(me.body.plan).toBe('legend');
    expect(me.body.insights_opt_in).toBe(false);
  });

  it('refuses a rookie rider who tries to switch it on', async () => {
    const rider = await makeRider();
    const patched = await setOptIn(rider.id, rider.token, true);
    expect(patched.status).toBe(403);
    expect((await read(rider.id, rider.token)).body.insights_opt_in).toBe(false);
  });

  it('refuses a Shredder rider too — this one is Legend, not merely paid', async () => {
    const rider = await makeRider({}, { plan: 'shredder' });
    const patched = await setOptIn(rider.id, rider.token, true);
    expect(patched.status).toBe(403);
    expect((await read(rider.id, rider.token)).body.insights_opt_in).toBe(false);
  });

  it('lets a Legend rider switch it on, and back off again', async () => {
    const rider = await makeRider({}, { plan: 'legend' });

    const on = await setOptIn(rider.id, rider.token, true);
    expect(on.status).toBe(200);
    expect((await read(rider.id, rider.token)).body.insights_opt_in).toBe(true);

    const off = await setOptIn(rider.id, rider.token, false);
    expect(off.status).toBe(200);
    expect((await read(rider.id, rider.token)).body.insights_opt_in).toBe(false);
  });

  it('lets a rider switch it off after their plan has dropped away', async () => {
    // Withdrawing consent can never be gated on still being entitled.
    const rider = await makeRider({}, { plan: 'legend' });
    expect((await setOptIn(rider.id, rider.token, true)).status).toBe(200);

    const downgraded = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      token: await superuser(),
      body: { plan: 'rookie' },
    });
    expect(downgraded.status).toBe(200);

    expect((await setOptIn(rider.id, rider.token, false)).status).toBe(200);
    expect((await read(rider.id, rider.token)).body.insights_opt_in).toBe(false);
  });

  it('does not let a rider buy the entitlement by claiming it', async () => {
    // The other half of the same promise: `plan` is server-owned, so "switch me
    // to Legend and switch insights on" is refused at the first step.
    const rider = await makeRider();
    const patched = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      token: rider.token,
      body: { plan: 'legend', insights_opt_in: true },
    });
    expect(patched.status).toBe(403);

    const me = await read(rider.id, rider.token);
    expect(me.body.plan).toBe('rookie');
    expect(me.body.insights_opt_in).toBe(false);
  });
});
