/// <reference path="../.pb_data/types.d.ts" />

/**
 * `users.last_seen` — when a rider last actually used Land The Trick.
 *
 * The staff Riders table has always had a column headed "Last active", and it
 * has always shown `last_ride`: the day a rider tapped "I rode today". Those
 * are different questions, and the gap between them is not small. A rider who
 * opens the app every evening, logs tricks and reads the library, and simply
 * never taps that one button, reads as an account nobody has touched since the
 * day it was made. Support cannot tell a dormant account from a busy one, which
 * is the single thing that column exists to say.
 *
 * **Written by the server, on authentication.** Every server render of an app
 * page re-checks the session against PocketBase (`currentRider` in the web
 * app), so an auth-request hook sees a rider using the site without the browser
 * having to say so — and it is a fact about the session, which is the server's
 * to state. Throttled to 15 minutes in `hooks/lib/landit.js`: `users` is the
 * hottest collection here, and a stamp per page view would be a write per page
 * view for a figure nobody reads to the minute.
 *
 * **Frozen against the account it describes** (`USER_SESSION_FIELDS`, owner
 * grant: lekky, 2026-09-07, in chat). A last-seen stamp a rider can PATCH tells
 * staff whatever that rider would like it to say, which is worse than not
 * having one — a moderator reading it would be reading a claim, not a record.
 *
 * It is a rider fact, so it is inside the same guarantees as the rest: the
 * profile privacy rules cover it, `hooks/lib/erasure.js` clears it when an
 * account is closed, and the data export writes it out. It is never shown to
 * another rider — no profile, public or otherwise, carries it, and there is no
 * "who is online" surface anywhere in this product by design (plan §6.1).
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    users.fields.add(
      new DateField({
        type: 'date',
        name: 'last_seen',
        required: false,
      }),
    );

    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const field = users.fields.getByName('last_seen');
    if (field) users.fields.removeById(field.id);
    app.save(users);
  },
);
