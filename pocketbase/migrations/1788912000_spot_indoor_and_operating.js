/// <reference path="../.pb_data/types.d.ts" />

/**
 * Whether a spot is under a roof, and whether it is still there
 * (2026-09-07, owner in chat).
 *
 * Two facts a rider needs before they travel, and neither could be stored. The
 * card said what a park *is* — its type, its features — and nothing about the
 * two things that decide whether the journey is worth making: a park with no
 * roof is no use in a British February, and a park that has been demolished is
 * no use in any month.
 *
 * **`operating` is not `status`, and the difference is the whole point.**
 * `status` is the moderation state — pending, live, rejected — which says
 * whether staff have let a record onto the map. `operating` says whether the
 * place exists. A row can be perfectly `live` and the park flattened, which is
 * the defect issue #326 records against Addis Skatepark: seeded live, removed
 * by its own builder in February 2026. Collapsing the two would mean expressing
 * a closure by hiding the listing, and a rider who has ridden there for years is
 * better served by being told it has gone than by watching it silently vanish.
 *
 * **`unknown` is the default, and it is the common case, not a gap to fill in
 * later.** Almost no source records closure. OpenStreetMap deletes or retags a
 * park rather than marking it shut, so every OSM-derived row is honestly
 * `unknown` and can never be better. A reader must treat absent and `'unknown'`
 * identically and say nothing at all, rather than let a missing value imply the
 * park is open — the failure direction that sends a child to a building site.
 *
 * **`indoor` is a flag, not a re-reading of `type`.** 'Indoor park' is one of
 * the three categories a human picks on the submission form, and it does not
 * answer the question: several concrete parks are partly covered, and more than
 * one 'Indoor park' is a warehouse with a side open to the weather. The flag
 * says what the category cannot.
 *
 * **Additive.** Two nullable fields on `spots`. No existing field changes shape,
 * no stored value moves, and every row already in the collection reads empty for
 * both — which is the honest state for a park nobody has checked. The `down`
 * path removes exactly what `up` adds.
 */
migrate(
  (app) => {
    const spots = app.findCollectionByNameOrId('spots');

    /*
     * A bool has no null in PocketBase, so this column reads false for every
     * row that has not been marked — and false therefore means "not known to
     * be indoor", never "checked, and it is outdoors". Readers must show a
     * roof only on true and say nothing at all on false, because the negative
     * here is an absence of knowledge wearing the shape of an answer. Where a
     * park's cover genuinely matters and is genuinely unknown, `operating`'s
     * three-way shape is the pattern to copy, not this one.
     */
    spots.fields.add(
      new BoolField({
        type: 'bool',
        name: 'indoor',
        required: false,
      }),
    );

    /*
     * `required: false` so the ~350 rows already seeded stay saveable and read
     * as unknown. 'unknown' is still an explicit value because a staff member
     * who has *checked* and found no answer is saying something a blank cannot:
     * that the question was asked.
     */
    spots.fields.add(
      new SelectField({
        type: 'select',
        name: 'operating',
        required: false,
        maxSelect: 1,
        values: ['open', 'closed', 'unknown'],
      }),
    );

    app.save(spots);
  },

  (app) => {
    const spots = app.findCollectionByNameOrId('spots');
    spots.fields.removeByName('indoor');
    spots.fields.removeByName('operating');
    app.save(spots);
  },
);
