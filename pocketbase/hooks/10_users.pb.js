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
 * "Last seen": the session stamp.
 *
 * `onRecordAuthRequest` fires on every successful authentication, which for
 * this app means every sign-in *and* every session refresh — and the web app
 * refreshes the session on each server render of a signed-in page. So a rider
 * reading the trick library stamps this, where `last_ride` only ever moved when
 * they tapped one particular button. That difference is the whole point: the
 * staff table's column was reporting rides and calling it activity.
 *
 * Wrapped, and the result thrown away. A rider must never be refused a sign-in
 * because a bookkeeping write failed — the worst a failure here may cost is a
 * stamp that stays stale until the next refresh, fifteen minutes later at the
 * earliest anyway. `e.next()` runs either way.
 */
onRecordAuthRequest((e) => {
  try {
    require(`${__hooks}/lib/landit.js`).stampLastSeen(e.app, e.record);
  } catch {
    // Deliberately silent: see above.
  }
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
