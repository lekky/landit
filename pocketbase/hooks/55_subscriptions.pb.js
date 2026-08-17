/// <reference path="../.pb_data/types.d.ts" />

/**
 * Subscriptions — who may hold one, and what holding one grants (T15).
 *
 * The plan says entitlements are ours rather than Stripe's (§2.4), and this
 * file is what makes that true rather than merely intended. Two jobs:
 *
 * **Refuse.** `enforceSubscriptionEligibility` runs on the *model* hooks, like
 * the paywall in `20_tricks.pb.js` and for the same reason — a rule that only
 * runs on requests is a rule a webhook, a seed or a staff tool walks past. The
 * webhook in `apps/web/src/app/api/stripe/webhook/route.ts` writes with a
 * superuser client and is refused here exactly as a rider would be, which
 * matters more than it sounds: a webhook endpoint is a URL a stranger can POST
 * to, and a forged event that got past the signature check would still have to
 * get past this.
 *
 * **Resolve.** `resolvePlanFromSubscriptions` recomputes `users.plan` from this
 * rider's own rows after every write and every delete. Nothing else sets
 * `users.plan` outside the superuser dashboard, so the entitlement a rider
 * holds is a function of the records in this database and of nothing else —
 * which is what lets Apple and Google join later as two more `source` values
 * rather than as two more places the answer lives.
 *
 * Registered as `55_` so it loads before the ownership defaults (`60_`); the
 * number carries no dependency, only the reading order of the directory. `50_`
 * was the clip cap, deleted when clip hosting was reversed on 2026-08-17 (plan
 * §1, §6.6) — the gap is left rather than closed, so the numbering keeps
 * meaning the same thing.
 */

onRecordCreate((e) => {
  require(`${__hooks}/lib/landit.js`).enforceSubscriptionEligibility(e.app, e.record);
  e.next();
}, 'subscriptions');

onRecordUpdate((e) => {
  require(`${__hooks}/lib/landit.js`).enforceSubscriptionEligibility(e.app, e.record);
  e.next();
}, 'subscriptions');

/*
 * The plan is resolved *after* the write has actually succeeded, never beside
 * it. A rider whose plan moved because of a subscription row that then failed
 * to save would be entitled by a record that does not exist — the one failure
 * mode this whole arrangement is meant to make impossible.
 *
 * The rider's id is read before `e.next()` because on a delete the record is
 * gone afterwards, which is the case the sticker hook next door learned the
 * same way. A resolution that throws leaves the rider on the plan they had —
 * the fail-closed direction — and says so in the log.
 */
function resolvePlan(e) {
  const userId = e.record.getString('user');
  e.next();
  if (!userId) return;
  try {
    require(`${__hooks}/lib/landit.js`).resolvePlanFromSubscriptions(e.app, userId);
  } catch (err) {
    $app.logger().error('plan resolution failed', 'user', userId, 'error', String(err));
  }
}

onRecordAfterCreateSuccess(resolvePlan, 'subscriptions');
onRecordAfterUpdateSuccess(resolvePlan, 'subscriptions');
onRecordAfterDeleteSuccess(resolvePlan, 'subscriptions');

/**
 * The other writer of entitlement, reconciled (T15, against T16).
 *
 * `setRiderPlan` in `packages/db/src/admin.ts` patches `users.plan` directly —
 * a staff comp, or a fix for a payment that went wrong. Above, this file makes
 * `users.plan` a *derived* value. Left alone, the two would fight in the
 * quietest possible way: the comp would survive until Stripe next sent any
 * routine event about that rider, and then vanish with nothing saying why.
 *
 * So a staff patch that disagrees with the rider's subscriptions is recorded as
 * a row of its own with `source: 'staff'`, which the resolution ranks above any
 * provider row. Staff win, permanently, until staff say otherwise — and
 * `users.plan` still has exactly one writer.
 *
 * Nothing about `setRiderPlan` changes; this is additive on both sides.
 *
 * **After the write succeeds, and only when `plan` actually moved.** Every
 * profile edit and every streak write updates `users`, and none of them is a
 * plan override.
 */
onRecordAfterUpdateSuccess((e) => {
  const before = e.record.original().getString('plan');
  const after = e.record.getString('plan');
  e.next();

  if (before === after) return;
  try {
    require(`${__hooks}/lib/landit.js`).recordStaffPlanOverride(e.app, e.record);
  } catch (err) {
    $app
      .logger()
      .error('staff plan override not reconciled', 'user', e.record.id, 'error', String(err));
  }
}, 'users');

/**
 * `POST /api/landit/plans/guardian-upgrade` — the under-16 route (plan §6.2).
 *
 * "For riders under 16 the upgrade routes to a guardian by email rather than
 * being purchasable in-app by the child." This is that email. The child asks;
 * the link goes to the adult the consent flow already knows about; the payment
 * form never opens in front of the child.
 *
 * Three things about it are deliberate.
 *
 * **The guardian's address is never in the request or the response.** It is
 * read from `guardian_consents`, server-side, and the reply says only whether
 * something was sent. A child asking the product to email their parent must not
 * be a way to *learn* a parent's address, and a third party's email collected
 * from a child is the entry on the processor list §6.5 says to get right first.
 *
 * **The checkout URL is allowlisted to Stripe's own host.** The URL is minted
 * by our server and passed straight through, but "pass a URL and we will email
 * it to a parent" is an open mail relay if the host is not checked. It is.
 *
 * **Sending is best-effort**, the same as the consent email: no mail account is
 * provisioned yet (`docs/infrastructure.md`), so a failure is reported honestly
 * as `sent: false` rather than swallowed or thrown.
 */
routerAdd(
  'POST',
  '/api/landit/plans/guardian-upgrade',
  (e) => {
    const lib = require(`${__hooks}/lib/landit.js`);
    const mail = require(`${__hooks}/lib/plans_mail.js`);

    const CHECKOUT_HOST_PREFIX = 'https://checkout.stripe.com/';
    const GUARDIAN_ONLY_BANDS = ['under_13', '13_15'];

    const rider = e.auth;

    if (lib.isConsentLimited(rider)) {
      throw new ForbiddenError(
        'This account is waiting on a guardian’s approval and cannot hold a subscription.',
      );
    }

    const band = rider.getString('age_band');
    if (band && GUARDIAN_ONLY_BANDS.indexOf(band) === -1) {
      // A 16+ rider has their own checkout; sending them down this route would
      // be an email nobody asked for.
      throw new BadRequestError('This account can upgrade without a guardian.');
    }

    const body = new DynamicModel({ url: '', plan: '' });
    e.bindBody(body);

    const url = String(body.url || '');
    if (url.indexOf(CHECKOUT_HOST_PREFIX) !== 0) {
      throw new BadRequestError('That is not a checkout link.');
    }

    const planName = String(body.plan || '').slice(0, 40);

    let consent;
    try {
      consent = e.app.findFirstRecordByFilter(
        'guardian_consents',
        'user = {:user} && guardian_email != ""',
        { user: rider.id },
      );
    } catch {
      throw new BadRequestError(
        'There is no parent or carer on this account yet. Ask them to approve it first.',
      );
    }

    const sent = mail.sendGuardianUpgrade(e.app, {
      guardianEmail: consent.getString('guardian_email'),
      riderName: rider.getString('name') || rider.getString('handle'),
      planName: planName,
      checkoutUrl: url,
    });

    return e.json(200, { sent: sent });
  },
  $apis.requireAuth('users'),
);
