/// <reference path="../.pb_data/types.d.ts" />

/**
 * Sticker awards. Clients cannot create `rider_stickers` (`createRule: null`),
 * so this is the only writer — achievements are earned, never sent.
 *
 * Runs after the write succeeds, against stats recomputed from the database.
 */
function award(e) {
  const userId = e.record.getString('user');
  e.next();
  if (!userId) return;
  try {
    require(`${__hooks}/lib/stickers.js`).awardStickers(e.app, userId);
  } catch (err) {
    // A sticker that cannot be evaluated must never fail the rider's write.
    $app.logger().error('sticker award failed', 'user', userId, 'error', String(err));
  }
}

onRecordAfterCreateSuccess(
  award,
  'trick_progress',
  'clips',
  'challenge_log',
  'crew_members',
  // T24: "I'm going" can now earn `showed-up` / `scene-regular`.
  'event_attendance',
);
onRecordAfterUpdateSuccess(award, 'trick_progress');
onRecordAfterDeleteSuccess(award, 'trick_progress', 'clips');

/**
 * T24: a spot approval can earn the contribution awards. The spot row names
 * its rider as `submitted_by`, not `user`, so `award` cannot serve it.
 */
function awardOnSpotChange(e) {
  const userId = e.record.getString('submitted_by');
  e.next();
  if (!userId) return;
  try {
    require(`${__hooks}/lib/stickers.js`).awardStickers(e.app, userId);
  } catch (err) {
    $app.logger().error('sticker award failed', 'user', userId, 'error', String(err));
  }
}
onRecordAfterUpdateSuccess(awardOnSpotChange, 'spots');

/**
 * T24: the rider's own record is now an award source — plan changes
 * (`supporter`), profile completion (`suited-up`), age and joining date
 * (`year-one`, `day-one`), and the streak fields every ride bumps. The same
 * write also carries the one transition-based award: a ride whose previous
 * ride was two months or more ago is a `comeback`, a fact about the *change*
 * that no stats recomputation can see afterwards, so it is read from the
 * record's original state here and granted directly.
 */
/**
 * The user fields whose change can move an award: the plan (`supporter`), the
 * profile (`suited-up`), the streak (the streak ladder), and `last_ride`
 * (`comeback`). A users write that touches none of these — a token refresh, an
 * email verification — skips the pass entirely, because `awardStickers`
 * recomputes the rider's whole stats and `users` is the hottest collection in
 * the app. The time-based awards (`day-one`, `year-one`) ride along on the
 * next relevant write, which is at latest the rider's next ride.
 */
const AWARD_USER_FIELDS = [
  'plan',
  'avatar_key',
  'level',
  'goal',
  'goal_custom',
  'stance',
  'sports',
  'streak',
  'last_ride',
];

function awardOnUserChange(e) {
  const userId = e.record.id;

  let gapDays = 0;
  let relevant = true;
  try {
    const original = e.record.original();

    // The comeback gap, first and on its own: a fault in the relevance guard
    // below must never cost a rider this badge.
    const before = original.getString('last_ride');
    const after = e.record.getString('last_ride');
    if (before && after && after !== before) {
      const ms = Date.parse(after) - Date.parse(before);
      if (!isNaN(ms)) gapDays = Math.floor(ms / 86400000);
    }

    // `getString`, never `get`: `get` on a date field returns a DateTime whose
    // String() is not its value, so a `String(get(...))` comparison read two
    // different dates as equal. Each read fails soft to "changed" — a guard
    // that cannot read a field must not swallow the award pass.
    const read = (record, field) => {
      try {
        if (field === 'sports') return (record.getStringSlice(field) || []).join(',');
        return record.getString(field);
      } catch {
        return `unreadable-${Math.random()}`;
      }
    };
    relevant = AWARD_USER_FIELDS.some((field) => read(e.record, field) !== read(original, field));
  } catch {
    // No original available (a create); the generic pass below still runs.
  }

  e.next();
  if (!userId || !relevant) return;
  try {
    const stickers = require(`${__hooks}/lib/stickers.js`);
    // Eight weeks, matching the award copy "two months away". The threshold is
    // in code because the trigger is; `comeback` carries no tunable `n`.
    if (gapDays >= 56) stickers.awardSpecific(e.app, userId, 'comeback');
    stickers.awardStickers(e.app, userId);
  } catch (err) {
    $app.logger().error('sticker award failed', 'user', userId, 'error', String(err));
  }
}
onRecordAfterCreateSuccess(awardOnUserChange, 'users');
onRecordAfterUpdateSuccess(awardOnUserChange, 'users');

/**
 * A rider may mark a sticker seen — that is the whole of their write access,
 * and it is what stops one being re-announced. Nothing else on the row moves.
 */
onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const before = e.record.original();
    for (const field of ['user', 'sticker', 'earned_at']) {
      if (String(e.record.get(field)) !== String(before.get(field))) {
        throw new ForbiddenError('Only "seen_at" can be changed on an earned sticker.');
      }
    }
  }
  e.next();
}, 'rider_stickers');

/**
 * A rider wiped their history with one trick, so re-judge what they hold.
 *
 * `trick_log` rows are deletable by their owner and always have been (plan §3,
 * "log semantics, reconciled" — "if they want the history gone they delete the
 * log rows, which they may"); until now nothing in the product offered it. The
 * trick page's history panel does, for a rider who has already stopped
 * tracking, behind a confirm that tells them the badge goes with it (Rachid,
 * 2026-09-13, in chat).
 *
 * Deleting the rows is the rider's write; taking the sticker back cannot be,
 * because `rider_stickers` is `deleteRule: null` — the same lock that makes
 * awards unforgeable makes them un-droppable from a screen. So it happens here,
 * on the server, or not at all.
 *
 * **Two guards, and the pass is wrong without either.**
 *
 * Only on the *last* row. The action deletes a trick's log a row at a time and
 * `revokeStickers` recomputes the rider's whole stats, so firing on each one
 * would do that work N times and do it against a half-deleted history. Counting
 * what is left is one indexed query (`idx_trick_log_user_trick`) and gives a
 * single pass over the finished state.
 *
 * Never during erasure. `anonymiseRider` deletes `trick_log` before
 * `rider_stickers` and counts the rows it removes as it goes, so a revoke
 * firing mid-wipe would delete rows the erasure is about to count and make
 * `records_removed` under-report what was destroyed. The identity is
 * anonymised *before* any of the deleting starts, which is what makes
 * `anonymised_at` a reliable "this is an erasure, stand down".
 *
 * And never on a trick that has gone. `trick_log.trick` is `cascadeDelete`, so
 * staff removing a trick from the catalogue empties every rider's log for it —
 * which arrives here looking exactly like a rider clearing their history, and
 * would take awards off people who had done nothing. That is the going
 * backwards under somebody else's edit that issue #78 settled must not happen.
 * A rider's own reset always runs against a trick that still exists, so the
 * check costs the real path nothing.
 */
function revokeOnHistoryCleared(e) {
  const userId = e.record.getString('user');
  const trickId = e.record.getString('trick');
  e.next();
  if (!userId || !trickId) return;

  try {
    const lib = require(`${__hooks}/lib/landit.js`);

    const left = lib.findAll(e.app, 'trick_log', 'user = {:user} && trick = {:trick}', {
      user: userId,
      trick: trickId,
    });
    if (left.length) return;

    try {
      e.app.findRecordById('tricks', trickId);
    } catch {
      return;
    }

    const rider = e.app.findRecordById('users', userId);
    if (rider.getString('anonymised_at') !== '') return;

    require(`${__hooks}/lib/stickers.js`).revokeStickers(e.app, userId);
  } catch (err) {
    // A sticker that cannot be re-judged must never fail the rider's delete —
    // the same bargain `award` makes, and it fails the same way: towards the
    // rider keeping what they hold.
    $app.logger().error('sticker revoke failed', 'user', userId, 'error', String(err));
  }
}
onRecordAfterDeleteSuccess(revokeOnHistoryCleared, 'trick_log');
