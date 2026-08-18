import { isBillingPeriod, type BillingPeriod, type PayerKind } from '@landit/core';
import Stripe from 'stripe';

/**
 * Everything that knows Stripe exists, in one file.
 *
 * The plan is emphatic that Stripe is **not** the entitlement (§2.4): a
 * `subscriptions` record in our own database is, and Apple and Google will
 * arrive as two more `source` values on the same collection. So this module's
 * whole job is to talk to one provider and hand back a shape that says nothing
 * about which provider it was. `stripeWriteFromEvent` returning
 * `source: 'stripe'` is the last mention of the word on the way in.
 *
 * **The Stripe account is live** — it went live with the site on 2026-08-17,
 * and the owner created it and its four products in their own browser. The keys
 * below are still placeholders in `apps/web/.env.example` and nothing in this
 * repo has ever held a real one: secrets never enter the repo (`CLAUDE.md`),
 * so the real values live only in the deployed environment.
 *
 * **The unconfigured path is still a first-class state, and stays one.** Every
 * local checkout, every test run and every preview deploy has no keys, and a
 * module that threw on import there would be a module nobody could run. So:
 * `stripeConfig()` returns `null`, the plans page renders in full and says
 * upgrading is not switched on yet, and the webhook answers 503 rather than
 * pretending it processed something. Read `null` as "not here", never as
 * "not built".
 *
 * **Nothing here decides who may buy.** That is `@landit/core`'s
 * `upgradeRouteFor` to define and `pocketbase/hooks/55_subscriptions.pb.js` to
 * enforce. The 18+ confirmation and the payer kind travel through Stripe as
 * metadata and come back out again, so the hook can refuse a subscription this
 * file happily created a session for — which is the point of putting the
 * refusal below the request layer.
 */

/* ------------------------------------------------------------- the config -- */

/** The four prices the owner creates in Stripe, keyed the way we ask for them. */
export type PriceKey = `${'shredder' | 'legend'}_${BillingPeriod}`;

const PRICE_ENV: Readonly<Record<PriceKey, string>> = {
  shredder_monthly: 'STRIPE_PRICE_SHREDDER_MONTHLY',
  shredder_yearly: 'STRIPE_PRICE_SHREDDER_YEARLY',
  legend_monthly: 'STRIPE_PRICE_LEGEND_MONTHLY',
  legend_yearly: 'STRIPE_PRICE_LEGEND_YEARLY',
};

export interface StripeConfig {
  readonly secretKey: string;
  readonly webhookSecret: string;
  readonly prices: Readonly<Partial<Record<PriceKey, string>>>;
}

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

/**
 * The Stripe configuration, or `null` when this environment has no keys.
 *
 * `null` is a first-class state, not an error path: production has the keys,
 * and every local run, test and preview deploy does not. Callers branch on it
 * rather than throwing,
 * so the plans page still renders three real cards with real prices from the
 * `plans` records — the prices are ours, in `@landit/core`, and were never
 * Stripe's to tell us.
 */
export function stripeConfig(): StripeConfig | null {
  const secretKey = env('STRIPE_SECRET_KEY');
  const webhookSecret = env('STRIPE_WEBHOOK_SECRET');
  if (!secretKey || !webhookSecret) return null;

  const prices: Partial<Record<PriceKey, string>> = {};
  for (const [key, variable] of Object.entries(PRICE_ENV) as [PriceKey, string][]) {
    const id = env(variable);
    if (id) prices[key] = id;
  }
  return { secretKey, webhookSecret, prices };
}

export function priceKey(planSlug: string, period: BillingPeriod): PriceKey | null {
  if (planSlug !== 'shredder' && planSlug !== 'legend') return null;
  return `${planSlug}_${period}`;
}

/** Which environment variable a missing price wants, for an honest error. */
export function priceEnvName(key: PriceKey): string {
  return PRICE_ENV[key];
}

/**
 * A Stripe client.
 *
 * No `apiVersion` is pinned. The SDK sends the one it was built against, and
 * pinning a string here is a second place for it to go stale — the version that
 * matters is the one in `package.json`, which is exact.
 */
export function stripeClient(config: StripeConfig): Stripe {
  return new Stripe(config.secretKey);
}

/* ---------------------------------------------------------------- metadata -- */

/**
 * What travels to Stripe and comes back on the webhook.
 *
 * All of it is *our* data — the rider, the plan and the two safeguarding facts
 * §6.2 asks for. Stripe holds the payer's card and their email; it never holds
 * a child's age band, and none of these keys carries one. `payer_kind` says
 * which of the two routes the upgrade came down, not who anybody is.
 */
export interface CheckoutMetadata {
  readonly landit_user: string;
  readonly landit_plan: string;
  readonly landit_period: BillingPeriod;
  readonly landit_payer_kind: PayerKind;
  /** Stringly, because Stripe metadata values are strings. */
  readonly landit_payer_adult_confirmed: 'true' | 'false';
}

export function checkoutMetadata(input: {
  readonly userId: string;
  readonly planSlug: string;
  readonly period: BillingPeriod;
  readonly payerKind: PayerKind;
  readonly payerAdultConfirmed: boolean;
}): CheckoutMetadata {
  return {
    landit_user: input.userId,
    landit_plan: input.planSlug,
    landit_period: input.period,
    landit_payer_kind: input.payerKind,
    landit_payer_adult_confirmed: input.payerAdultConfirmed ? 'true' : 'false',
  };
}

/* ------------------------------------------------------------- the webhook -- */

/**
 * Verify and parse. Throws `Stripe.errors.StripeSignatureVerificationError`
 * when the signature, the secret or the timestamp does not hold up.
 *
 * The raw body has to be the **bytes Stripe sent** — the signature covers them,
 * so a parsed-and-restringified object verifies only by luck. The route reads
 * `request.text()` for exactly that reason and never `request.json()`.
 */
export function constructWebhookEvent(
  rawBody: string,
  signature: string,
  config: StripeConfig,
): Stripe.Event {
  return stripeClient(config).webhooks.constructEvent(rawBody, signature, config.webhookSecret);
}

/** What a Stripe event means, in the terms `upsertSubscription` takes. */
export interface StripeSubscriptionWrite {
  readonly userId: string;
  readonly planSlug: string;
  readonly status: string;
  readonly externalId: string;
  readonly checkoutRef: string;
  readonly periodEnd: string;
  readonly payerKind: PayerKind;
  readonly payerAdultConfirmed: boolean;
}

function readMetadata(bag: Stripe.Metadata | null | undefined): {
  userId: string;
  planSlug: string;
  payerKind: PayerKind;
  payerAdultConfirmed: boolean;
  period: BillingPeriod | null;
} | null {
  const userId = bag?.landit_user ?? '';
  const planSlug = bag?.landit_plan ?? '';
  if (!userId || !planSlug) return null;

  const payerKind: PayerKind = bag?.landit_payer_kind === 'guardian' ? 'guardian' : 'rider';
  const period = bag?.landit_period;
  return {
    userId,
    planSlug,
    payerKind,
    // Only the literal string counts. Anything else — absent, misspelled,
    // truncated — reads as "not confirmed", and the hook then refuses the
    // subscription. The fail-closed direction is the whole point of carrying
    // this through Stripe rather than remembering it on our side of the round
    // trip.
    payerAdultConfirmed: bag?.landit_payer_adult_confirmed === 'true',
    period: isBillingPeriod(period) ? period : null,
  };
}

/** ISO from a Stripe unix seconds field, or `''`. */
function isoFromUnix(seconds: unknown): string {
  return typeof seconds === 'number' && seconds > 0 ? new Date(seconds * 1000).toISOString() : '';
}

/**
 * When the paid-up period ends.
 *
 * Read from the subscription item first and the subscription second: Stripe
 * moved `current_period_end` onto the items when it allowed one subscription to
 * bill on several schedules, and both shapes are in the wild depending on the
 * API version an account is pinned to. It is a display field either way — the
 * entitlement is `status`, never a date this code worked out — so an empty
 * string is a perfectly good answer.
 */
function periodEndOf(subscription: Stripe.Subscription): string {
  const item = subscription.items?.data?.[0] as { current_period_end?: unknown } | undefined;
  const fromItem = isoFromUnix(item?.current_period_end);
  if (fromItem) return fromItem;
  return isoFromUnix(
    (subscription as unknown as { current_period_end?: unknown }).current_period_end,
  );
}

const idOf = (value: string | { id: string } | null | undefined): string =>
  typeof value === 'string' ? value : (value?.id ?? '');

/**
 * Translate an event into one subscription write, or `null` for "nothing to
 * do".
 *
 * `null` is returned for an event we do not handle **and** for a handled event
 * whose metadata is missing — a subscription created in the Stripe dashboard by
 * hand, say. Neither is an error: the route answers 200 so Stripe stops
 * retrying, and nothing in this database moves. A write we cannot attribute to
 * a rider is not a write worth guessing at.
 */
export function stripeWriteFromEvent(event: Stripe.Event): StripeSubscriptionWrite | null {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const meta = readMetadata(session.metadata);
    const externalId = idOf(session.subscription);
    if (!meta || !externalId) return null;

    return {
      userId: meta.userId,
      planSlug: meta.planSlug,
      // The session completing is what the rider paid for; the real status
      // arrives moments later on `customer.subscription.*` and overwrites this
      // row. Writing `active` here is what makes the upgrade feel immediate
      // without inventing a status Stripe never sent — `complete` plus a paid
      // or zero-cost session is exactly what `active` means.
      status:
        session.status === 'complete' &&
        (session.payment_status === 'paid' || session.payment_status === 'no_payment_required')
          ? 'active'
          : 'past_due',
      externalId,
      checkoutRef: session.id,
      periodEnd: '',
      payerKind: meta.payerKind,
      payerAdultConfirmed: meta.payerAdultConfirmed,
    };
  }

  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted'
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const meta = readMetadata(subscription.metadata);
    if (!meta || !subscription.id) return null;

    return {
      userId: meta.userId,
      planSlug: meta.planSlug,
      // Stripe's own word for it, passed through. `@landit/core`'s
      // `statusEntitles` decides what it grants and the hook resolves the plan
      // — this file does not get an opinion.
      status: event.type === 'customer.subscription.deleted' ? 'canceled' : subscription.status,
      externalId: subscription.id,
      checkoutRef: '',
      periodEnd: periodEndOf(subscription),
      payerKind: meta.payerKind,
      payerAdultConfirmed: meta.payerAdultConfirmed,
    };
  }

  return null;
}
