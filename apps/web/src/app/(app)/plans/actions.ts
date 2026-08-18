'use server';

import { isBillingPeriod, requiredPayerKind, upgradeRouteFor, type AgeBand } from '@landit/core';
import { emailGuardianUpgrade, getActiveSubscription } from '@landit/db';
import { redirect } from 'next/navigation';

import { ROUTES } from '@/lib/routes';
import { currentRider } from '@/lib/session';
import { checkoutMetadata, priceEnvName, priceKey, stripeClient, stripeConfig } from '@/lib/stripe';

/**
 * Upgrading, downgrading and managing the bill.
 *
 * **None of this grants anything.** A Checkout Session is an invitation to pay;
 * the plan moves when the webhook writes a `subscriptions` row and
 * `pocketbase/hooks/55_subscriptions.pb.js` resolves it (plan §2.4). So the
 * worst an edit to this file can do is offer a checkout the hook then refuses —
 * which is exactly the arrangement plan §3 asks for, and why the two
 * safeguarding facts §6.2 wants are carried into Stripe as metadata and checked
 * again on the way back rather than being decided here.
 *
 * **The age check is made twice on purpose.** `upgradeRouteFor` runs here so a
 * child never reaches a payment form, and the same rule runs in the hook so
 * that not reaching one is not the only thing stopping them.
 *
 * **Nothing here touches a card number, and nothing here holds a Stripe key
 * that is in the repo.** Checkout is hosted by Stripe; the secret key is an
 * environment variable the owner sets on the deployed box, and it is set —
 * the account went live with the site on 2026-08-17. The unconfigured branch
 * below stays anyway, because it is what a preview deploy and a local checkout
 * still see: with no keys every action returns "not switched on yet" rather
 * than failing.
 */

export interface UpgradeFormState {
  readonly error?: string;
  /** The guardian route succeeded and an email actually went out. */
  readonly guardianEmailed?: boolean;
  /** The guardian route succeeded but the mailer is not provisioned. */
  readonly guardianQueued?: boolean;
}

/** Where Stripe sends the payer back to. */
function appUrl(): string {
  return (process.env.LANDIT_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

export async function startUpgradeAction(
  planSlug: string,
  _state: UpgradeFormState | undefined,
  form: FormData,
): Promise<UpgradeFormState> {
  const session = await currentRider();
  if (!session) redirect(ROUTES.signIn);

  const { rider, client } = session;

  const period = String(form.get('period') ?? 'monthly');
  if (!isBillingPeriod(period)) return { error: 'Pick monthly or yearly.' };

  const route = upgradeRouteFor({
    ageBand: (rider.age_band as AgeBand | null) ?? null,
    consentState: rider.consent_state ?? null,
  });

  if (route === 'blocked') {
    return {
      error:
        'This account is waiting on a parent or carer’s approval, so it cannot hold a plan yet.',
    };
  }

  // §6.2: "the upgrade flow requires the payer to confirm they are 18 or over."
  // A tick box is a weak thing on its own, which is why it is *stored* on the
  // subscription and re-read by the hook — but it is still the moment the claim
  // is made, and a checkout that starts without it should not start.
  if (form.get('confirm_adult') !== 'yes') {
    return { error: 'Tick the box to say you are 18 or over and you are the one paying.' };
  }

  const config = stripeConfig();
  if (!config) {
    return { error: 'Upgrading is not switched on yet. Nothing has been charged.' };
  }

  const key = priceKey(planSlug, period);
  if (!key) return { error: 'That plan cannot be bought.' };

  const price = config.prices[key];
  if (!price) {
    console.error(`[plans] ${priceEnvName(key)} is unset — no Stripe price for ${planSlug}`);
    return { error: 'That plan is not set up for payment yet. Nothing has been charged.' };
  }

  const payerKind = requiredPayerKind((rider.age_band as AgeBand | null) ?? null);
  const metadata = checkoutMetadata({
    userId: rider.id,
    planSlug,
    period,
    payerKind,
    payerAdultConfirmed: true,
  });

  let checkoutUrl: string | null = null;
  try {
    const checkout = await stripeClient(config).checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      success_url: `${appUrl()}${ROUTES.plans}?upgraded=1`,
      cancel_url: `${appUrl()}${ROUTES.plans}`,
      // Carried on both: the Session metadata is what
      // `checkout.session.completed` sees, and `subscription_data.metadata` is
      // what every later `customer.subscription.*` sees. Without the second,
      // a cancellation months from now would arrive with nothing on it saying
      // which rider it was for.
      metadata: { ...metadata },
      subscription_data: { metadata: { ...metadata } },
      // Stripe's own email field. Deliberately left for the payer to fill in on
      // the guardian route: the child's address is not their parent's, and
      // pre-filling it would put a child's email on an adult's receipt.
      ...(payerKind === 'rider' ? { customer_email: rider.email || undefined } : {}),
    });
    checkoutUrl = checkout.url;
  } catch (error) {
    console.error('[plans] could not create a checkout session', error);
    return { error: 'We could not start the checkout just now. Nothing has been charged.' };
  }

  if (!checkoutUrl) {
    return { error: 'We could not start the checkout just now. Nothing has been charged.' };
  }

  /*
   * The under-16 route (§6.2). The link goes to the parent or carer already on
   * record from the consent flow; the child gets a note saying so and never
   * sees a payment form. The guardian's address is read server-side inside
   * PocketBase and is not in this process at all — a child asking us to email
   * their parent must not be a way to learn their parent's address.
   */
  if (route === 'guardian') {
    try {
      const { sent } = await emailGuardianUpgrade(client, {
        checkoutUrl,
        planName: planSlug.charAt(0).toUpperCase() + planSlug.slice(1),
      });
      return sent ? { guardianEmailed: true } : { guardianQueued: true };
    } catch (error) {
      const message = (error as { response?: { message?: string } })?.response?.message;
      return {
        error:
          message ||
          'We could not reach a parent or carer for this account. Ask them to approve it first.',
      };
    }
  }

  // Outside the try: `redirect` works by throwing, and a catch would swallow it.
  redirect(checkoutUrl);
}

/**
 * Stripe's hosted customer portal — cancel, change card, read invoices.
 *
 * Hosted rather than rebuilt, and not because it is less work: card details and
 * invoices are the two things this product should never be in the path of, and
 * a portal Stripe hosts is one where a bug in our code cannot expose either.
 *
 * The customer id is not stored on our side. It is read back off the
 * subscription Stripe already knows about, so there is one less identifier for
 * this database to hold about a paying adult.
 */
export async function openBillingPortalAction(): Promise<{ error?: string }> {
  const session = await currentRider();
  if (!session) redirect(ROUTES.signIn);

  const config = stripeConfig();
  if (!config) return { error: 'Billing is not switched on yet.' };

  const subscription = await getActiveSubscription(session.client, session.rider.id, 'stripe');
  if (!subscription?.external_id) {
    return { error: 'There is no subscription on this account to manage.' };
  }

  let portalUrl: string | null = null;
  try {
    const stripe = stripeClient(config);
    const remote = await stripe.subscriptions.retrieve(subscription.external_id);
    const customer = typeof remote.customer === 'string' ? remote.customer : remote.customer.id;
    const portal = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${appUrl()}${ROUTES.plans}`,
    });
    portalUrl = portal.url;
  } catch (error) {
    console.error('[plans] could not open the billing portal', error);
    return { error: 'We could not open the billing page just now. Try again in a moment.' };
  }

  redirect(portalUrl);
}
