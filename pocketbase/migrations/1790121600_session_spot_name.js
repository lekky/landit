/// <reference path="../.pb_data/types.d.ts" />

/**
 * A session may name a place that is not on the map.
 *
 * Owner's decision (Rachid, 2026-09-17, in chat, reviewing the shell rethink on
 * a phone): **"need a 'custom' or can't find it and let them type free text,
 * and free text ones obviously don't link to a page after."**
 *
 * `sessions.spot` is a relation, so until now a rider whose local bank, car
 * park or school wall is not in the 36,391 imported spots had nowhere to put
 * it: the form refused to save without a spot, and the only way out was to
 * submit the place as a new spot and wait for it to be approved. That is the
 * right flow for somewhere other riders should find, and far too much
 * ceremony for "behind the leisure centre".
 *
 * ---
 *
 * **One field, and deliberately a dumb one.** `spot_name` is text a rider
 * typed. It is not a soft reference, it is not matched back against `spots`,
 * and nothing renders it as a link — a session either has a `spot` (a real
 * place with a page) or a name (words on a card). The hook clears it whenever a
 * real spot is chosen, so a session cannot carry two answers to "where".
 *
 * **What it is not allowed to become.** It is the first rider-typed text in
 * this flow, so it is held to the same line crew names are:
 *
 * - length-capped (80, `SESSION_LIMITS.spotNameMax`) and refused if it carries
 *   a line break or a control character — a name with a newline in it can
 *   pretend to be two rows of a list;
 * - **never in analytics**, which carry catalogue facts only (§5);
 * - **never in the crew feed or What's new**, which are sentences the product
 *   wrote — `crewActivityLine` says "logged a session" and names no place, and
 *   the rethink's §3.6 is explicit that nothing a rider typed appears there.
 *   Nothing in this migration changes that, and nothing may.
 *
 * It rides on the session's own visibility, exactly as `notes` and `aim` do:
 * a private session's typed place is as private as its notes.
 *
 * **Additive.** One optional field on one collection. No rule, index or stored
 * value moves, and `down` removes exactly what `up` adds.
 */
migrate(
  (app) => {
    const sessions = app.findCollectionByNameOrId('sessions');

    sessions.fields.add(
      new TextField({
        type: 'text',
        name: 'spot_name',
        required: false,
        max: 80,
      }),
    );

    app.save(sessions);
  },

  (app) => {
    const sessions = app.findCollectionByNameOrId('sessions');
    sessions.fields.removeByName('spot_name');
    app.save(sessions);
  },
);
