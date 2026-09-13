/// <reference path="../.pb_data/types.d.ts" />

/**
 * The suggestion box, server side.
 *
 * The companion to `95_reports.pb.js` and deliberately a much smaller file,
 * because a suggestion carries none of the weight a report does. What it does
 * share is the shape: the rules live in `@landit/core`
 * (`rules/suggestions.ts`), the form warns with them, and this refuses with
 * them again. A form that trusted its own check would be a form that decides
 * who may write to us.
 *
 * Three things this pins, whatever the request body claimed:
 *
 *  1. **`rider`** is the authenticated account, never what was sent. The
 *     collection's `createRule` already requires a session, so unlike reports
 *     there is no anonymous branch here at all — but a body naming *another*
 *     rider would still put somebody else's name on an idea, and on a product
 *     where staff read these by hand that is worth one line to stop.
 *  2. **`status`** is `new`. A suggestion that arrived already `declined` is
 *     one nobody will read.
 *  3. **`note`** is empty. It is what staff wrote, and there is nothing
 *     legitimate to put there on the way in.
 *
 * **The rate limits are its own, and that is the point of the whole file.**
 * They count rows in `suggestions`, never in `reports`, so no number of ideas
 * can use up a rider's ability to file a safeguarding report. If these two ever
 * end up counting the same table, that guarantee is gone — `suggestions.test.ts`
 * in `@landit/core` asserts the constants stay apart, and
 * `pocketbase/tests/suggestions.test.ts` proves it over HTTP.
 */

onRecordCreateRequest((e) => {
  // Every constant is declared inside the handler: it is serialised into an
  // isolated VM and arrives with no closure over this file (`lib/landit.js`
  // header, and the same note in `95_reports.pb.js`).
  const TOPICS = ['trick', 'feature', 'event', 'bug', 'other'];
  const DETAIL_MAX = 1000;

  const SUGGESTION_WINDOW_MINUTES = 60;
  const SUGGESTION_MAX_PER_WINDOW = 3;
  const SUGGESTION_MAX_OPEN = 10;

  if (e.hasSuperuserAuth()) {
    e.next();
    return;
  }

  const limits = require(`${__hooks}/lib/ratelimit.js`);
  const rider = e.auth;
  const record = e.record;

  // The create rule says the same thing. Checked again because a rule is a
  // filter on requests and a hook is a rule about records: anything that
  // reaches here without a session has bypassed the first, and this is the
  // half that does not depend on which door was used.
  if (!rider) {
    throw new BadRequestError('Sign in to send us an idea.');
  }

  record.set('rider', rider.id);
  record.set('status', 'new');
  record.set('note', '');

  const topic = String(record.get('topic') || '').trim();
  if (TOPICS.indexOf(topic) === -1) {
    throw new BadRequestError('Pick what this is about.');
  }

  const detail = String(record.get('detail') || '').trim();
  if (!detail) {
    throw new BadRequestError('Tell us the idea, in your own words.');
  }
  if (detail.length > DETAIL_MAX) {
    throw new BadRequestError(`Keep it under ${DETAIL_MAX} characters.`);
  }
  record.set('detail', detail);

  // ------------------------------------------------------------- how many --

  // Keyed on the account, and counting `suggestions` only. See the header: the
  // moment this filter names another collection, an idea can cost a rider a
  // report.
  const key = { filter: 'rider = {:who}', params: { who: rider.id } };

  limits.assertUnderOutstandingLimit(e.app, {
    collection: 'suggestions',
    filter: `(${key.filter}) && status = 'new'`,
    params: key.params,
    max: SUGGESTION_MAX_OPEN,
    message:
      'You have a few ideas waiting with us already. We read all of them — give us a chance to catch up before the next one.',
  });

  limits.assertUnderRateLimit(e.app, {
    collection: 'suggestions',
    filter: key.filter,
    params: key.params,
    windowMinutes: SUGGESTION_WINDOW_MINUTES,
    max: SUGGESTION_MAX_PER_WINDOW,
    message:
      'That is a lot of ideas in one go. Give it an hour — the ones you have sent are already with us.',
  });

  e.next();
}, 'suggestions');

/*
 * **Deliberately not in `lib/audit.js`'s `AUDITED` list**, where `reports` is.
 *
 * The audit log is the trail an annual OSA review reads and the record of what
 * staff did to whose account; a rider asking for a trick is neither. Staff
 * triage still leaves a row, because `applyStaffChange` in `@landit/db` writes
 * one itself for every admin write — so the half that is about somebody's
 * decision is logged, and the half that is somebody's idea is not.
 */
