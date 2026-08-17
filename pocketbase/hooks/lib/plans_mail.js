/// <reference path="../../.pb_data/types.d.ts" />

/**
 * The second email Land It sends to somebody who is not a rider (T15, §6.2).
 *
 * A rider under 16 cannot be sold to in the app. When they ask to upgrade, this
 * goes to the parent or carer already on record from the consent flow, carrying
 * the checkout link. Everything the plan says about the payer is in the message
 * rather than assumed: it is a subscription for one child, it is theirs to
 * cancel, and pressing the link means they are the adult paying.
 *
 * **It names no price.** The figures live on the plans page and on the Stripe
 * checkout the link opens, and an email that quotes one is a copy that goes
 * stale the moment §6.7 moves (LESSONS §4). It says which plan, and the
 * checkout says what it costs.
 *
 * **It sells no achievement.** Plan §2.4: stickers and stages are earned-only
 * on every plan. A parent reading this must not come away thinking they can buy
 * their child a badge, so the perks named here are capacity, cosmetics and
 * insight and nothing else.
 *
 * **Sending is best-effort**, exactly as `consent_mail.js` is and for the same
 * reason: no mail account is provisioned yet (`docs/infrastructure.md`). This
 * returns whether the message actually went out; the route reports that
 * honestly rather than pretending.
 */

/**
 * The safeguarding address. A deliberate third copy of `CONTACT.safeguarding`
 * in `packages/core/src/data/contact.ts` — the JSVM cannot import TypeScript,
 * which is the same arrangement `consent_mail.js` documents. **When the domain
 * changes, all of them change.**
 */
const SAFEGUARDING_EMAIL = 'safeguarding@landthetrick.com';

function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function body(input) {
  const name = escapeHtml(input.riderName);
  const plan = escapeHtml(input.planName || 'a paid plan');
  // Already checked against Stripe's own host by the route that calls this; the
  // escape is belt to that braces, because this string lands inside an `href`.
  const url = escapeHtml(input.checkoutUrl);

  return `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#12100B">
<p>Hello,</p>
<p><strong>${name}</strong> uses Land It, a trick tracker for scooter, skateboard and BMX riders,
and has asked to move onto <strong>${plan}</strong>.</p>
<p>Because they are under 16, we do not take payment from them. If you would like them to have it,
this link is where it happens — and pressing it means you are the adult paying.</p>
<p style="margin:28px 0">
  <a href="${url}" style="background:#FF5A1F;border:2.5px solid #12100B;color:#fff;
  padding:14px 22px;text-decoration:none;font-weight:700;display:inline-block">Set up ${name}’s ${plan} plan</a>
</p>
<p><strong>What a paid plan changes:</strong> the harder tricks in the library open up, clips can be
saved, and on Legend there are progress insights and a tag beside their name.</p>
<p><strong>What it does not change:</strong> stickers and stages are earned by riding and are never
for sale, on any plan. Their profile stays private unless they change it, there is no messaging
between riders on Land It, and nothing about this makes them visible to anyone.</p>
<p style="font-size:14px;color:#5B554A">It is one subscription for one rider, and you can cancel it
whenever you like — everything ${name} has tracked stays exactly where it is.</p>
<p style="font-size:14px;color:#5B554A">If you were not expecting this, ignore it and nothing
happens. Questions or concerns: ${SAFEGUARDING_EMAIL}.</p>
</div>`;
}

/** Send it. Returns whether it actually went out. */
function sendGuardianUpgrade(app, input) {
  const settings = app.settings();
  const message = new MailerMessage({
    from: {
      address: settings.meta.senderAddress,
      name: settings.meta.senderName,
    },
    to: [{ address: input.guardianEmail }],
    subject: `${input.riderName} has asked about a Land It plan`,
    html: body(input),
  });

  try {
    app.newMailClient().send(message);
    return true;
  } catch (err) {
    app.logger().warn('guardian upgrade email not sent', 'error', String(err));
    return false;
  }
}

module.exports = { sendGuardianUpgrade };
