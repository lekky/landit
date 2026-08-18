import { createSuperuserClient, records, upsertSubscription } from '@landit/db';
import { NextResponse } from 'next/server';

import { constructWebhookEvent, stripeConfig, stripeWriteFromEvent } from '@/lib/stripe';

/**
 * `POST /api/stripe/webhook` — Stripe tells us what happened; we decide what it
 * means (T15, plan §2.4).
 *
 * **Nothing that arrives here is trusted.** It is a URL on the public internet
 * that anyone can POST to, so it is layered:
 *
 *  1. The **signature** is checked against `STRIPE_WEBHOOK_SECRET` over the raw
 *     bytes, before the body is parsed. A bad or missing signature is a 400 and
 *     the request goes no further.
 *  2. The event is translated into one subscription write, and an event we do
 *     not handle — or one we cannot attribute to a rider — is acknowledged and
 *     dropped.
 *  3. The write goes through the **superuser client**, and
 *     `pocketbase/hooks/55_subscriptions.pb.js` refuses it anyway if the rider
 *     is behind the consent gate, if the payer never confirmed they were 18, or
 *     if a rider under 16 is recorded as having bought it themselves. That hook
 *     is what makes a forged event that somehow got past step 1 still unable to
 *     grant a plan, and it is why it has no superuser bypass.
 *  4. `users.plan` is not set here at all. The hook resolves it from our own
 *     `subscriptions` rows afterwards, which is the whole of "do not treat the
 *     Stripe subscription as the entitlement".
 *
 * **Status codes are Stripe's retry protocol, not decoration.** Stripe retries
 * anything that is not 2xx, for days. So: 400 for a body we will never accept
 * (a bad signature does not get better on the fourth attempt), 500 for a write
 * that failed for a reason a retry might fix, and 200 for anything we
 * deliberately ignored. `upsertSubscription` is idempotent on `external_id`
 * precisely because retries — and duplicate deliveries, which Stripe documents
 * as normal — will happen.
 *
 * **503 while unconfigured.** Stripe went live on 2026-08-17 (#120), so production
 * has keys and this path is now the *preview and local* case rather than the
 * normal one. Answering 503 rather than 200 means
 * a webhook pointed at an app that cannot verify it shows up as failing in the
 * Stripe dashboard instead of looking delivered — the same reasoning
 * `/api/health` uses (issue #62).
 */

// Never prerendered and never cached: this reads the request body, and a
// cached answer to a payment event is a subscription that quietly never lands.
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  const config = stripeConfig();
  if (!config) {
    console.error(
      '[stripe] webhook received but STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET are unset',
    );
    return NextResponse.json({ error: 'stripe is not configured' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'missing signature' }, { status: 400 });
  }

  // The raw bytes, because the signature covers them. `request.json()` here
  // would verify only by luck — any difference in key order or number
  // formatting between Stripe's serialiser and ours breaks the digest.
  const rawBody = await request.text();

  let write;
  try {
    write = stripeWriteFromEvent(constructWebhookEvent(rawBody, signature, config));
  } catch (error) {
    // Deliberately not echoed to the caller. A verification failure tells
    // whoever sent it only that it failed, never why.
    console.error('[stripe] webhook signature rejected', error);
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  if (!write) return NextResponse.json({ ok: true, applied: false });

  try {
    const client = await createSuperuserClient();

    // The plan is looked up by **slug**, in our own collection. The event
    // carries a slug rather than a Stripe price id so that repricing in Stripe
    // — a thing the owner will do without touching this repo — cannot change
    // which plan a rider ends up on.
    const plan = await records(client, 'plans').first('slug = {:slug}', { slug: write.planSlug });
    if (!plan) {
      // Fails closed and loudly. A subscription pointing at a plan we do not
      // have is not one to guess at, and 500 makes Stripe retry in case the
      // seed simply had not run yet.
      console.error(`[stripe] no plan record for slug "${write.planSlug}"`);
      return NextResponse.json({ error: 'unknown plan' }, { status: 500 });
    }

    await upsertSubscription(client, {
      userId: write.userId,
      planId: plan.id,
      source: 'stripe',
      // Widened deliberately: Stripe has statuses our select does not (`unpaid`,
      // `incomplete`), and PocketBase refuses a value outside the field's
      // options — which is the right failure, because it is loud. `statusEntitles`
      // treats every one of them as not entitling anyway.
      status: write.status as 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired',
      externalId: write.externalId,
      checkoutRef: write.checkoutRef,
      periodEnd: write.periodEnd,
      payerKind: write.payerKind,
      payerAdultConfirmed: write.payerAdultConfirmed,
    });

    return NextResponse.json({ ok: true, applied: true });
  } catch (error) {
    // Includes the hook's refusals. A 500 has Stripe retry, which is right for
    // a transient failure and harmless for a permanent one — the row is never
    // written either way, and the log says which it was.
    console.error('[stripe] could not apply webhook event', error);
    return NextResponse.json({ error: 'could not apply event' }, { status: 500 });
  }
}
