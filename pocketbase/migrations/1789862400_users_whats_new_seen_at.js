/// <reference path="../.pb_data/types.d.ts" />

/**
 * `users.whats_new_seen_at` — when this rider last read What's new.
 *
 * The one field the app-shell rethink adds (`docs/app-shell-rethink.md` §6),
 * and the whole of what What's new stores. Everything on that screen is
 * *derived* at read time from rows the rider can already read — stickers they
 * earned, events they said yes to, the challenge's deadline, their streak
 * tuple, joins to their crews — and the unseen count is simply the number of
 * those lines that are newer than this date.
 *
 * **One date, not a row per item, and that is a decision rather than a saving.**
 * A notifications collection would be a second copy of facts the product
 * already holds, which then has to be kept in step with them; it would grow
 * without bound for a rider who never opens the bell; and it would be the
 * natural place for somebody, later, to put a line one rider wrote for another.
 * There is no such place here. Plan §6.1's "no algorithmic feed" and "no
 * rider-to-rider messaging" are easier to keep true of a screen with nothing
 * behind it.
 *
 * **Own-write, and deliberately not frozen.** `last_seen` next door is written
 * by the server and refused to the account it describes, because staff read it
 * as a record. This is the opposite: it is a rider's own bookmark in their own
 * news, it grants nothing, and forging it costs its owner a badge and nobody
 * else anything. So it is absent from every list in `hooks/lib/landit.js`, and
 * `users.updateRule` (`id = @request.auth.id`) is what stops a rider setting it
 * on anyone else — which `pocketbase/tests/whats-new-seen.test.ts` asserts over
 * HTTP rather than by reading the guard's source.
 *
 * It is a fact held about a rider, so it is inside the same guarantees as the
 * rest: `hooks/lib/erasure.js` clears it when an account is closed and writes
 * it into the rider's own data export.
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    users.fields.add(
      new DateField({
        type: 'date',
        name: 'whats_new_seen_at',
        required: false,
      }),
    );

    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const field = users.fields.getByName('whats_new_seen_at');
    if (field) users.fields.removeById(field.id);
    app.save(users);
  },
);
