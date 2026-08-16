/// <reference path="../.pb_data/types.d.ts" />

/**
 * The progress insights panel, in the schema (T9).
 *
 * Two fields, and they answer two different questions that must never be
 * collapsed into one:
 *
 * - **`plans.includes_insights` — may this rider have insights at all?** An
 *   entitlement, resolved from our own plan record like `clip_cap_bytes` and
 *   `unlocks_paid_tricks` before it (plan §2.4), so staff can move it without a
 *   deploy and a missing plan fails closed.
 * - **`users.insights_opt_in` — has this rider asked for them?** The insights
 *   panel is *profiling* under the Children's code (plan §6.4, standard 12), so
 *   it is off by default and opt-in **even on Legend**. Paying for a feature is
 *   not consenting to it.
 *
 * The default is off for riders who already exist as well as for new ones: a
 * `bool` field added to a populated collection reads `false` on every existing
 * row, and nothing here backfills it to anything else. That is deliberate — the
 * one thing this migration must not do is switch profiling on for somebody who
 * never asked.
 *
 * **Additive.** Two new fields and one value written to the Legend plan record.
 * No existing field changes shape, and no stored value moves.
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.fields.add(
      new BoolField({
        type: 'bool',
        name: 'insights_opt_in',
        required: false,
      }),
    );
    app.save(users);

    const plans = app.findCollectionByNameOrId('plans');
    plans.fields.add(
      new BoolField({
        type: 'bool',
        name: 'includes_insights',
        required: false,
      }),
    );
    app.save(plans);

    // Legend is the plan that carries insights (plan §2.4). Seeded databases
    // already hold the three plan records, so the entitlement is written here
    // rather than waiting for the next seed run — otherwise a Legend rider
    // could opt in and be refused by a hook reading a field nobody had set.
    try {
      const legend = app.findFirstRecordByFilter('plans', 'slug = {:slug}', { slug: 'legend' });
      legend.set('includes_insights', true);
      app.save(legend);
    } catch {
      // No plans seeded yet. The seed carries the same value.
    }
  },

  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.fields.removeByName('insights_opt_in');
    app.save(users);

    const plans = app.findCollectionByNameOrId('plans');
    plans.fields.removeByName('includes_insights');
    app.save(plans);
  },
);
