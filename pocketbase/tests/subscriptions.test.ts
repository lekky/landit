import { beforeAll, describe, expect, it } from 'vitest';

import { baseFixtures, call, makeRider, superuser, type Fixtures, type Rider } from './helpers';

/**
 * T15 — the two refusals and the one grant the plan names, all at the hook
 * layer (plan §7 T15, §6.2, §3 guarantees 3 and 4).
 *
 * "An end-to-end test that a rookie → shredder upgrade actually unlocks a paid
 * trick at the hook layer" and "test that refusal at the hook layer beside the
 * upgrade test". Both are here, over HTTP against a real instance, because
 * §3 asks for guarantees proven as observed behaviour rather than as rule text
 * (LESSONS §5).
 *
 * Every write below uses a **superuser token**. That is not a shortcut around
 * the collection rules — it is the point. `subscriptions.createRule` is `null`,
 * so the only writer is server code holding the superuser client (the Stripe
 * webhook), and the interesting question is whether the refusals hold against
 * *that*. A webhook is a URL a stranger can POST to; a hook that exempted the
 * superuser would make the signature check the only thing between a forged
 * event and a granted plan.
 */

interface PlanIds {
  rookie: string;
  shredder: string;
  legend: string;
}

async function planIds(): Promise<PlanIds> {
  const token = await superuser();
  const found: Partial<PlanIds> = {};
  for (const slug of ['rookie', 'shredder', 'legend'] as const) {
    const result = await call<{ items: { id: string }[] }>(
      'GET',
      '/api/collections/plans/records',
      {
        token,
        query: { filter: `slug='${slug}'`, perPage: '1' },
      },
    );
    const id = result.body.items?.[0]?.id;
    if (!id) throw new Error(`no ${slug} plan seeded`);
    found[slug] = id;
  }
  return found as PlanIds;
}

/** The shape the webhook writes. Named so a test can bend exactly one field. */
function subscriptionBody(
  rider: Rider,
  planId: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    user: rider.id,
    plan: planId,
    source: 'stripe',
    status: 'active',
    external_id: `sub_test_${rider.id}`,
    payer_kind: 'rider',
    payer_adult_confirmed: true,
    ...overrides,
  };
}

async function planOf(rider: Rider): Promise<string> {
  const seen = await call<{ plan: string }>('GET', `/api/collections/users/records/${rider.id}`, {
    token: rider.token,
  });
  return seen.body.plan;
}

describe('a rookie → shredder upgrade unlocks a paid trick', () => {
  let fixtures: Fixtures;
  let plans: PlanIds;

  beforeAll(async () => {
    fixtures = await baseFixtures();
    plans = await planIds();
  });

  it('refuses the paid trick, grants it once the subscription lands, and takes it back when it stops', async () => {
    const rider = await makeRider({}, { plan: 'rookie', consent_state: 'not_required' });
    const token = await superuser();

    // ---- before: the paywall refuses, exactly as guarantee 3 has it -------
    const before = await call('POST', '/api/collections/trick_progress/records', {
      token: rider.token,
      body: { user: rider.id, trick: fixtures.paidTrick, stage: 'trying' },
    });
    expect(before.status).toBe(403);
    expect(await planOf(rider)).toBe('rookie');

    // ---- the upgrade: one subscription row, written as the webhook writes it
    const created = await call<{ id: string }>('POST', '/api/collections/subscriptions/records', {
      token,
      body: subscriptionBody(rider, plans.shredder),
    });
    expect(created.status).toBe(200);

    // The plan moved because the *hook* resolved it from our own collection —
    // nothing in the request above named a plan slug or touched the rider's
    // record. That is plan §2.4's "resolve plan access from our own database"
    // as an observable fact rather than an intention.
    expect(await planOf(rider)).toBe('shredder');

    // ---- after: the same write the paywall refused now succeeds -----------
    const after = await call('POST', '/api/collections/trick_progress/records', {
      token: rider.token,
      body: { user: rider.id, trick: fixtures.paidTrick, stage: 'trying' },
    });
    expect(after.status).toBe(200);

    // ---- cancellation puts it back -----------------------------------------
    const cancelled = await call(
      'PATCH',
      `/api/collections/subscriptions/records/${created.body.id}`,
      { token, body: { status: 'canceled' } },
    );
    expect(cancelled.status).toBe(200);
    expect(await planOf(rider)).toBe('rookie');

    const later = await call('POST', '/api/collections/trick_progress/records', {
      token: rider.token,
      body: { user: rider.id, trick: fixtures.freeTrickSkate, stage: 'trying' },
    });
    expect(later.status).toBe(200); // free tricks are unaffected

    const refused = await call('POST', '/api/collections/trick_progress/records', {
      token: rider.token,
      body: { user: rider.id, trick: fixtures.paidTrick, stage: 'every' },
    });
    expect(refused.status).toBe(403);
  });

  it('does not entitle on past_due — a failed payment falls back to the free tier', async () => {
    const rider = await makeRider({}, { plan: 'rookie', consent_state: 'not_required' });
    const token = await superuser();

    const created = await call<{ id: string }>('POST', '/api/collections/subscriptions/records', {
      token,
      body: subscriptionBody(rider, plans.legend),
    });
    expect(created.status).toBe(200);
    expect(await planOf(rider)).toBe('legend');

    for (const status of ['past_due', 'expired', 'canceled']) {
      const moved = await call(
        'PATCH',
        `/api/collections/subscriptions/records/${created.body.id}`,
        { token, body: { status } },
      );
      expect(moved.status).toBe(200);
      expect(await planOf(rider)).toBe('rookie');
    }
  });

  it('puts the rider back on rookie when the subscription row is deleted outright', async () => {
    const rider = await makeRider({}, { plan: 'rookie', consent_state: 'not_required' });
    const token = await superuser();

    const created = await call<{ id: string }>('POST', '/api/collections/subscriptions/records', {
      token,
      body: subscriptionBody(rider, plans.shredder),
    });
    expect(await planOf(rider)).toBe('shredder');

    const removed = await call(
      'DELETE',
      `/api/collections/subscriptions/records/${created.body.id}`,
      { token },
    );
    expect(removed.status).toBe(204);
    expect(await planOf(rider)).toBe('rookie');
  });
});

describe('who may hold a subscription at all (plan §6.2, §3 guarantee 4)', () => {
  let plans: PlanIds;

  beforeAll(async () => {
    await baseFixtures();
    plans = await planIds();
  });

  // The first two are guarantee 4's billing half, refused on **create** by
  // `60_ownership.pb.js` since T2. They are here because T15 is the first task
  // that actually writes this collection, and a guarantee nobody exercises from
  // the code path that will use it is a guarantee on paper (LESSONS §3).
  it('refuses a rider waiting on a guardian, even to a superuser token', async () => {
    const waiting = await makeRider(
      { country: 'GB', age_band: 'under_13' },
      { consent_state: 'pending' },
    );
    const refused = await call<{ message: string }>(
      'POST',
      '/api/collections/subscriptions/records',
      {
        token: await superuser(),
        body: subscriptionBody(waiting, plans.shredder, { payer_kind: 'guardian' }),
      },
    );
    expect(refused.status).toBe(403);
    expect(await planOf(waiting)).toBe('rookie');
  });

  it('refuses a rider whose guardian took approval back', async () => {
    const revoked = await makeRider(
      { country: 'GB', age_band: '13_15' },
      { consent_state: 'revoked' },
    );
    const refused = await call('POST', '/api/collections/subscriptions/records', {
      token: await superuser(),
      body: subscriptionBody(revoked, plans.legend, { payer_kind: 'guardian' }),
    });
    expect(refused.status).toBe(403);
  });

  it('refuses to reactivate the subscription of a rider whose consent was revoked', async () => {
    // The gap the T2 create-hook could not cover: consent is revocable forever
    // (§6.2), so a row that was legitimate when written can stop being one.
    const rider = await makeRider(
      { country: 'GB', age_band: '13_15' },
      { consent_state: 'granted' },
    );
    const token = await superuser();

    const created = await call<{ id: string }>('POST', '/api/collections/subscriptions/records', {
      token,
      body: subscriptionBody(rider, plans.shredder, { payer_kind: 'guardian' }),
    });
    expect(created.status).toBe(200);
    expect(await planOf(rider)).toBe('shredder');

    const revoked = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      token,
      body: { consent_state: 'revoked' },
    });
    expect(revoked.status).toBe(200);

    const reactivated = await call(
      'PATCH',
      `/api/collections/subscriptions/records/${created.body.id}`,
      { token, body: { status: 'active', period_end: '2030-01-01 00:00:00.000Z' } },
    );
    expect(reactivated.status).toBe(403);
  });

  it('refuses an under-16 rider whose subscription says the rider paid', async () => {
    // The child is fully consented — this refusal is about who the counterparty
    // is, not about the consent gate. §6.2: "for riders under 16 the upgrade
    // routes to a guardian by email rather than being purchasable in-app by the
    // child."
    const child = await makeRider(
      { country: 'GB', age_band: '13_15' },
      { consent_state: 'granted' },
    );
    const refused = await call('POST', '/api/collections/subscriptions/records', {
      token: await superuser(),
      body: subscriptionBody(child, plans.shredder, { payer_kind: 'rider' }),
    });
    expect(refused.status).toBe(403);
    expect(await planOf(child)).toBe('rookie');
  });

  it('lets that same child’s guardian buy it for them', async () => {
    const child = await makeRider(
      { country: 'GB', age_band: 'under_13' },
      { consent_state: 'granted' },
    );
    const bought = await call('POST', '/api/collections/subscriptions/records', {
      token: await superuser(),
      body: subscriptionBody(child, plans.shredder, { payer_kind: 'guardian' }),
    });
    expect(bought.status).toBe(200);
    expect(await planOf(child)).toBe('shredder');
  });

  it('refuses any subscription without the 18+ confirmation', async () => {
    const adult = await makeRider({}, { consent_state: 'not_required' });
    for (const payerKind of ['rider', 'guardian']) {
      const refused = await call('POST', '/api/collections/subscriptions/records', {
        token: await superuser(),
        body: subscriptionBody(adult, plans.shredder, {
          payer_kind: payerKind,
          payer_adult_confirmed: false,
        }),
      });
      expect(refused.status).toBe(403);
    }
    expect(await planOf(adult)).toBe('rookie');
  });

  it('refuses an update that would strip the confirmation off an existing row', async () => {
    const adult = await makeRider({}, { consent_state: 'not_required' });
    const token = await superuser();
    const created = await call<{ id: string }>('POST', '/api/collections/subscriptions/records', {
      token,
      body: subscriptionBody(adult, plans.shredder),
    });
    expect(created.status).toBe(200);

    const stripped = await call(
      'PATCH',
      `/api/collections/subscriptions/records/${created.body.id}`,
      { token, body: { payer_adult_confirmed: false } },
    );
    expect(stripped.status).toBe(403);
  });

  it('gives no rider a client path to a subscription of their own', async () => {
    const climber = await makeRider({}, { consent_state: 'not_required' });
    const attempt = await call('POST', '/api/collections/subscriptions/records', {
      token: climber.token,
      body: subscriptionBody(climber, plans.legend),
    });
    // `createRule: null` — refused at the rule layer, before any hook runs.
    expect(attempt.status).toBe(403);
    expect(await planOf(climber)).toBe('rookie');
  });

  it('keeps one rider’s subscription out of another rider’s sight', async () => {
    const owner = await makeRider({}, { consent_state: 'not_required' });
    const nosy = await makeRider({}, { consent_state: 'not_required' });
    const token = await superuser();

    const created = await call<{ id: string }>('POST', '/api/collections/subscriptions/records', {
      token,
      body: subscriptionBody(owner, plans.shredder),
    });
    expect(created.status).toBe(200);

    const mine = await call<{ items: unknown[] }>('GET', '/api/collections/subscriptions/records', {
      token: owner.token,
    });
    expect(mine.body.items).toHaveLength(1);

    const theirs = await call<{ items: unknown[] }>(
      'GET',
      '/api/collections/subscriptions/records',
      { token: nosy.token },
    );
    expect(theirs.body.items).toHaveLength(0);

    const direct = await call('GET', `/api/collections/subscriptions/records/${created.body.id}`, {
      token: nosy.token,
    });
    expect(direct.status).toBe(404);
  });
});

describe('the guardian upgrade route', () => {
  const CHECKOUT = 'https://checkout.stripe.com/c/pay/cs_test_landit';

  it('refuses a link that does not go to Stripe', async () => {
    const child = await makeRider(
      { country: 'GB', age_band: '13_15' },
      { consent_state: 'granted' },
    );
    const refused = await call('POST', '/api/landit/plans/guardian-upgrade', {
      token: child.token,
      body: { url: 'https://not-stripe.example/pay', plan: 'Shredder' },
    });
    expect(refused.status).toBe(400);
  });

  it('refuses a rider waiting on a guardian', async () => {
    const waiting = await makeRider(
      { country: 'GB', age_band: 'under_13' },
      { consent_state: 'pending' },
    );
    const refused = await call('POST', '/api/landit/plans/guardian-upgrade', {
      token: waiting.token,
      body: { url: CHECKOUT, plan: 'Shredder' },
    });
    expect(refused.status).toBe(403);
  });

  it('refuses a 16+ rider, who has their own checkout', async () => {
    const older = await makeRider(
      { country: 'GB', age_band: '16_17' },
      { consent_state: 'granted' },
    );
    const refused = await call('POST', '/api/landit/plans/guardian-upgrade', {
      token: older.token,
      body: { url: CHECKOUT, plan: 'Shredder' },
    });
    expect(refused.status).toBe(400);
  });

  it('refuses when no guardian is on record, rather than emailing nobody', async () => {
    const child = await makeRider(
      { country: 'GB', age_band: '13_15' },
      { consent_state: 'granted' },
    );
    const refused = await call('POST', '/api/landit/plans/guardian-upgrade', {
      token: child.token,
      body: { url: CHECKOUT, plan: 'Shredder' },
    });
    expect(refused.status).toBe(400);
  });

  it('needs a signed-in rider', async () => {
    const refused = await call('POST', '/api/landit/plans/guardian-upgrade', {
      body: { url: CHECKOUT, plan: 'Shredder' },
    });
    expect(refused.status).toBe(401);
  });
});
