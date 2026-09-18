/// <reference path="../.pb_data/types.d.ts" />

/**
 * `users.stickers_seen_at` — when this rider last looked at their sticker wall.
 *
 * The one field the library shelf adds (Rachid, 2026-09-18, in chat), and it
 * exists because the field next to it cannot do this job.
 * `rider_stickers.seen_at` already records "this award has been announced", but
 * it is stamped by whichever screen announced it — the trick page's toast
 * (`StagePanel`), Home's "Working on it" card, or the wall itself — which in
 * the ordinary path happens seconds after the award, on the screen the rider
 * was already looking at. A flag reading that state would be blank by the time
 * anybody reached `/library`, and would light up only for the awards no toast
 * happened to catch: a control that appears at random is worse than no control.
 *
 * So the flag counts stickers earned since this date, and the wall stamps it
 * when the rider opens it. "New" therefore means *you have not been to look*,
 * not *nobody has told you* — which is the promise a badge on a link to a
 * screen should be making.
 *
 * **One date for the whole rider, not one per sport.** The shelf is scoped to
 * the chip's sport, like Home's card and the wall itself, but the stamp is not:
 * opening the wall clears the flag whatever sport was showing. A rider whose
 * scooter flag survived a trip to their skate wall would be a rider being told
 * about something they have just been shown.
 *
 * **Own-write, pinned empty on create, and deliberately not frozen** — the same
 * shape as `whats_new_seen_at` beside it, for the same reasons, and it is in
 * `hooks/lib/landit.js` on the same terms. The client is the only thing that
 * knows the wall was opened, so freezing it would break the feature; forging it
 * costs its owner a flag and nobody else anything, and `users.updateRule`
 * (`id = @request.auth.id`) is what stops it being set on anyone else.
 *
 * It is a fact held about a rider, so `hooks/lib/erasure.js` clears it when an
 * account closes and writes it into the rider's own export.
 *
 * **The read carries a known problem, and it is not a new one**
 * ([issue #554](https://github.com/lekky/landit/issues/554)): `users.viewRule`
 * hands a `public`-privacy rider's whole record to anyone, so this stamp joins
 * `last_seen` and `whats_new_seen_at` as a "when was this child last on the
 * app" signal on a public profile. PocketBase has no field-level hiding that
 * keeps a field readable by its owner, so the fix belongs to #554 and covers
 * all three at once; this field is a third instance of an existing shape rather
 * than a new one, and the issue has been updated to say so.
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    users.fields.add(
      new DateField({
        type: 'date',
        name: 'stickers_seen_at',
        required: false,
      }),
    );

    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const field = users.fields.getByName('stickers_seen_at');
    if (field) users.fields.removeById(field.id);
    app.save(users);
  },
);
