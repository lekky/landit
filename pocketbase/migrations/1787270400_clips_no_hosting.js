/// <reference path="../.pb_data/types.d.ts" />

/**
 * Land The Trick stops hosting rider video (plan §1, §6.6, §3 guarantee 2).
 *
 * **Authorised by the owner: Rachid, 2026-08-17, in chat.** This is a
 * *breaking* change to a collection that shipped in
 * `1786838400_init_collections.js`, which `CLAUDE.md` rule 5 forbids a session
 * to make on its own. That grant is the only thing that permits it, and it is
 * recorded here with the name and the date because rule 5 says a grant without
 * both is not authority. The decision it reverses is the R2/2GB/5GB clip vault
 * in plan §1; the replacement — riders pasting a YouTube link, with per-video
 * visibility on the same `public | members | private` model as profile privacy
 * — is `t15b-video-links` and is deliberately **not** built here.
 *
 * **What goes, and why these three fields.**
 *
 * - **`file`** — the whole point. It is a `protected` file field with a 200MB
 *   limit and a video mime allowlist, and while it exists this product can host
 *   video whether or not any screen offers to. Guarantee 2 was written about
 *   this field; removing it is what makes "we do not host video" a property of
 *   the schema rather than a claim about the UI.
 * - **`size`** — bytes of a file there is no longer any of. It existed to be
 *   summed against `plans.clip_cap_bytes` by a hook that this PR deletes.
 * - **`kind`** (`video` | `photo`) — which of two upload types the bytes were.
 *   A link has no such distinction.
 *
 * **What stays, and why the collection is not dropped.** `user`, `trick`, `at`
 * and the `idx_clips_user` index are the row-per-video skeleton the link
 * feature fills in, and five things still read this collection: the sticker
 * award hook (`30_stickers.pb.js` awards on `clips` writes), `riderSnapshot` in
 * `@landit/db`, the staff rider sheet's count, and the `reports` collection's
 * `clip` subject. Dropping the table would break all of them to save nothing —
 * the hosting surface is the file field, and that is what leaves.
 *
 * **`createRule` becomes `null`.** With no file, a rider could otherwise POST
 * an empty row — and `first-clip` ("Caught On Cam") is a sticker awarded on
 * `clips` create, so an empty POST would *earn an achievement*. Plan §1 says
 * achievements are never for sale, and one obtainable by a contentless request
 * is worse than one for sale. Closing create to everything but server code is
 * the smallest change that holds that line; `t15b` reopens it alongside the
 * `url` and `visibility` fields, with its own rule. The sticker itself is set
 * `isLive: false` in `@landit/core` in the same PR rather than deleted, so the
 * wall stops advertising an achievement nobody can earn.
 *
 * `listRule`, `viewRule` and `deleteRule` are left owner-only as they were: a
 * rider can still read and delete their own rows, which is the correct
 * behaviour for rows they own and the correct starting point for `t15b`.
 *
 * **No stored data is destroyed in practice.** Land The Trick has never been live and
 * the collection has no rows outside local development. The down path below
 * restores the three fields and the create rule, but PocketBase cannot restore
 * the *bytes* a file field pointed at — so this migration is reversible in
 * shape and not in content. That is stated rather than hidden.
 */
migrate(
  (app) => {
    const clips = app.findCollectionByNameOrId('clips');

    clips.fields.removeByName('file');
    clips.fields.removeByName('size');
    clips.fields.removeByName('kind');

    // Server code only. See the note above: an empty rider-created row would
    // award the `first-clip` sticker for nothing.
    clips.createRule = null;

    app.save(clips);
  },

  (app) => {
    const clips = app.findCollectionByNameOrId('clips');

    clips.fields.add(
      new FileField({
        type: 'file',
        name: 'file',
        maxSelect: 1,
        maxSize: 209715200,
        protected: true,
        mimeTypes: ['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png'],
      }),
    );

    clips.fields.add(
      new SelectField({
        type: 'select',
        name: 'kind',
        required: false,
        maxSelect: 1,
        values: ['video', 'photo'],
      }),
    );

    clips.fields.add(
      new NumberField({
        type: 'number',
        name: 'size',
        required: false,
        onlyInt: true,
        min: 0,
      }),
    );

    // Verbatim what `1786838400_init_collections.js` builds as
    // `OWN_AND_CONSENTED`: own row, and not held behind the consent gate.
    clips.createRule =
      "user = @request.auth.id && @request.auth.id != '' && " +
      "@request.auth.consent_state != 'pending' && @request.auth.consent_state != 'revoked'";

    app.save(clips);
  },
);
