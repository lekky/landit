/// <reference path="../.pb_data/types.d.ts" />

/**
 * Legend flair, in the schema (T11).
 *
 * One field: `plans.includes_flair`, the entitlement behind the tag beside a
 * rider's name on their profile and on the crew board (plan §2.4). It joins
 * `unlocks_paid_tricks`, `clip_cap_bytes` and `includes_insights` on the same
 * record and for the same three reasons — staff can move the perk without a
 * deploy, a missing plan record fails closed rather than open, and **nothing
 * anywhere compares a plan id to the string `legend`**.
 *
 * That last one is the point of this migration rather than a nicety. T15 owns
 * payments and will drive this field; T11 only renders what it says. If the
 * entitlement lived in the client as `plan === 'legend'`, T15 would have to
 * find every screen that spelled it out.
 *
 * The flair is **cosmetic and stays cosmetic**. Plan §2.4: achievements are
 * never for sale. It may decorate a name; it may never change a score, a stage,
 * a sticker, or a rider's place on a board.
 *
 * **Additive.** One new field and one value written to the Legend plan record.
 * No existing field changes shape and no stored value moves.
 */
migrate(
  (app) => {
    const plans = app.findCollectionByNameOrId('plans');
    plans.fields.add(
      new BoolField({
        type: 'bool',
        name: 'includes_flair',
        required: false,
      }),
    );
    app.save(plans);

    // Seeded databases already hold the three plan records, so the value is
    // written here rather than waiting for the next seed run — otherwise a
    // Legend rider would read as unentitled until somebody reseeded.
    try {
      const legend = app.findFirstRecordByFilter('plans', 'slug = {:slug}', { slug: 'legend' });
      legend.set('includes_flair', true);
      app.save(legend);
    } catch {
      // No plans seeded yet. The seed carries the same value.
    }
  },

  (app) => {
    const plans = app.findCollectionByNameOrId('plans');
    plans.fields.removeByName('includes_flair');
    app.save(plans);
  },
);
