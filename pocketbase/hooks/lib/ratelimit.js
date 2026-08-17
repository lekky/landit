/// <reference path="../../.pb_data/types.d.ts" />

/**
 * Counting what one account has already done, so a route can refuse the next
 * one.
 *
 * Deliberately generic and deliberately dull: a filter, a window and a ceiling.
 * The *numbers* belong to the caller, because they are a product decision — how
 * many spots an hour is a different question from how many emails a guardian
 * should get — and burying them here would put them somewhere nobody looks.
 *
 * **Why a hook and not PocketBase's own rate limiter.** The built-in limiter is
 * configured in the dashboard and keyed on the request, which makes it a
 * deployment setting rather than a rule of the product: it is not in the repo,
 * not in the migrations, and not proven by a test. A limit the plan calls for
 * (§7, T13) has to survive a fresh box and a re-import, so it lives in code with
 * the rest of the rules. The two are not exclusive — a dashboard limit in front
 * of this one is defence in depth, not a replacement.
 *
 * Both counts read the *record* table rather than a counter, so nothing has to
 * be reset, expired or kept in sync. At the volumes this guards — single digits
 * per rider — that is cheaper than the bookkeeping would be.
 *
 * Issue #32 wanted the same treatment for `POST /api/landit/consent/request`.
 * T18 did it, and the numbers stayed where this file says they belong — at the
 * call site in `90_consent.pb.js`, with the note that they are tunable defaults
 * rather than decisions. The one thing that turned out to matter more than the
 * per-rider count is the second limit there: **per guardian address, across
 * every rider**, because the person being emailed has no account here and no
 * way to say no.
 *
 * T18 also added three more callers — `95_reports.pb.js`, `96_account.pb.js`
 * and `12_handles.pb.js`. Two of them count rows in `audit_log` rather than in
 * a collection of their own, which is the pattern to reach for when the thing
 * being limited is an *attempt* rather than a record: an attempt that fails
 * leaves nothing to count, and an audit row is the honest place to leave one.
 */

/** PocketBase's stored datetime format, N minutes ago. */
function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60000).toISOString().replace('T', ' ');
}

function countMatching(app, collection, filter, params) {
  return app.findRecordsByFilter(collection, filter, '', 0, 0, params || {}).length;
}

/**
 * Refuse the caller if they have already done this too many times lately.
 *
 * `429`, not `400`: the request is well formed and would have been allowed an
 * hour ago, and a client that cannot tell the two apart will retry a body it
 * should not. `ApiError` is what carries a status the named error classes do not
 * cover.
 *
 * @param {core.App} app
 * @param {{
 *   collection: string,
 *   filter: string,
 *   params?: Object,
 *   windowMinutes: number,
 *   max: number,
 *   message: string,
 * }} limit
 */
function assertUnderRateLimit(app, limit) {
  const params = Object.assign({}, limit.params, { since: minutesAgo(limit.windowMinutes) });
  const used = countMatching(
    app,
    limit.collection,
    `(${limit.filter}) && created >= {:since}`,
    params,
  );
  if (used >= limit.max) throw new ApiError(429, limit.message, null);
}

/**
 * Refuse the caller if too many of theirs are already waiting.
 *
 * The companion the window needs. On its own, an hourly limit only spreads a
 * flood out: a rider stopped at three an hour comes back tomorrow, and a review
 * queue that humans read grows faster than it is emptied. This one does not
 * expire — it clears when staff clear it, which is the point.
 *
 * @param {core.App} app
 * @param {{ collection: string, filter: string, params?: Object, max: number, message: string }} limit
 */
function assertUnderOutstandingLimit(app, limit) {
  const used = countMatching(app, limit.collection, limit.filter, limit.params);
  if (used >= limit.max) throw new ApiError(429, limit.message, null);
}

module.exports = {
  assertUnderOutstandingLimit,
  assertUnderRateLimit,
  countMatching,
  minutesAgo,
};
