/// <reference path="../.pb_data/types.d.ts" />

/**
 * `tricks.video_thumb` — a real preview frame for the tutorial poster, stored
 * here rather than fetched from YouTube (Rachid, 2026-09-13, in chat).
 *
 * **The whole point is where the image is served from.** The obvious poster is
 * `i.ytimg.com/vi/<id>/mqdefault.jpg`, and `VideoEmbed` refuses it on purpose:
 * that is a request to a Google host from a child's page on load, which is
 * exactly what the click-to-play gate exists to prevent. Plan §6.8 runs Land
 * The Trick with **no consent banner** — no cookies, self-hosted fonts, nothing
 * cross-site — and a page-load ping to Google would put one back on the
 * roadmap. `e2e/video-links.spec.ts` fails on any request to a Google host
 * before the press, and names `ytimg` explicitly.
 *
 * Fetching the same image **once, server-side, into this column** gets the
 * preview without the request: what a rider's browser asks for is our own
 * PocketBase, which it is already talking to. The test keeps passing because it
 * is true, not because it was worked around.
 *
 * **Why on the record and not in the repo.** Committing the JPEGs to
 * `apps/web/public/` would work and would be simpler, but a thumbnail would
 * then only appear after somebody re-ran a script *and deployed*. Staff can
 * change a tutorial link from the portal at any time; a preview that lags a
 * deploy behind the video it previews is a preview of the wrong video. On the
 * record, `pnpm --filter @landit/db video:thumbs` fills any that are missing
 * and the next run picks up whatever staff changed.
 *
 * **Absent is the normal state and renders fine.** No thumbnail means the drawn
 * poster from `VideoEmbed` — the hard-shadowed ink panel that every video has
 * shown until now. That is the fallback for a fetch that failed, a video added
 * a minute ago, and a database that never runs the script at all.
 *
 * **Not `protected`.** The trick page renders signed out (T35), so the poster
 * has to load for a visitor who arrived from a search. A protected file needs a
 * token and would show a broken image to exactly the reader it is for. Access
 * still follows the `tricks` view rule, which is public for live tricks.
 *
 * **Additive, and safe to run twice.** One nullable field; no existing field
 * changes shape. 512KB and the two image types are a ceiling on what the
 * fetcher may store, not a target — `mqdefault.jpg` is around 15KB.
 */
migrate(
  (app) => {
    const tricks = app.findCollectionByNameOrId('tricks');

    if (!tricks.fields.getByName('video_thumb')) {
      tricks.fields.add(
        new FileField({
          type: 'file',
          name: 'video_thumb',
          required: false,
          maxSelect: 1,
          maxSize: 524288,
          mimeTypes: ['image/jpeg', 'image/webp'],
          protected: false,
        }),
      );
    }

    app.save(tricks);
  },

  (app) => {
    const tricks = app.findCollectionByNameOrId('tricks');
    const field = tricks.fields.getByName('video_thumb');
    if (field) tricks.fields.removeById(field.id);
    app.save(tricks);
  },
);
