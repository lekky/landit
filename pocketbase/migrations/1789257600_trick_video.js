/// <reference path="../.pb_data/types.d.ts" />

/**
 * `tricks.video_id`, `tricks.video_title` and `tricks.video_channel` — the
 * staff-picked tutorial gets its columns (T35; Rachid, 2026-09-12, in chat).
 *
 * **Why three columns and not one.** The id is what plays. The title and the
 * channel are what the panel can *say* before anything plays, and they have to
 * be stored rather than fetched: asking YouTube for a title would be a request
 * to Google from a child's page on load, which is exactly what `VideoEmbed`'s
 * click-to-play gate exists to prevent (plan §6.8 — the product carries no
 * consent banner, deliberately, and a page-load ping to a Google host would put
 * one back on the roadmap). Storing them is what keeps v1 free of an API key,
 * a Google Cloud project and a quota.
 *
 * **Database-only, unlike T28's content.** `mistakes` and `hard` are in the
 * canonical `TRICKS` data as well as in these columns, so the seed fills them.
 * These three are deliberately *not*: there is no video in `@landit/core`, the
 * seed never writes these columns, and the only way a value gets here is a
 * staff member typing it into the portal after watching the thing. That is what
 * makes the staff edit the approval, and it sidesteps issue #273 — a seed run
 * cannot revert a curation pass it does not know about.
 *
 * **No backfill, and empty is the intended state of nearly every row.** An
 * empty `video_id` reads as "nobody has picked one", `tricksFromRecords` turns
 * it into an absent `Trick.video`, and the trick page renders no panel at all.
 * That is the same page the product shows today, so a database that takes this
 * migration and is never curated is unchanged for riders — which is the point:
 * the mechanism can ship before the 259-trick curation pass exists.
 *
 * **Safe to run twice.** A database that already carries the columns is left
 * alone rather than failed on a duplicate field.
 *
 * **Additive.** Three nullable fields on `tricks`; no existing field changes
 * shape and no stored value moves. The `down` path removes exactly what `up`
 * adds, and only what it finds.
 */
migrate(
  (app) => {
    const tricks = app.findCollectionByNameOrId('tricks');

    for (const name of ['video_id', 'video_title', 'video_channel']) {
      if (!tricks.fields.getByName(name)) {
        tricks.fields.add(
          new TextField({
            type: 'text',
            name: name,
            required: false,
          }),
        );
      }
    }

    app.save(tricks);
  },

  (app) => {
    const tricks = app.findCollectionByNameOrId('tricks');
    for (const name of ['video_id', 'video_title', 'video_channel']) {
      const field = tricks.fields.getByName(name);
      if (field) tricks.fields.removeById(field.id);
    }
    app.save(tricks);
  },
);
