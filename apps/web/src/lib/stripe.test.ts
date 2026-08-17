import { createHmac } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  checkoutMetadata,
  constructWebhookEvent,
  priceEnvName,
  priceKey,
  stripeConfig,
  stripeWriteFromEvent,
  type StripeConfig,
} from './stripe';

/**
 * The webhook's signature check, and what an event means once it verifies.
 *
 * **No Stripe account exists and no live call is made here.** The payloads are
 * signed locally, with `node:crypto`, the way Stripe documents its own scheme:
 * a `Stripe-Signature` header of `t=<unix seconds>,v1=<hex HMAC-SHA256 of
 * "<t>.<payload>" keyed on the endpoint secret>`. That the signing in this file
 * and the verification in the SDK are two independent readings of the same
 * published scheme is the point — a test that reused the library's own signer
 * would prove only that the library agrees with itself.
 *
 * What this buys, concretely: the route can be trusted to reject a body that
 * has been altered by one character, a signature made with the wrong secret,
 * and a replay of a signature that is hours old. Every one of those is a way to
 * grant somebody a paid plan for free.
 */

const SECRET = 'whsec_test_landit_local_only';

/** Stripe's scheme, implemented from its documentation rather than its code. */
function signPayload(payload: string, secret: string, timestampSeconds: number): string {
  const signed = `${timestampSeconds}.${payload}`;
  const digest = createHmac('sha256', secret).update(signed, 'utf8').digest('hex');
  return `t=${timestampSeconds},v1=${digest}`;
}

const config: StripeConfig = {
  secretKey: 'sk_test_landit_local_only',
  webhookSecret: SECRET,
  prices: {},
};

const nowSeconds = () => Math.floor(Date.now() / 1000);

function checkoutCompleted(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id: 'evt_test_1',
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_abc',
        object: 'checkout.session',
        status: 'complete',
        payment_status: 'paid',
        subscription: 'sub_test_abc',
        metadata: checkoutMetadata({
          userId: 'rider123456789',
          planSlug: 'shredder',
          period: 'monthly',
          payerKind: 'rider',
          payerAdultConfirmed: true,
        }),
        ...overrides,
      },
    },
  });
}

describe('the signature check', () => {
  it('accepts a payload signed with the endpoint secret', () => {
    const payload = checkoutCompleted();
    const header = signPayload(payload, SECRET, nowSeconds());

    const event = constructWebhookEvent(payload, header, config);
    expect(event.type).toBe('checkout.session.completed');
  });

  it('refuses a body altered after signing, by one character', () => {
    const payload = checkoutCompleted();
    const header = signPayload(payload, SECRET, nowSeconds());
    const tampered = payload.replace('"shredder"', '"legend"');
    expect(tampered).not.toBe(payload);

    expect(() => constructWebhookEvent(tampered, header, config)).toThrow();
  });

  it('refuses a signature made with a different secret', () => {
    const payload = checkoutCompleted();
    const header = signPayload(payload, 'whsec_somebody_elses_secret', nowSeconds());
    expect(() => constructWebhookEvent(payload, header, config)).toThrow();
  });

  it('refuses a replay of an old signature', () => {
    const payload = checkoutCompleted();
    // Six hours ago. Stripe's default tolerance is five minutes, so this is a
    // signature that was once perfectly valid — which is exactly what an
    // attacker who captured one would be holding.
    const header = signPayload(payload, SECRET, nowSeconds() - 6 * 60 * 60);
    expect(() => constructWebhookEvent(payload, header, config)).toThrow();
  });

  it('refuses a header that is not a signature at all', () => {
    const payload = checkoutCompleted();
    for (const header of ['', 'nonsense', 't=123', `v1=${'0'.repeat(64)}`]) {
      expect(() => constructWebhookEvent(payload, header, config)).toThrow();
    }
  });
});

describe('what a verified event means', () => {
  const verified = (payload: string) =>
    constructWebhookEvent(payload, signPayload(payload, SECRET, nowSeconds()), config);

  it('turns a completed checkout into one subscription write', () => {
    const write = stripeWriteFromEvent(verified(checkoutCompleted()));
    expect(write).toEqual({
      userId: 'rider123456789',
      planSlug: 'shredder',
      status: 'active',
      externalId: 'sub_test_abc',
      checkoutRef: 'cs_test_abc',
      periodEnd: '',
      payerKind: 'rider',
      payerAdultConfirmed: true,
    });
  });

  it('carries the payer facts §6.2 asks for, and reads anything else as unconfirmed', () => {
    const guardian = stripeWriteFromEvent(
      verified(
        checkoutCompleted({
          metadata: {
            landit_user: 'rider123456789',
            landit_plan: 'legend',
            landit_period: 'yearly',
            landit_payer_kind: 'guardian',
            landit_payer_adult_confirmed: 'true',
          },
        }),
      ),
    );
    expect(guardian?.payerKind).toBe('guardian');
    expect(guardian?.payerAdultConfirmed).toBe(true);

    // Absent, misspelled, truncated — all of them mean "not confirmed", and the
    // hook then refuses the subscription. Fail closed.
    for (const value of ['TRUE', 'yes', '1', '', undefined]) {
      const write = stripeWriteFromEvent(
        verified(
          checkoutCompleted({
            metadata: {
              landit_user: 'rider123456789',
              landit_plan: 'shredder',
              landit_payer_kind: 'rider',
              ...(value === undefined ? {} : { landit_payer_adult_confirmed: value }),
            },
          }),
        ),
      );
      expect(write?.payerAdultConfirmed).toBe(false);
    }
  });

  it('reads an unpaid session as past_due rather than as a grant', () => {
    const write = stripeWriteFromEvent(
      verified(checkoutCompleted({ status: 'open', payment_status: 'unpaid' })),
    );
    expect(write?.status).toBe('past_due');
  });

  it('ignores an event it cannot attribute to a rider', () => {
    expect(stripeWriteFromEvent(verified(checkoutCompleted({ metadata: {} })))).toBeNull();
    expect(stripeWriteFromEvent(verified(checkoutCompleted({ subscription: null })))).toBeNull();
  });

  it('ignores an event type it does not handle', () => {
    const payload = JSON.stringify({
      id: 'evt_test_2',
      object: 'event',
      type: 'invoice.paid',
      data: { object: { id: 'in_test', object: 'invoice' } },
    });
    expect(stripeWriteFromEvent(verified(payload))).toBeNull();
  });

  it('passes a subscription update through with Stripe’s own status', () => {
    const metadata = checkoutMetadata({
      userId: 'rider987654321',
      planSlug: 'legend',
      period: 'yearly',
      payerKind: 'guardian',
      payerAdultConfirmed: true,
    });
    const payload = JSON.stringify({
      id: 'evt_test_3',
      object: 'event',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_test_xyz',
          object: 'subscription',
          status: 'past_due',
          metadata,
          items: { data: [{ current_period_end: 1798761600 }] },
        },
      },
    });

    const write = stripeWriteFromEvent(verified(payload));
    expect(write?.status).toBe('past_due');
    expect(write?.externalId).toBe('sub_test_xyz');
    expect(write?.periodEnd).toBe(new Date(1798761600 * 1000).toISOString());
  });

  it('calls a deleted subscription canceled whatever status rode in with it', () => {
    const metadata = checkoutMetadata({
      userId: 'rider987654321',
      planSlug: 'legend',
      period: 'yearly',
      payerKind: 'rider',
      payerAdultConfirmed: true,
    });
    const payload = JSON.stringify({
      id: 'evt_test_4',
      object: 'event',
      type: 'customer.subscription.deleted',
      data: {
        object: { id: 'sub_test_gone', object: 'subscription', status: 'active', metadata },
      },
    });
    expect(stripeWriteFromEvent(verified(payload))?.status).toBe('canceled');
  });

  it('reads the period end off the subscription when the item has none', () => {
    const metadata = checkoutMetadata({
      userId: 'rider987654321',
      planSlug: 'shredder',
      period: 'monthly',
      payerKind: 'rider',
      payerAdultConfirmed: true,
    });
    const payload = JSON.stringify({
      id: 'evt_test_5',
      object: 'event',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_test_old_shape',
          object: 'subscription',
          status: 'active',
          current_period_end: 1798761600,
          metadata,
          items: { data: [{}] },
        },
      },
    });
    expect(stripeWriteFromEvent(verified(payload))?.periodEnd).toBe(
      new Date(1798761600 * 1000).toISOString(),
    );
  });
});

describe('configuration', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('STRIPE_')) delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  it('is null until both the key and the webhook secret are set', () => {
    expect(stripeConfig()).toBeNull();

    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    expect(stripeConfig()).toBeNull();

    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_x';
    expect(stripeConfig()).not.toBeNull();
  });

  it('collects only the prices that are actually set', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_x';
    process.env.STRIPE_PRICE_SHREDDER_MONTHLY = 'price_a';

    expect(stripeConfig()?.prices).toEqual({ shredder_monthly: 'price_a' });
  });

  it('names the variable a missing price wants, so the log says what to set', () => {
    expect(priceKey('shredder', 'yearly')).toBe('shredder_yearly');
    expect(priceEnvName('legend_monthly')).toBe('STRIPE_PRICE_LEGEND_MONTHLY');
    // Rookie is free and has no Stripe price; nothing may try to buy it.
    expect(priceKey('rookie', 'monthly')).toBeNull();
  });
});
