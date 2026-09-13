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

/**
 * The researched per-trick content keeps its shape on a staff edit (T28).
 *
 * `mistakes` is a json column and `hard` is free text, so nothing in the
 * schema holds either to the limits the content was written to — three or
 * four mistakes, a `what` of eight words ending in a full stop, a `fix` of
 * twenty, a `hard` of thirty-five. The staff editor checks them client-side
 * for a friendlier message; this is where they bind, on the model hooks so a
 * superuser token and the seed go through the same door as the editor.
 */
onRecordCreate((e) => {
  require(`${__hooks}/lib/landit.js`).enforceTrickContentLimits(e.record);
  e.next();
}, 'tricks');

onRecordUpdate((e) => {
  require(`${__hooks}/lib/landit.js`).enforceTrickContentLimits(e.record);
  e.next();
}, 'tricks');

/**
 * The staff-picked tutorial is whole or absent, and `video_id` is always an id
 * (T35).
 *
 * Model hooks for the same reason the content limits are: the staff editor
 * checks the same rules client-side for a friendlier message, and this is where
 * they bind — on every write path, so a superuser token goes through the same
 * door as the portal. The re-parse is the half that matters most: it is what
 * guarantees the string reaching an `<iframe src>` is eleven characters of
 * YouTube id and not something a hand edit chose.
 */
onRecordCreate((e) => {
  require(`${__hooks}/lib/landit.js`).enforceTrickVideo(e.record);
  e.next();
}, 'tricks');

onRecordUpdate((e) => {
  require(`${__hooks}/lib/landit.js`).enforceTrickVideo(e.record);
  e.next();
}, 'tricks');
