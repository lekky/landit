/// <reference path="../.pb_data/types.d.ts" />

/**
 * The progress insights opt-in (T9).
 *
 * Its own file rather than another line in `10_users.pb.js`, because it answers
 * a different question from the rest of the account guard: that one is about
 * fields a rider must not be able to forge, this one is about a consent that
 * must not be assumed. `lib/landit.js#guardInsightsOptIn` holds both halves —
 * off by default on create, and entitled-only to switch on.
 *
 * Registered after `10_users.pb.js` so the account guard has already refused
 * any attempt to move `plan` in the same request; the entitlement this reads is
 * therefore the rider's real one, not one they just wrote.
 */
onRecordCreateRequest((e) => {
  require(`${__hooks}/lib/landit.js`).guardInsightsOptIn(e, true);
  e.next();
}, 'users');

onRecordUpdateRequest((e) => {
  require(`${__hooks}/lib/landit.js`).guardInsightsOptIn(e, false);
  e.next();
}, 'users');
