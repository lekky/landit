/// <reference path="../.pb_data/types.d.ts" />

/**
 * How often an account may try a handle (T18).
 *
 * **Handle availability is a question nobody can ask, and that is the problem.**
 * `claimHandle` in `@landit/db` says why: the privacy rules mean a rider cannot
 * read another rider's record, so a taken handle reads as "no such rider", and
 * the only honest way to find out is to claim one and let the unique index
 * answer. That indistinguishability is deliberate — a lookup that answered
 * would be a way to probe for riders.
 *
 * Except a claim answers too. `PATCH /api/collections/users/records/{me}` with
 * `handle: "someone"` returns 400-unique if it is taken and 200 if it is not,
 * which is the same oracle wearing a different hat, one request at a time. At
 * the top of that funnel is a real harm: handles are chosen by children from
 * their own names, so enumerating them is enumerating who is here.
 *
 * So the *attempts* are counted, not the successes. A failed claim leaves no
 * record to count, which is why the count lives in `audit_log`: one row per
 * attempt, written before the write is tried, so a burst of 400s costs exactly
 * as much as a burst of 200s. The rows are worth having on their own terms —
 * "who changed their handle, and when" is a moderation question — and
 * `audit_log` is superuser-only from every direction, so nothing new is exposed.
 *
 * **Twenty an hour** is set against onboarding, which claims up to eight
 * candidates in a loop for a rider whose name collides, and against a person
 * changing their mind about a handle, which is one or two. It is not set against
 * an attacker's patience: twenty an hour is around fifteen thousand a month
 * against a namespace of billions, which makes enumeration pointless without
 * making the product annoying. The dashboard's own request limiter sits in front
 * of this as defence in depth (`lib/ratelimit.js`).
 *
 * Request-layer with a superuser bypass, like the rest of the account guard:
 * the seed and any staff tool writing handles is not a rider probing for names.
 */
onRecordUpdateRequest((e) => {
  const HANDLE_WINDOW_MINUTES = 60;
  const HANDLE_MAX_PER_WINDOW = 20;

  if (e.hasSuperuserAuth()) {
    e.next();
    return;
  }

  const lib = require(`${__hooks}/lib/landit.js`);
  const limits = require(`${__hooks}/lib/ratelimit.js`);

  const wanted = lib.normaliseHandle(e.record.getString('handle'));
  const held = lib.normaliseHandle(e.record.original().getString('handle'));

  // Every other update to `users` — privacy, avatar, the onboarding payload —
  // is none of this hook's business.
  if (wanted === held) {
    e.next();
    return;
  }

  limits.assertUnderRateLimit(e.app, {
    collection: 'audit_log',
    filter: "actor = {:user} && action = 'handle_attempt'",
    params: { user: e.record.id },
    windowMinutes: HANDLE_WINDOW_MINUTES,
    max: HANDLE_MAX_PER_WINDOW,
    message: 'That is a lot of handles in one go. Have a think and try again in a bit.',
  });

  // Written **before** `e.next()`, on purpose. The attempt is the thing being
  // counted, and the attempts worth counting are the ones that fail.
  lib.writeAudit(e.app, {
    actor: e.record.id,
    actorKind: 'rider',
    actorLabel: held,
    action: 'handle_attempt',
    entity: 'users',
    entityId: e.record.id,
    before: { handle: held },
    after: { handle: wanted },
  });

  e.next();
}, 'users');
