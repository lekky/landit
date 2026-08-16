/// <reference path="../.pb_data/types.d.ts" />

/**
 * The account guard.
 *
 * `role`, `plan`, `consent_state` and `suspended` are the four fields worth
 * forging, and none of them is writable by the account they describe — see
 * `lib/landit.js#guardUserWrite`. Handles are normalised and checked against
 * the reserved list here so there is one place that decides what a handle is.
 *
 * Registered on the *request* hooks: server code holding a superuser client is
 * trusted (it is how staff change a role at all), the API is not.
 */
onRecordCreateRequest((e) => {
  require(`${__hooks}/lib/landit.js`).guardUserWrite(e, true);
  e.next();
}, 'users');

onRecordUpdateRequest((e) => {
  require(`${__hooks}/lib/landit.js`).guardUserWrite(e, false);
  e.next();
}, 'users');

/**
 * `consent_state` is written by the consent flow (T6) through server code, not
 * by riders — including via any other collection's side effects. This is the
 * belt to the request guard's braces: it also catches a write made with a
 * superuser token that did not mean to change consent.
 */
onRecordUpdate((e) => {
  const before = e.record.original().getString('consent_state');
  const after = e.record.getString('consent_state');
  if (before && after && before !== after) {
    require(`${__hooks}/lib/landit.js`).writeAudit(e.app, {
      action: 'consent_state',
      entity: 'users',
      entityId: e.record.id,
      before: { consent_state: before },
      after: { consent_state: after },
    });
  }
  e.next();
}, 'users');
