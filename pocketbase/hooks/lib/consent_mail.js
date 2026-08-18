/// <reference path="../../.pb_data/types.d.ts" />

/**
 * The one email Land The Trick sends to somebody who is not a rider.
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

/**
 * The email itself, framed by the shell every Land The Trick email shares
 * (`lib/mail_shell.js`).
 *
 * **The words are not the design's to change.** This email was written for a
 * parent who has never heard of us, and every sentence is doing a job: what the
 * rider can already do comes before what they cannot, both lists are the same
 * size, and doing nothing is named as a decision rather than left as a silence.
 * The 2026-08-18 restyle moved it into the card, the header bar and the type
 * scale — it did not touch a sentence. The one thing it did drop is the
 * "Hello," that used to open it, because the shell leads with a heading and the
 * two together read as a form letter.
 */
function body(input) {
  const name = escapeHtml(input.riderName);
  const approve = `${appUrl()}/consent/approve/${encodeURIComponent(input.approvalToken)}`;
  const revoke = `${appUrl()}/consent/revoke/${encodeURIComponent(input.revocationToken)}`;
  const days = require(`${__hooks}/lib/consent.js`).APPROVAL_WINDOW_DAYS;
  const mail = require(`${__hooks}/lib/mail_shell.js`);

  const content = [
    mail.p(
      `<strong>${name}</strong> has made an account on Land The Trick, a trick tracker for scooter,
skateboard and BMX riders, and has given us your email address as their parent or carer.`,
    ),
    mail.p('Because of their age, we need your say-so before their account is a normal one.'),
    mail.p(
      `<strong>Right now, without you doing anything, ${name} can:</strong> look through the trick
library, log the tricks they are working on, keep their own notes and build their riding streak.
All of that is private to them.`,
    ),
    mail.p(
      `<strong>They cannot:</strong> be seen by any other rider, join a crew, be invited to one,
submit a skatepark or spot, say they are going to an event, or pay us for anything.
There is no messaging between riders on Land The Trick at all, and there never will be.`,
    ),
    mail.p(
      `<strong>If you approve</strong>, the second list becomes available to them. Their profile
still starts private, and they choose if that ever changes.`,
    ),
    `<div style="padding:4px 0 18px">${mail.button({ href: approve, label: `Approve ${name}’s account` })}</div>`,
    mail.p(
      `That link works for ${days} days. If it runs out, ${name} can send you a new one from their
account.`,
      { size: 13, colour: mail.INK_3 },
    ),
    mail.p(
      `If you would rather not, you do not need to do anything — the account stays as it is. You can
also <a href="${revoke}" style="color:${mail.INK_2}">say no, or change your mind later</a>. That
link never expires, and using it does not delete anything ${name} has logged.`,
      { size: 13, colour: mail.INK_3 },
    ),
    mail.p(
      `If you were not expecting this, ignore it and nothing will happen. Questions or concerns:
<a href="mailto:${SAFEGUARDING_EMAIL}" style="color:${mail.INK_2}">${SAFEGUARDING_EMAIL}</a>.`,
      { size: 13, colour: mail.INK_3, last: true },
    ),
  ].join('\n');

  return mail.shell({
    eyebrow: 'Guardian',
    preheader: `${input.riderName} is waiting on a grown-up. Nothing happens unless you say so.`,
    heading: `${name} needs your OK`,
    content,
    footerNote: 'Sent because a rider gave this address as their parent or carer.',
  });
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
    subject: `${input.riderName} needs your OK on Land The Trick`,
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
