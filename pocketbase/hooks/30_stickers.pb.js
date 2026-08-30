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
