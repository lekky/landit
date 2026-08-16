/// <reference path="../../.pb_data/types.d.ts" />

/**
 * The shared half of the three consent routes: find the record a link belongs
 * to, and write the state it decides.
 *
 * Tokens arrive in a **request body**, never in the URL the guardian clicked.
 * The link in the email points at a page in the web app; that page asks the
 * guardian to confirm and posts the token here. A link that acted on its own
 * would be actioned by every mail scanner and link-preview bot that touches the
 * inbox — which for the approval link means a child's account approved by
 * software rather than by a parent.
 */

/** A token nobody minted looks exactly like a token that has been used. */
function refuse() {
  throw new BadRequestError('That link is not valid. Ask the rider to send a fresh one.');
}

/**
 * The consent record a token belongs to.
 *
 * `kind` narrows it to the approval or the revocation link; omitted, either
 * matches, which is what the preview needs — a guardian opening a link should be
 * told what it does rather than made to guess.
 */
function lookup(e, kind) {
  const consent = require(`${__hooks}/lib/consent.js`);

  const body = new DynamicModel({ token: '' });
  e.bindBody(body);
  const token = String(body.token || '').trim();
  if (!token) refuse();

  const hash = consent.hashToken(token);
  let record = null;
  let found = '';

  if (kind !== 'revocation') {
    record = first(e.app, 'approval_token_hash = {:hash}', hash);
    if (record) found = 'approval';
  }
  if (!record && kind !== 'approval') {
    record = first(e.app, 'revocation_token_hash = {:hash}', hash);
    if (record) found = 'revocation';
  }
  if (!record) refuse();

  const rider = e.app.findRecordById('users', record.getString('user'));

  return {
    record: record,
    kind: found,
    rider: rider,
    summary: {
      action: found === 'approval' ? 'approve' : 'revoke',
      // First name only. A guardian needs to recognise the rider, not to be
      // handed their profile — no handle, no email, no town.
      rider_name: firstName(rider.getString('name')),
      granted: !!record.getString('granted'),
      revoked: !!record.getString('revoked'),
      expired: expired(record.get('approval_expires')),
      state: rider.getString('consent_state'),
    },
  };
}

function first(app, filter, hash) {
  try {
    return app.findFirstRecordByFilter('guardian_consents', filter, { hash: hash });
  } catch {
    return null;
  }
}

function firstName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return 'This rider';
  return trimmed.split(/\s+/)[0];
}

/** Has an approval link run out? A missing or unreadable expiry counts as run out. */
function expired(value) {
  const text = String(value == null ? '' : value);
  if (!text) return true;
  const at = new Date(text.replace(' ', 'T'));
  if (isNaN(at.getTime())) return true;
  return at.getTime() <= Date.now();
}

/**
 * Write the rider's `consent_state`, and say so in the audit log.
 *
 * Two things it will not do. It never marks a rider limited when the gate no
 * longer applies to them — a revocation link is forever, but a rider who has
 * since passed their country's threshold cannot be put back behind a gate they
 * have aged out of. And it never writes a state the rider could have written
 * themselves: this is a superuser-free model-layer save, made by the server on
 * a guardian's instruction, which is the only path `10_users.pb.js` leaves open.
 */
function setConsentState(e, found, state, action) {
  const consent = require(`${__hooks}/lib/consent.js`);
  const lib = require(`${__hooks}/lib/landit.js`);
  const rider = found.rider;

  const before = rider.getString('consent_state');
  const stillGated = consent.consentRequired(
    rider.getString('country'),
    rider.getString('age_band'),
  );
  const after = state === 'revoked' && !stillGated ? 'not_required' : state;

  if (before !== after) {
    rider.set('consent_state', after);
    e.app.save(rider);
  }

  lib.writeAudit(e.app, {
    actorKind: 'guest',
    actorLabel: found.record.getString('guardian_email'),
    action: action,
    entity: 'guardian_consents',
    entityId: found.record.id,
    before: { consent_state: before },
    after: { consent_state: after },
  });

  return after;
}

module.exports = { expired, lookup, setConsentState };
