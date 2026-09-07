/// <reference path="../.pb_data/types.d.ts" />

/**
 * `tricks.mistakes` and `tricks.hard` — the researched per-trick content gets
 * its columns (T28; Rachid, 2026-09-07, in chat).
 *
 * **Why the columns have to exist at all.** T28 added two optional fields to
 * the `Trick` shape in `@landit/core` — three or four common mistakes, each
 * with a fix, and a line on why the trick sits at its tier — and filled them
 * for all 259 tricks in the canonical data. Every rule and every screen is
 * handed the *live rows* rather than that data, so a staff edit takes effect
 * without a deploy (`packages/core/src/rules/tricks.ts`); content that lives
 * only in TypeScript is content the product cannot show. The columns are the
 * other half of the fields, exactly as `1788134400_trick_supervise.js` was for
 * `supervise`.
 *
 * **Why `mistakes` is json and `hard` is text.** A mistake is a pair — the
 * mistake and its fix — and a trick has three or four of them. Eight text
 * columns would fix the count in the schema, where the limit belongs to the
 * content rules (`TRICK_CONTENT_LIMITS`) and the hook that enforces them on a
 * staff edit. `hard` is one string and stays one.
 *
 * **No backfill, and that is the point.** `supervise` had to be backfilled
 * because a `bool` reads `false` on every existing row, and `false` there was
 * a lie a guardian would act on. These two are different: an empty json field
 * and an empty text field both read as *nothing*, and the mapping in
 * `packages/db/src/queries.ts` turns nothing into an absent field, which the
 * `Trick` type spells out as "not written yet". A database migrated but not
 * yet re-seeded shows a trick page with no mistakes section, which is what it
 * showed before this change. The seed fills the columns; nothing here does.
 *
 * **Safe to run twice.** A database that already carries the columns — one
 * that took this migration from another branch, or a scratch instance built
 * more than once — is left alone rather than failed on a duplicate field.
 *
 * **Additive.** Two nullable fields on `tricks`; no existing field changes
 * shape and no stored value moves. The `down` path removes exactly what `up`
 * adds, and only what it finds.
 */
migrate(
  (app) => {
    const tricks = app.findCollectionByNameOrId('tricks');

    if (!tricks.fields.getByName('mistakes')) {
      tricks.fields.add(
        new JSONField({
          type: 'json',
          name: 'mistakes',
          required: false,
          maxSize: 0,
        }),
      );
    }

    if (!tricks.fields.getByName('hard')) {
      tricks.fields.add(
        new TextField({
          type: 'text',
          name: 'hard',
          required: false,
        }),
      );
    }

    app.save(tricks);
  },

  (app) => {
    const tricks = app.findCollectionByNameOrId('tricks');
    for (const name of ['mistakes', 'hard']) {
      const field = tricks.fields.getByName(name);
      if (field) tricks.fields.removeById(field.id);
    }
    app.save(tricks);
  },
);
