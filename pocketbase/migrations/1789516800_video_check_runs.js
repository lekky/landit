/// <reference path="../.pb_data/types.d.ts" />

/**
 * `video_check_runs` — what the nightly tutorial check did, each night.
 *
 * The check (#463) switches off a curated tutorial that has been deleted or
 * made private, and puts back one that has returned. Until now it said so only
 * in two places a person has to already be looking at: `tricks.video_off_reason`
 * on the trick itself, and whatever scrollback the scheduler kept. Neither
 * answers the question staff actually have, which is **"what has this job been
 * doing?"** — so this collection is its history, and the Video checks tab reads
 * it (Rachid, 2026-09-13, in chat).
 *
 * **A row per run, not a row per change**, and that is the whole design
 * decision. A per-change history is silent on a healthy night, which makes
 * "nothing was switched off" and "the job has not run since August" look
 * identical — and the second is the failure this page exists to catch. A row
 * every night, mostly saying it changed nothing, is what makes the gap visible.
 *
 * `changes` carries the detail as JSON rather than as its own collection. It is
 * written once, read as a whole, and never queried across — a relation would
 * buy a join and cost a second collection to keep in step. Each entry is
 * `{ slug, name, videoId, action, reason }`.
 *
 * **Nothing here is a rider's.** No rule is set, so every rule is null and the
 * collection is superuser-only, which is how the staff portal already reads
 * everything on its own screens. There is no rider-facing view of this and it
 * carries no rider data — only catalogue facts about videos and why one went
 * away.
 *
 * **Additive.** One new collection; no existing collection is touched.
 */
migrate(
  (app) => {
    const number = (name) => ({ type: 'number', name, onlyInt: true, required: false });

    app.save(
      new Collection({
        type: 'base',
        name: 'video_check_runs',

        // Staff-only, by way of being nobody's: the portal reads it with the
        // superuser client, and no rider request can reach it at all.
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,

        fields: [
          /** How many curated tutorials the run asked YouTube about. */
          number('checked'),
          /** How many it switched off. */
          number('hidden'),
          /** How many it put back after an earlier run switched them off. */
          number('restored'),
          /**
           * The detail behind those counts: `{ slug, name, videoId, action,
           * reason }` per change, in the order the run made them. Empty on the
           * ordinary night, which is the point of writing the row anyway.
           */
          { type: 'json', name: 'changes', maxSize: 0, required: false },
          /**
           * Set when the run could not finish its job — a quota refusal, a
           * batch YouTube would not answer. A run that recorded nothing at all
           * is a run that never got this far, and the scheduler is where that
           * shows.
           */
          { type: 'text', name: 'note', required: false, min: 0, max: 500 },
          { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
        ],

        // The page reads newest first and reads nothing else, so this is the
        // only index it wants.
        indexes: ['CREATE INDEX `idx_video_check_runs_created` ON `video_check_runs` (`created`)'],
      }),
    );
  },

  (app) => {
    app.delete(app.findCollectionByNameOrId('video_check_runs'));
  },
);
