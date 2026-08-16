/// <reference path="../.pb_data/types.d.ts" />

/**
 * The guardian-consent flow (plan §6.2), and the door the §3 guarantee-4 gate
 * depends on being shut.
 *
 * The gate itself already exists: every collection rule and hook that makes a
 * rider visible, reachable or billable refuses an account whose `consent_state`
 * is `pending` or `revoked`, and T2 proved each refusal over HTTP. **Nothing
 * here weakens or repeats that.** What is here is the three things the gate
 * cannot do for itself:
 *
 *  1. **Put an account behind it at sign-up.** `consent_state` is computed from
 *     the declared country and age band by the server, on create, whatever the
 *     client sent. If the client decided this, a client that skipped the call
 *     would skip the gate — the whole guarantee would be a suggestion.
 *  2. **Let it out again.** `/api/landit/consent/*` mints and redeems the
 *     guardian's links and writes `guardian_consents`, which is the evidence the
 *     record exists to be (§6.2: revocation is a state, never a delete).
 *  3. **Let it lapse.** Consent ends on the rider's own birthday with nobody
 *     doing anything, so the band is advanced whenever the account authenticates.
 *
 * Mail goes through PocketBase's own mailer — Resend's SMTP on the product
 * domain (plan §1) — because that is where the credentials live. **Resend is not
 * provisioned yet** (`docs/infrastructure.md`), so a send failure is logged and
 * swallowed: a parent's inbox being unreachable must not roll back the record
 * that says a rider is waiting for them.
 */

// ---------------------------------------------------------------- sign-up --

/**
 * Every sign-up declares a country and an age band.
 *
 * The *request* layer is where the declaration is demanded, because only a
 * request has somebody to demand it of: a seed or a staff tool creating an
 * account is not a rider signing up, and `hasSuperuserAuth` is what tells them
 * apart. What the declaration *means* is decided one layer down.
 */
onRecordCreateRequest((e) => {
  const consent = require(`${__hooks}/lib/consent.js`);

  if (e.hasSuperuserAuth()) {
    e.next();
    return;
  }

  const country = e.record.getString('country');
  const band = e.record.getString('age_band');

  // An undeclared age is not an adult. Refusing here is what stops the gate
  // being opened by omission — a sign-up that simply left the fields out would
  // otherwise land as `not_required`, and every later refusal reads that field.
  if (!consent.isAgeBand(band) || !country) {
    throw new BadRequestError('Sign-up needs a country and an age band.');
  }

  if (consent.signupDeclined(country, band)) {
    // COPPA (plan §6.3). A plain explanation is owed, not a generic 400 — the
    // client turns this into the page that says why, and says it kindly.
    throw new BadRequestError(
      'We cannot open an account for a rider under 13 in the United States yet.',
    );
  }

  e.next();
}, 'users');

/**
 * `consent_state` is a function of the declared country and band, and the server
 * computes it. Whatever the client sent is overwritten.
 *
 * At the **model** layer, like the paywall and for the same reason: it holds on
 * every write path into `users`, not only the ones that arrived as a sign-up
 * request. It also has to run after `10_users.pb.js` has pinned the fields no
 * account may choose about itself — that hook sets `consent_state` to
 * `not_required` along with the other three, and this is the one of the four
 * that is not a constant.
 */
onRecordCreate((e) => {
  const consent = require(`${__hooks}/lib/consent.js`);
  const band = e.record.getString('age_band');
  const country = e.record.getString('country');

  if (consent.isAgeBand(band) && country) {
    e.record.set('consent_state', consent.initialConsentState(country, band));
  }

  e.next();
}, 'users');

/**
 * Bands move on their own, and signing in is when we notice.
 *
 * `band_next_change_on` is what makes that possible without storing a date of
 * birth and without a job scanning anything (plan §3). A rider who turns 13
 * while logged out is out of the gate the next time they authenticate; one who
 * never comes back never needed it.
 */
onRecordAuthRequest((e) => {
  const consent = require(`${__hooks}/lib/consent.js`);
  const record = e.record;

  const moved = consent.advanceBand(
    record.getString('age_band'),
    record.get('band_next_change_on'),
  );
  if (!moved.changed) {
    e.next();
    return;
  }

  record.set('age_band', moved.band);
  record.set('band_next_change_on', moved.bandNextChangeOn);

  // The band is what decides whether consent is still owed. A rider who has aged
  // past their country's threshold stops being limited — including a revoked
  // one, because a revocation cannot outlast the reason it was needed.
  const state = record.getString('consent_state');
  if (
    (state === 'pending' || state === 'revoked') &&
    !consent.consentRequired(record.getString('country'), moved.band)
  ) {
    record.set('consent_state', 'not_required');
  }

  // Model-layer save: this is the server acting as itself, not a request the
  // account made about itself, so it does not go past the guard in
  // `10_users.pb.js` and does not need to.
  e.app.save(record);
  e.next();
}, 'users');

// ------------------------------------------------------------- the routes --

/**
 * Ask a guardian.
 *
 * The rider gives an email address; the server mints two links — one that
 * approves and expires, one that revokes and never does — and stores only their
 * hashes. A fresh request writes a **new** record rather than overwriting the
 * last: `guardian_consents` is evidence, and evidence is not edited in place.
 */
routerAdd(
  'POST',
  '/api/landit/consent/request',
  (e) => {
    const consent = require(`${__hooks}/lib/consent.js`);
    const lib = require(`${__hooks}/lib/landit.js`);
    const rider = e.auth;

    const state = rider.getString('consent_state');
    if (state !== 'pending' && state !== 'revoked') {
      throw new BadRequestError('This account is not waiting on a guardian.');
    }

    const body = new DynamicModel({ guardian_email: '' });
    e.bindBody(body);
    const guardianEmail = String(body.guardian_email || '')
      .trim()
      .toLowerCase();

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guardianEmail)) {
      throw new BadRequestError('That email address does not look right.');
    }
    if (guardianEmail === rider.getString('email').toLowerCase()) {
      // Not a security boundary — a rider can use any address they can read —
      // but the one case obvious enough to be worth refusing out loud.
      throw new BadRequestError('Use a grown-up’s email address, not your own.');
    }

    const approval = consent.mintToken();
    const revocation = consent.mintToken();

    const record = new Record(e.app.findCollectionByNameOrId('guardian_consents'));
    record.set('user', rider.id);
    record.set('guardian_email', guardianEmail);
    record.set('approval_token_hash', approval.hash);
    record.set('approval_expires', consent.approvalExpiry());
    record.set('revocation_token_hash', revocation.hash);
    record.set('requested', new DateTime().string());
    record.set('method', 'email_approval');
    e.app.save(record);

    lib.writeAudit(e.app, {
      actor: rider.id,
      actorKind: 'rider',
      actorLabel: rider.getString('handle'),
      action: 'consent_requested',
      entity: 'guardian_consents',
      entityId: record.id,
      // The address is the evidence; the tokens are never written anywhere but
      // the hashed fields and the email itself.
      after: { guardian_email: guardianEmail },
    });

    const sent = require(`${__hooks}/lib/consent_mail.js`).sendGuardianRequest(e.app, {
      guardianEmail: guardianEmail,
      riderName: rider.getString('name') || rider.getString('handle') || 'A rider',
      approvalToken: approval.token,
      revocationToken: revocation.token,
    });

    return e.json(200, { requested: true, guardian_email: guardianEmail, emailed: sent });
  },
  $apis.requireAuth('users'),
);

/**
 * What a link is for, before it is used.
 *
 * Read-only, so a mail scanner that follows it changes nothing — which is the
 * reason approving is a POST from a page rather than the link itself. A guardian
 * sees whose account they are being asked about before they decide.
 */
routerAdd('POST', '/api/landit/consent/preview', (e) => {
  const found = require(`${__hooks}/lib/consent_route.js`).lookup(e);
  return e.json(200, found.summary);
});

/** The guardian says yes. Idempotent: a link clicked twice is not an error. */
routerAdd('POST', '/api/landit/consent/approve', (e) => {
  const route = require(`${__hooks}/lib/consent_route.js`);
  const found = route.lookup(e, 'approval');
  const consent = require(`${__hooks}/lib/consent.js`);

  if (found.record.getString('revoked')) {
    throw new BadRequestError(
      'This approval was withdrawn. The rider can ask again from their account.',
    );
  }

  if (!found.record.getString('granted')) {
    const expires = found.record.get('approval_expires');
    if (route.expired(expires)) {
      throw new BadRequestError(
        `This link has run out — they last ${consent.APPROVAL_WINDOW_DAYS} days. The rider can send a fresh one.`,
      );
    }
    found.record.set('granted', new DateTime().string());
    e.app.save(found.record);
  }

  route.setConsentState(e, found, 'granted', 'consent_granted');
  return e.json(200, { state: 'granted', rider_name: found.summary.rider_name });
});

/**
 * The guardian says no, or changes their mind later.
 *
 * No expiry, ever (§6.2): the link is in an email a guardian keeps, and it has
 * to work the day they need it. Revocation does not delete the rider's tricks
 * and does not delete this record — it is a state, and the record is the
 * evidence that consent was asked for, given, and taken back.
 */
routerAdd('POST', '/api/landit/consent/revoke', (e) => {
  const route = require(`${__hooks}/lib/consent_route.js`);
  const found = route.lookup(e, 'revocation');

  if (!found.record.getString('revoked')) {
    found.record.set('revoked', new DateTime().string());
    e.app.save(found.record);
  }

  route.setConsentState(e, found, 'revoked', 'consent_revoked');
  return e.json(200, { state: 'revoked', rider_name: found.summary.rider_name });
});
