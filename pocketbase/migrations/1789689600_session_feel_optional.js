/// <reference path="../.pb_data/types.d.ts" />

/**
 * "How it felt" stops being required (Rachid, 2026-09-13, in chat).
 *
 * The five faces were `required: true` from `1789603200_sessions.js`, so a
 * rider who wanted the ride on record and nothing else met "Pick how it felt."
 * and could not save. That is the wrong place to spend a refusal: the session
 * is the thing worth keeping, and the mood is a nice-to-have on top of it.
 *
 * Relaxing rather than widening — the five values are unchanged, and a row that
 * already carries one is untouched. The form stops starring the field, and both
 * copies of the rule (`sessionProblems` in `@landit/core` and the hook's
 * `lib/sessions.js`) now refuse only a value that is not one of the five.
 *
 * **The down migration is deliberately not symmetric.** Restoring
 * `required: true` would refuse every row saved without a feel in the meantime,
 * so going back re-marks the column required only when nothing has used the
 * freedom yet; otherwise it leaves the field as it is and says why. A migration
 * that cannot run backwards without deleting a rider's session is one that
 * should not run backwards.
 */
migrate(
  (app) => {
    const sessions = app.findCollectionByNameOrId('sessions');
    const field = sessions.fields.getByName('feel');
    if (!field) throw new Error('sessions.feel is missing');
    field.required = false;
    app.save(sessions);
  },
  (app) => {
    const sessions = app.findCollectionByNameOrId('sessions');
    const field = sessions.fields.getByName('feel');
    if (!field) return;

    // One row is enough to answer the question, so the limit is one.
    const without = app.findRecordsByFilter('sessions', "feel = ''", '', 1, 0);
    if (without.length) {
      console.log('sessions.feel left optional: a session with no feel would be refused.');
      return;
    }

    field.required = true;
    app.save(sessions);
  },
);
