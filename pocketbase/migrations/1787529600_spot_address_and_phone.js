/// <reference path="../.pb_data/types.d.ts" />

/**
 * A spot's address, phone and country (2026-08-18, owner in chat).
 *
 * The spot card carried a name, a town and a type. That was enough while the
 * seven seeded spots were English and half of them were invented for the design
 * prototype; it stops being enough the moment the list is real and worldwide.
 * A rider deciding whether they can get to a park wants the street it is on, and
 * a parent ringing ahead to ask about a scooter session wants the number.
 *
 * **Three text fields, all optional, and the optionality is the design.** A
 * commercial indoor park has all three. A council-built concrete park usually
 * has an address and no phone of its own. A street spot often has neither — it
 * is a plaza with a name riders gave it. And a spot a *rider* submits has only
 * what the submission form asks for, which is none of these. Every reader must
 * therefore treat all three as absent-by-default, and the card renders each line
 * only when it has one rather than printing an empty label (`SpotsScreen.tsx`).
 * A required field here would make every existing row unsaveable and would push
 * the seed into inventing values, which is exactly what the research these
 * fields exist for was told never to do.
 *
 * **Why `country` is a field and not the end of `town`.** Writing "Liverpool,
 * UK" into `town` would have needed no migration, and it was the wrong trade
 * twice over: the seed's natural key is `name` + `town` (`packages/db/src/seed.ts`),
 * so rewriting the town of a spot already in a live database inserts a second
 * copy of it rather than updating the one that is there, and a country folded
 * into a town string cannot later be filtered, grouped or counted without
 * parsing it back out. One fact, one column.
 *
 * **Additive.** Three nullable fields on `spots`. No existing field changes
 * shape, no stored value moves, and every row already in the collection reads
 * empty for all three — which is the honest state for a spot nobody has
 * researched. The `down` path removes exactly what `up` adds.
 */
migrate(
  (app) => {
    const spots = app.findCollectionByNameOrId('spots');

    // Long enough for a full international postal address on one line —
    // "Ariake Urban Sports Park, 1-chome Ariake, Koto City, Tokyo 135-0063,
    // Japan" is 74 — with room for the longer German and Brazilian forms.
    spots.fields.add(
      new TextField({
        type: 'text',
        name: 'address',
        required: false,
        max: 200,
      }),
    );

    /*
     * Stored as the venue publishes it, in international format, and never
     * parsed. A number is for a human to ring: normalising it would mean
     * choosing a canonical form for every country's conventions, and getting
     * that wrong turns a working number into a broken one silently.
     */
    spots.fields.add(
      new TextField({
        type: 'text',
        name: 'phone',
        required: false,
        max: 40,
      }),
    );

    // The country's common English name ("USA", "New Zealand"), not an ISO
    // code: it is displayed on the card as-is, and a code would need a lookup
    // table in `core` that nothing else would use.
    spots.fields.add(
      new TextField({
        type: 'text',
        name: 'country',
        required: false,
        max: 60,
      }),
    );

    app.save(spots);
  },

  (app) => {
    const spots = app.findCollectionByNameOrId('spots');
    spots.fields.removeByName('address');
    spots.fields.removeByName('phone');
    spots.fields.removeByName('country');
    app.save(spots);
  },
);
