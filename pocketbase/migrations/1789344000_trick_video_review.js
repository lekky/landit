/// <reference path="../.pb_data/types.d.ts" />

/**
 * Four more `tricks.video_*` columns — the staff switch, where the pick came
 * from, and what the nightly liveness check found (Rachid, 2026-09-13, in chat;
 * issues #462 and #463).
 *
 * T35 shipped three columns on the assumption that a person watched every video
 * before typing it in, so the *presence* of a link was the approval. The owner
 * has since asked for the pass to be done automatically, with high-confidence
 * picks live and doubtful ones held back — which splits that single fact into
 * three separate ones, and each needs somewhere to live:
 *
 * 1. **`video_hidden`** — is it off? Set by a staff member on the Tricks tab, or
 *    by the nightly job when YouTube stops serving the video. The trick page
 *    renders no panel when it is true, so hiding is exactly as good as never
 *    having picked one, which is the state most of the library is in anyway.
 * 2. **`video_source`** — `auto` for a pick made by matching a title and a
 *    channel, `staff` for one a person confirmed. This is the column the
 *    "not yet checked" filter reads. It is deliberately *not* a boolean called
 *    `approved`: the honest distinction is who chose it, and a staff member
 *    opening the editor and saving is what turns `auto` into `staff`.
 * 3. **`video_off_reason`** — why the nightly job switched it off, in its own
 *    words (`deleted`, `private`, `embedding disabled`). Without it a staff
 *    member finds a video off and cannot tell whether a colleague did it or
 *    YouTube did.
 * 4. **`video_checked`** — when the job last got an answer about this id. An
 *    empty value means never checked, which is different from checked and fine,
 *    and the difference matters the first time somebody asks how stale the
 *    catalogue is.
 *
 * **Why `video_hidden` rather than clearing the link.** The job could blank
 * `video_id` and the panel would vanish just the same. It must not: a cleared
 * link loses the pick, so a video that was briefly private comes back as an
 * empty trick that somebody has to curate again from nothing. Hiding is
 * reversible by one click and keeps the evidence.
 *
 * **Additive, and safe to run twice.** Four nullable fields on `tricks`; no
 * existing field changes shape and no stored value moves. A database that
 * already carries a column is left alone rather than failed on a duplicate.
 * The `down` path removes exactly what `up` adds, and only what it finds.
 *
 * **No backfill.** Every existing row reads as "not hidden, no source recorded,
 * never checked", which is the correct reading of the handful of videos a
 * person typed in before this existed: they are live and they were chosen by a
 * human. `video_source` is left empty rather than backfilled to `staff` because
 * this migration cannot know that, and the importer sets `auto` explicitly on
 * every row it writes.
 */
migrate(
  (app) => {
    const tricks = app.findCollectionByNameOrId('tricks');

    if (!tricks.fields.getByName('video_hidden')) {
      tricks.fields.add(
        new BoolField({
          type: 'bool',
          name: 'video_hidden',
          required: false,
        }),
      );
    }

    if (!tricks.fields.getByName('video_source')) {
      tricks.fields.add(
        new SelectField({
          type: 'select',
          name: 'video_source',
          required: false,
          maxSelect: 1,
          values: ['auto', 'staff'],
        }),
      );
    }

    if (!tricks.fields.getByName('video_off_reason')) {
      tricks.fields.add(
        new TextField({
          type: 'text',
          name: 'video_off_reason',
          required: false,
        }),
      );
    }

    if (!tricks.fields.getByName('video_checked')) {
      tricks.fields.add(
        new DateField({
          type: 'date',
          name: 'video_checked',
          required: false,
        }),
      );
    }

    app.save(tricks);
  },

  (app) => {
    const tricks = app.findCollectionByNameOrId('tricks');
    for (const name of ['video_hidden', 'video_source', 'video_off_reason', 'video_checked']) {
      const field = tricks.fields.getByName(name);
      if (field) tricks.fields.removeById(field.id);
    }
    app.save(tricks);
  },
);
