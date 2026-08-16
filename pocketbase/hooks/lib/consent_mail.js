/// <reference path="../../.pb_data/types.d.ts" />

/**
 * The one email Land It sends to somebody who is not a rider.
 *
 * It goes to a parent or carer who has never heard of us, so it says what the
 * service is, what their child can already do without them, and what approving
 * changes — before it asks for anything. Both links are in it: the one that
 * approves, and the one that takes approval back, which works forever (§6.2).
 * A guardian who does nothing has still made a decision, and the email says so.
 *
 * **Sending is best-effort.** No mail account is provisioned yet
 * (`docs/infrastructure.md`), so this returns `false` rather than throwing when
 * the mailer is unavailable: a rider waiting on a guardian is a fact worth
 * recording even on a day we cannot deliver the message. The route reports what
 * happened; nothing silently pretends an email went out.
 */

/**
 * The safeguarding address, which this email has to carry: a parent reading it
 * may want to raise a concern with a human rather than press either link.
 *
 * A deliberate second copy of `CONTACT.safeguarding` in
 * `packages/core/src/data/contact.ts`, because the JSVM cannot import
 * TypeScript — the same arrangement as the consent rules. **When the domain
 * changes, both change.**
 */
const SAFEGUARDING_EMAIL = 'safeguarding@landthetrick.com';

/** Where the guardian's links point. The app, not the API. */
function appUrl() {
  const configured = $os.getenv('LANDIT_APP_URL');
  return (configured || 'http://localhost:3000').replace(/\/+$/, '');
}

function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function body(input) {
  const name = escapeHtml(input.riderName);
  const approve = `${appUrl()}/consent/approve/${encodeURIComponent(input.approvalToken)}`;
  const revoke = `${appUrl()}/consent/revoke/${encodeURIComponent(input.revocationToken)}`;
  const days = require(`${__hooks}/lib/consent.js`).APPROVAL_WINDOW_DAYS;

  return `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#12100B">
<p>Hello,</p>
<p><strong>${name}</strong> has made an account on Land It, a trick tracker for scooter,
skateboard and BMX riders, and has given us your email address as their parent or carer.</p>
<p>Because of their age, we need your say-so before their account is a normal one.</p>
<p><strong>Right now, without you doing anything, ${name} can:</strong> look through the trick
library, log the tricks they are working on, keep their own notes and build their riding streak.
All of that is private to them.</p>
<p><strong>They cannot:</strong> be seen by any other rider, join a crew, be invited to one, submit
a skatepark or spot, say they are going to an event, upload a clip, or pay us for anything.
There is no messaging between riders on Land It at all, and there never will be.</p>
<p><strong>If you approve</strong>, the second list becomes available to them. Their profile still
starts private, and they choose if that ever changes.</p>
<p style="margin:28px 0">
  <a href="${approve}" style="background:#FF5A1F;border:2.5px solid #12100B;color:#fff;
  padding:14px 22px;text-decoration:none;font-weight:700;display:inline-block">Approve ${name}’s account</a>
</p>
<p style="font-size:14px;color:#5B554A">That link works for ${days} days. If it runs out, ${name}
can send you a new one from their account.</p>
<p style="font-size:14px;color:#5B554A">If you would rather not, you do not need to do anything —
the account stays as it is. You can also
<a href="${revoke}">say no, or change your mind later</a>. That link never expires, and using it
does not delete anything ${name} has logged.</p>
<p style="font-size:14px;color:#5B554A">If you were not expecting this, ignore it and nothing will
happen. Questions or concerns: ${SAFEGUARDING_EMAIL}.</p>
</div>`;
}

/** Send the request. Returns whether it actually went out. */
function sendGuardianRequest(app, input) {
  const settings = app.settings();
  const message = new MailerMessage({
    from: {
      address: settings.meta.senderAddress,
      name: settings.meta.senderName,
    },
    to: [{ address: input.guardianEmail }],
    subject: `${input.riderName} needs your OK on Land It`,
    html: body(input),
  });

  try {
    app.newMailClient().send(message);
    return true;
  } catch (err) {
    // No SMTP is the expected state until a sending domain is verified with the
    // provider. Loud enough to find, quiet enough not to fail the request.
    app.logger().warn('guardian consent email not sent', 'error', String(err));

    // Locally there is no inbox at all, so the flow is untestable end to end
    // without this. Off unless asked for, and it goes to the server log — never
    // into a response, where the rider could read their own approval token.
    if ($os.getenv('LANDIT_CONSENT_DEBUG_LINKS')) {
      app
        .logger()
        .info(
          'guardian consent links (debug)',
          'approve',
          `${appUrl()}/consent/approve/${input.approvalToken}`,
          'revoke',
          `${appUrl()}/consent/revoke/${input.revocationToken}`,
        );
    }
    return false;
  }
}

module.exports = { appUrl, sendGuardianRequest };
