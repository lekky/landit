/// <reference path="../.pb_data/types.d.ts" />

/**
 * A trick entry can name the stage the rider is moving it to
 * (Rachid, 2026-09-13, in chat).
 *
 * `session_tricks` has carried a `landed` boolean since `1789603200_sessions.js`,
 * and the hook turned it into one step up the ladder. Two things were wrong
 * with that from the rider's side. The tickbox never said where the trick was
 * going, so "Landed it" on a trick they were *learning* silently became
 * *Sometimes*. And one step was the only move available, so a rider who went
 * from learning a trick to landing it most times had to log two sessions or
 * edit the trick by hand afterwards.
 *
 * `stage_pick` is what the rider chose. It is a **request, not a result**: the
 * hook honours it only when it is above where the trick actually is, and
 * `stage_from`/`stage_to` remain the server's record of what happened. The
 * once-only promotion is unchanged — an entry that has already moved a trick
 * never moves it again, whatever a later edit sends.
 *
 * Additive, so nothing existing changes: an entry with no `stage_pick` and
 * `landed` set still goes one step up, which is what every row already written
 * did and what an older client still does.
 */
migrate(
  (app) => {
    const entries = app.findCollectionByNameOrId('session_tricks');
    entries.fields.add(
      new SelectField({
        type: 'select',
        name: 'stage_pick',
        values: ['want', 'trying', 'some', 'most', 'every'],
        maxSelect: 1,
        required: false,
      }),
    );
    app.save(entries);
  },
  (app) => {
    const entries = app.findCollectionByNameOrId('session_tricks');
    entries.fields.removeByName('stage_pick');
    app.save(entries);
  },
);
