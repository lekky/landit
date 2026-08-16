/// <reference path="../.pb_data/types.d.ts" />

/**
 * The paywall (plan §3 guarantee 3) and the prerequisite graph's one hard rule.
 *
 * Both are registered on the *model* hooks rather than the request hooks, so
 * they hold on every write path — an API call, a superuser token, a server
 * action, a seed script. "If the paywall only lives in the client it is a
 * suggestion"; the same is true of the layer below the client.
 */
onRecordCreate((e) => {
  require(`${__hooks}/lib/landit.js`).enforcePaywall(e.app, e.record);
  e.next();
}, 'trick_progress');

onRecordUpdate((e) => {
  require(`${__hooks}/lib/landit.js`).enforcePaywall(e.app, e.record);
  e.next();
}, 'trick_progress');

// The log records what happened, so it is paywalled on the same terms as the
// progress row it describes — otherwise a rookie could write history for a
// trick they cannot track.
onRecordCreate((e) => {
  require(`${__hooks}/lib/landit.js`).enforcePaywall(e.app, e.record);
  e.next();
}, 'trick_log');

/** Prerequisites never cross sports (plan §3). Enforced on every write path. */
onRecordCreate((e) => {
  require(`${__hooks}/lib/landit.js`).enforcePrereqSameSport(e.app, e.record);
  e.next();
}, 'trick_prereqs');

onRecordUpdate((e) => {
  require(`${__hooks}/lib/landit.js`).enforcePrereqSameSport(e.app, e.record);
  e.next();
}, 'trick_prereqs');
