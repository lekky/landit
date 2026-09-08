/// <reference path="../.pb_data/types.d.ts" />

/**
 * `spots.source` and `spots.licence` — where a row came from, and on what
 * terms (Rachid, 2026-09-07, in chat: recorded per row, kept internal, never
 * shown on the public spot page).
 *
 * **Why now.** Until this migration every spot was one of two things: a place a
 * session researched by hand from a venue's own page, a council listing or
 * OpenStreetMap, or a place a rider put forward. The France import (issue #362)
 * adds a third — thousands of rows mapped by machine from a government census,
 * under a licence that asks for attribution and nothing else — and a database
 * that cannot tell those apart cannot answer the questions that follow: which
 * rows carry OpenStreetMap's share-alike terms, which need a credit line, and
 * which were never checked by a human at all.
 *
 * **Two short text fields, both optional, and the vocabulary lives in
 * `packages/core/src/data/spot-sources.ts`**, not in a `select` here: a select
 * would need a migration every time a country's dataset is added, and the
 * catalogue in core is what the credit line under the map is rendered from, so
 * the two can never disagree about what a source is called.
 *
 * **The backfill is the honest part.** Every row already in the collection was
 * either researched by a session (`source = 'researched'`; those rows were
 * cross-checked against OpenStreetMap, so they carry its Open Database Licence)
 * or submitted by a rider (`source = 'rider'`, no licence — the rider's own
 * words, held under our terms). `submitted_by` is what tells them apart. From
 * here on the request hook in `62_spots.pb.js` stamps every rider submission
 * 'rider' whatever the request body said, so a rider cannot label their own
 * submission as an import; the seed writes the two fields for everything else.
 *
 * **Additive.** Two nullable fields on `spots` and a value written to rows that
 * already exist. No existing field changes shape and no stored value moves.
 * The `down` path removes exactly what `up` adds.
 */
migrate(
  (app) => {
    const spots = app.findCollectionByNameOrId('spots');

    // A short identifier from the catalogue — 'researched', 'rider',
    // 'fr-sports-gouv' — never a URL or a sentence. Forty characters is room
    // for a dataset name with a country prefix and nothing more.
    spots.fields.add(
      new TextField({
        type: 'text',
        name: 'source',
        required: false,
        max: 40,
      }),
    );

    // An SPDX-style licence identifier — 'ODbL-1.0', 'etalab-2.0',
    // 'CC-BY-4.0' — so a future filter for share-alike rows is a string match.
    spots.fields.add(
      new TextField({
        type: 'text',
        name: 'licence',
        required: false,
        max: 40,
      }),
    );

    app.save(spots);

    /*
     * Every existing row. A `try` around the pass because a fresh database has
     * no rows at all, and the seed that follows writes both fields itself.
     */
    try {
      const rows = app.findRecordsByFilter('spots', "id != ''", 'created,id', 0, 0);
      for (const row of rows) {
        if (row.getString('source')) continue;
        const byRider = row.getString('submitted_by') !== '';
        row.set('source', byRider ? 'rider' : 'researched');
        row.set('licence', byRider ? '' : 'ODbL-1.0');
        app.save(row);
      }
    } catch {
      // Nothing to backfill.
    }
  },

  (app) => {
    const spots = app.findCollectionByNameOrId('spots');
    spots.fields.removeByName('source');
    spots.fields.removeByName('licence');
    app.save(spots);
  },
);
