/// <reference path="../.pb_data/types.d.ts" />

/**
 * Sessions (T36) — plan §1 D1–D6, §3 guarantees 1–4.
 *
 * Two layers, the split `45_video_links.pb.js` makes:
 *
 * - **Request hooks** decide whose row it is. They step aside for a superuser
 *   token, because a server action writing on a rider's behalf names the rider
 *   itself and has no `e.auth` to read.
 * - **Model hooks** do everything else — the shape, the spot, the crew tags,
 *   the clip and its allowance, the monthly quota and its grace, the paywall
 *   and the one-way stage promotion — with **no bypass at all**, so our own
 *   superuser client is held to a rider's plan (`lib/sessions.js`).
 *
 * And one enrich hook, which is the D3 half a rule cannot express: another
 * rider is only ever sent the "rode with" ids whose profiles they could open.
 */

/** The row is the caller's. The create rule already refuses a body naming somebody else. */
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth() && e.auth) e.record.set('user', e.auth.id);
  e.next();
}, 'sessions');

/**
 * The quota, the clip and the rest — and, when the grace is spent, the one row
 * that makes it spent. The grace row is written **before** the session, so a
 * second request racing the first hits the unique index on `session_grace.user`
 * and is refused, rather than both saving on one grace. If the session then
 * fails to save, the grace row is removed again: a grace is spent by a saved
 * session, not by an attempt.
 */
onRecordCreate((e) => {
  const sessions = require(`${__hooks}/lib/sessions.js`);
  const rules = require(`${__hooks}/lib/session_rules.js`);
  const outcome = sessions.enforceSession(e.app, e.record, true);

  if (!outcome.grace) {
    e.next();
    return;
  }

  const row = new Record(e.app.findCollectionByNameOrId('session_grace'));
  row.set('user', e.record.getString('user'));
  row.set('month_key', outcome.monthKey);
  try {
    e.app.save(row);
  } catch {
    throw new ForbiddenError(rules.SESSION_REFUSALS.graceUsed);
  }

  try {
    e.next();
  } catch (err) {
    try {
      e.app.delete(row);
    } catch {
      // The session did not save; a stranded grace row is the lesser failure.
    }
    throw err;
  }

  try {
    row.set('session', e.record.id);
    e.app.save(row);
  } catch {
    // The link back to the session is bookkeeping; the grace is spent either way.
  }
}, 'sessions');

onRecordUpdate((e) => {
  require(`${__hooks}/lib/sessions.js`).enforceSession(e.app, e.record, false);
  e.next();
}, 'sessions');

/** D3: strip "rode with" riders the reader could not see, and the quota fields. */
onRecordEnrich((e) => {
  require(`${__hooks}/lib/sessions.js`).enrichSession(e);
  e.next();
}, 'sessions');

/** A trick entry's `user` is its session's, whatever the body said. */
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth() && e.auth) e.record.set('user', e.auth.id);
  e.next();
}, 'session_tricks');

onRecordCreate((e) => {
  require(`${__hooks}/lib/sessions.js`).enforceSessionTrick(e.app, e.record, true);
  e.next();
}, 'session_tricks');

onRecordUpdate((e) => {
  require(`${__hooks}/lib/sessions.js`).enforceSessionTrick(e.app, e.record, false);
  e.next();
}, 'session_tricks');
