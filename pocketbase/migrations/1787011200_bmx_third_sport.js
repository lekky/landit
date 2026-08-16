/// <reference path="../.pb_data/types.d.ts" />

/**
 * BMX, in the schema (T21, issue #17).
 *
 * Every fixed-option sport field shipped with a two-sport list, because there
 * were two sports. `SPORT_IDS` in `@landit/core` now has three (plan §1), and
 * until these match, the first BMX record fails with a bare 400 — the seed's
 * `assertSportsAccepted` preflight exists to name this, and this migration is
 * what it asks for.
 *
 * **Additive.** Adding a value to a `select` widens what is accepted and
 * changes nothing about what already exists: no stored value moves, and no
 * record becomes invalid. Same for raising `maxSelect`.
 *
 * `maxSelect` matters as much as `values` here and is easier to miss. The
 * multi-select fields were capped at 2 — the number of sports, not a product
 * rule — so a rider who rides all three could pick the sports but not save
 * them, and a spot open to all three could not say so. The cap moves with the
 * list.
 */
migrate(
  (app) => {
    const SPORTS = ['scooter', 'skate', 'bmx'];

    // Every fixed-option sport field in the schema. `multi` fields also get
    // their cap raised; single-select ones stay at one.
    const TARGETS = [
      { collection: 'users', field: 'sports', multi: true },
      { collection: 'tricks', field: 'sport', multi: false },
      { collection: 'stickers', field: 'sport', multi: false },
      { collection: 'challenges', field: 'sport', multi: false },
      { collection: 'spots', field: 'sports', multi: true },
      { collection: 'events', field: 'sports', multi: true },
      { collection: 'announcements', field: 'audience_sport', multi: false },
    ];

    for (const target of TARGETS) {
      const collection = app.findCollectionByNameOrId(target.collection);
      const field = collection.fields.getByName(target.field);
      if (!field) {
        throw new Error(`${target.collection}.${target.field} is missing`);
      }
      field.values = SPORTS;
      if (target.multi) field.maxSelect = SPORTS.length;
      app.save(collection);
    }
  },

  (app) => {
    const SPORTS = ['scooter', 'skate'];
    const TARGETS = [
      { collection: 'users', field: 'sports', multi: true },
      { collection: 'tricks', field: 'sport', multi: false },
      { collection: 'stickers', field: 'sport', multi: false },
      { collection: 'challenges', field: 'sport', multi: false },
      { collection: 'spots', field: 'sports', multi: true },
      { collection: 'events', field: 'sports', multi: true },
      { collection: 'announcements', field: 'audience_sport', multi: false },
    ];

    for (const target of TARGETS) {
      const collection = app.findCollectionByNameOrId(target.collection);
      const field = collection.fields.getByName(target.field);
      if (!field) continue;
      field.values = SPORTS;
      if (target.multi) field.maxSelect = SPORTS.length;
      app.save(collection);
    }
  },
);
