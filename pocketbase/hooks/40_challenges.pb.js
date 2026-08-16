/// <reference path="../.pb_data/types.d.ts" />

/**
 * "One live challenge per sport" (plan §3). SQLite has no exclusion constraint,
 * so this hook *is* the constraint — which is why it sits on the model hooks
 * and runs on every write path, not on the request hooks.
 */
onRecordCreate((e) => {
  require(`${__hooks}/lib/landit.js`).enforceNoChallengeOverlap(e.app, e.record);
  e.next();
}, 'challenges');

onRecordUpdate((e) => {
  require(`${__hooks}/lib/landit.js`).enforceNoChallengeOverlap(e.app, e.record);
  e.next();
}, 'challenges');

/**
 * The log button only works while the challenge is live, and "live" is derived
 * from the dates rather than stored — so the client cannot log into last week
 * by asking nicely.
 */
onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/lib/landit.js`);
  const now = new DateTime().string();

  // Staff backfills go through a superuser client and are not the client this
  // gate exists for.
  if (!e.hasSuperuserAuth()) {
    const challenge = e.app.findRecordById('challenges', e.record.getString('challenge'));
    if (!lib.challengeIsLive(challenge, now)) {
      throw new ForbiddenError(`"${challenge.getString('title')}" is not running right now.`);
    }
    if (e.auth) e.record.set('user', e.auth.id);
  }

  if (!e.record.getString('at')) e.record.set('at', now);
  e.next();
}, 'challenge_log');
