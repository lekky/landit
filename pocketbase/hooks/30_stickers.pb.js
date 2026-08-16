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

onRecordAfterCreateSuccess(award, 'trick_progress', 'clips', 'challenge_log', 'crew_members');
onRecordAfterUpdateSuccess(award, 'trick_progress');
onRecordAfterDeleteSuccess(award, 'trick_progress', 'clips');

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
