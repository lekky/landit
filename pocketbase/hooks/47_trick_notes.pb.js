/// <reference path="../.pb_data/types.d.ts" />

/**
 * Session notes (T30) — the log's limits, enforced.
 *
 * `60_ownership.pb.js` already decides whose row a note is: `user` is set from
 * the token on the request path, and the owner-only rules refuse every read or
 * write across riders (plan §3, guarantee 1). What this file adds is what a rule
 * cannot say — a **cap** of fifty notes per rider per trick, a **stage** that
 * must be one of the five or empty, a **body** that fits, and a freeze on
 * `user` and `trick` once a note exists.
 *
 * Model hooks, not request hooks, and with **no superuser bypass** — the same
 * split `45_video_links.pb.js` explains. A cap checked on the request path is
 * one our own server actions could walk past; checked here it holds on every
 * write path there is.
 */
onRecordCreate((e) => {
  require(`${__hooks}/lib/landit.js`).enforceTrickNote(e.app, e.record, true);
  e.next();
}, 'trick_notes');

onRecordUpdate((e) => {
  require(`${__hooks}/lib/landit.js`).enforceTrickNote(e.app, e.record, false);
  e.next();
}, 'trick_notes');
