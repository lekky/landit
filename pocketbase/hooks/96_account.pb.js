/// <reference path="../.pb_data/types.d.ts" />

/**
 * The two routes the privacy policy owes a rider (T18; plan §6.5).
 *
 * `POST /api/landit/account/export` — everything we hold about you, as JSON.
 * `POST /api/landit/account/delete` — erasure, which here means
 *   anonymise-and-retain (owner decision, Rachid, 2026-08-17, in chat; the
 *   reasoning and the line between wiped and kept are in `lib/erasure.js`).
 *
 * Both are **PocketBase routes rather than Next.js server actions**, and that is
 * the security decision in this file. A server action holding the superuser
 * client would put the field list, the deletion rule and the rate limit in a
 * place the hook test suite cannot reach — and plan §3 is explicit that a rule
 * proven by reading the client is not proven. Here they are exercised over HTTP
 * with a rider's own token, which is the only thing that says a browser cannot
 * do it either.
 *
 * **The subject is always `e.auth`.** Neither route reads an account id out of
 * the request. There is no parameter to tamper with, so "export somebody else"
 * is not a request that can be phrased, let alone refused — the strongest
 * version of guarantee 1 available on a route that necessarily bypasses the
 * collection rules.
 *
 * **Deleting asks for the password again.** A session token is enough to change
 * a profile and not enough to end an account: a borrowed phone, a shared laptop
 * or a stolen token should not be able to wipe a child's ride history. The
 * confirmation is checked against the record, on the server, and a wrong one is
 * a 400 that changes nothing.
 */

/**
 * `anonymised_at` is the server's to write, like the four fields in
 * `lib/landit.js#guardUserWrite`.
 *
 * It joins them for a reason worth writing down. `users.updateRule` is
 * `id = @request.auth.id`, so without this a rider could `PATCH` the stamp onto
 * their own record — and the delete route below reads exactly that field to
 * decide it has nothing to do. The account would then be told, truthfully as
 * far as the response goes, that it had been closed: `{deleted: true}`, cookie
 * cleared, redirected out, and not one field wiped. A right-to-erasure that
 * silently no-ops while reporting success is a worse failure than one that
 * errors, because nobody looks again.
 *
 * A hook of its own rather than another entry in `USER_PROTECTED_DEFAULTS`:
 * `lib/landit.js` is shared code another session is editing, and a new
 * registration is additive where an edited constant is not.
 */
onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) {
    e.next();
    return;
  }

  const before = e.record.original().getDateTime('anonymised_at').string();
  const after = e.record.getDateTime('anonymised_at').string();
  if (before !== after) {
    throw new ForbiddenError(
      '"anonymised_at" is not something an account can change about itself.',
    );
  }

  e.next();
}, 'users');

/**
 * A rider may end their account. They may not delete the row.
 *
 * The rule change in `1787702400_users_no_self_delete.js` is what actually
 * refuses this — a `null` `deleteRule` is superuser-only and a rider's request
 * never reaches a hook. This is the belt to that migration's braces, and it
 * earns its place for one specific reason: the rule lives in a collection
 * record that the superuser dashboard can edit by hand, and a `deleteRule`
 * typed back to `id = @request.auth.id` in a browser would silently reopen a
 * route that cascade-deletes guardian consent records. A hook cannot be
 * changed from a browser.
 *
 * The message names the route that does the right thing, because the caller
 * hitting this is far more likely to be our own client than an attacker.
 */
onRecordDeleteRequest((e) => {
  if (e.hasSuperuserAuth()) {
    e.next();
    return;
  }

  throw new ForbiddenError(
    'An account is closed through /api/landit/account/delete, which anonymises it. ' +
      'The record itself is not deletable.',
  );
}, 'users');

/**
 * Take everything with you.
 *
 * Rate-limited on the audit rows the route itself writes — an export is the
 * most expensive read in the product and the one worth turning into a loop.
 * Five an hour is well past what a person doing this deliberately needs.
 */
routerAdd(
  'POST',
  '/api/landit/account/export',
  (e) => {
    const EXPORT_WINDOW_MINUTES = 60;
    const EXPORT_MAX_PER_WINDOW = 5;

    const erasure = require(`${__hooks}/lib/erasure.js`);
    const lib = require(`${__hooks}/lib/landit.js`);
    const limits = require(`${__hooks}/lib/ratelimit.js`);
    const rider = e.auth;

    limits.assertUnderRateLimit(e.app, {
      collection: 'audit_log',
      filter: "actor = {:user} && action = 'data_exported'",
      params: { user: rider.id },
      windowMinutes: EXPORT_WINDOW_MINUTES,
      max: EXPORT_MAX_PER_WINDOW,
      message: 'You have downloaded this a few times just now. Try again in an hour.',
    });

    const payload = erasure.exportFor(e.app, rider);

    // Logged because a subject access request is a thing that happened to an
    // account, and because the row is what the limit above counts. No copy of
    // the payload — the audit log is not a second store of everything.
    lib.writeAudit(e.app, {
      actor: rider.id,
      actorKind: 'rider',
      actorLabel: rider.getString('handle'),
      action: 'data_exported',
      entity: 'users',
      entityId: rider.id,
    });

    return e.json(200, payload);
  },
  $apis.requireAuth('users'),
);

/**
 * End the account.
 *
 * Idempotent: a second call on an already-erased account returns the same
 * pseudonym rather than an error — though in practice there is no way to make
 * one, because the first call invalidates every token the caller holds.
 */
routerAdd(
  'POST',
  '/api/landit/account/delete',
  (e) => {
    const erasure = require(`${__hooks}/lib/erasure.js`);
    const rider = e.auth;

    // `.isZero()`, not truthiness: an unset date field hands back a `DateTime`
    // whose value is the zero time, and a `DateTime` is an object, and every
    // object is truthy. Read as a boolean this branch fires on **every**
    // account and the route becomes a no-op that reports success — which is
    // exactly what it did until the tests caught it.
    if (!rider.getDateTime('anonymised_at').isZero()) {
      return e.json(200, { deleted: true, pseudonym: erasure.pseudonymFor(rider.id) });
    }

    const body = new DynamicModel({ password: '', confirm: '' });
    e.bindBody(body);

    // A typed word as well as the password. The password proves it is them; the
    // word proves they meant this button and not the one above it.
    if (
      String(body.confirm || '')
        .trim()
        .toUpperCase() !== 'DELETE'
    ) {
      throw new BadRequestError('Type DELETE to confirm.');
    }

    if (!rider.validatePassword(String(body.password || ''))) {
      throw new BadRequestError('That password is not right.');
    }

    const result = erasure.anonymiseAccount(e.app, rider, { actorKind: 'rider' });

    return e.json(200, {
      deleted: true,
      pseudonym: result.pseudonym,
      records_removed: result.records_removed,
    });
  },
  $apis.requireAuth('users'),
);
