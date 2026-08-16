/// <reference path="../.pb_data/types.d.ts" />

/**
 * The weekly streak, as fields (issues #8 and #9).
 *
 * `users` shipped in the init migration with a daily streak: one counter and
 * `last_ride`. The streak became a **weekly target** on 2026-08-16 (plan §1),
 * and a weekly target cannot be reconstructed from those two columns — the
 * count has to know how far into *this* week the rider is, and which week last
 * qualified. `WeeklyStreakState` in `@landit/core` names the four facts it
 * needs; three of them had nowhere to live. That is issue #9.
 *
 * Additive-only exception granted by the owner (lekky) in chat on 2026-08-16,
 * covering issues #8 and #9 together — recorded in `docs/implementation-plan.md`
 * §7. The additions here are new fields; the *behaviour* change that needed the
 * grant is in `hooks/lib/landit.js`, where the whole streak tuple becomes
 * server-owned (issue #8).
 *
 * Two day keys are stored as `text`, not `date`, and that is deliberate. A
 * `DayKey` is a calendar day in the *rider's* timezone (`YYYY-MM-DD`); putting
 * it in a datetime column would re-introduce the UTC drift the type exists to
 * avoid — the Monday that opens a week in Auckland is not the Monday that opens
 * it in London, and a date column would silently pick one. `last_ride` stays a
 * `date` because it is an instant, and every reader passes it through
 * `toDayKey` with the rider's zone.
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    // A `YYYY-MM-DD` day key, or empty for "never".
    const DAY_KEY = '^\\d{4}-\\d{2}-\\d{2}$';

    users.fields.add(
      new TextField({
        type: 'text',
        name: 'week_start',
        max: 10,
        pattern: DAY_KEY,
        required: false,
      }),
    );
    users.fields.add(
      new NumberField({
        type: 'number',
        name: 'rides_this_week',
        onlyInt: true,
        min: 0,
        required: false,
      }),
    );
    users.fields.add(
      new TextField({
        type: 'text',
        name: 'last_qualifying_week',
        max: 10,
        pattern: DAY_KEY,
        required: false,
      }),
    );

    app.save(users);
  },

  (app) => {
    const users = app.findCollectionByNameOrId('users');
    for (const name of ['week_start', 'rides_this_week', 'last_qualifying_week']) {
      users.fields.removeByName(name);
    }
    app.save(users);
  },
);
