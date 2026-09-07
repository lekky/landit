/// <reference path="../.pb_data/types.d.ts" />

/**
 * `trick_notes` becomes a log — many dated notes per rider per trick, each
 * carrying the stage the rider was at when it was written (Rachid, 2026-09-07,
 * in chat; plan §7, T30).
 *
 * **What moves.** The init migration gave the collection a **unique** index on
 * `(user, trick)`, which is what made "one note per trick" true at the schema
 * layer rather than only in the screen. That index goes, and a plain index on
 * the same pair takes its place so the per-trick list stays a cheap read. Then
 * one nullable field: `stage`, a select over the five stage ids, snapshotting
 * where the rider was on the trick when the note was saved. It is a snapshot on
 * purpose — the note says "8 of 10 at the park" *while learning*, and that fact
 * should not rewrite itself when the rider moves up the ladder next month.
 *
 * **What does not move.** The five owner-only rules (plan §3, guarantee 1: a
 * note is private to its rider at every privacy setting) are untouched, and so
 * is every existing row — a rider's single note simply becomes the first entry
 * in their list, with no stage, because nothing recorded one at the time. The
 * body's 2000-character limit is unchanged.
 *
 * **The cap is not here.** Fifty notes per rider per trick is a count, and a
 * schema cannot count rows; `pocketbase/hooks/47_trick_notes.pb.js` enforces it
 * at the model layer, where a superuser client cannot step round it either.
 *
 * **Additive.** Dropping a *unique* constraint refuses nothing that was
 * previously allowed; every write that used to succeed still does. The `down`
 * path restores the unique index, which will fail on a database that already
 * holds two notes on one trick — correct, since that data cannot fit the old
 * shape and a rollback that silently dropped notes would be worse.
 */
migrate(
  (app) => {
    const notes = app.findCollectionByNameOrId('trick_notes');

    notes.indexes = notes.indexes
      .filter((sql) => sql.indexOf('idx_trick_notes_pair') === -1)
      .concat(['CREATE INDEX `idx_trick_notes_user_trick` ON `trick_notes` (`user`, `trick`)']);

    notes.fields.add(
      new SelectField({
        type: 'select',
        name: 'stage',
        required: false,
        maxSelect: 1,
        // The five stage ids, in ladder order — the same list `@landit/core`
        // exports as `STAGE_IDS` and `trick_progress.stage` already selects from.
        values: ['want', 'trying', 'some', 'most', 'every'],
      }),
    );

    app.save(notes);
  },

  (app) => {
    const notes = app.findCollectionByNameOrId('trick_notes');
    notes.fields.removeByName('stage');
    notes.indexes = notes.indexes
      .filter((sql) => sql.indexOf('idx_trick_notes_user_trick') === -1)
      .concat(['CREATE UNIQUE INDEX `idx_trick_notes_pair` ON `trick_notes` (`user`, `trick`)']);
    app.save(notes);
  },
);
