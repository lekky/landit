/// <reference path="../.pb_data/types.d.ts" />

/**
 * `suggestions` — a rider telling us what to build, and what we are missing.
 *
 * **A collection of its own rather than a sixth `reports.subject_type`**, and
 * the reason is a safety one rather than a filing one. `reports` is the Online
 * Safety Act route: it is rate-limited at 5 an hour and 20 open, it lands in a
 * queue staff have promised to answer within one working day, and every one of
 * its reasons is harm-shaped. Putting ideas through it would spend that budget
 * on them — a rider who sent five trick suggestions in an afternoon could not
 * then report a child in danger — and would leave a moderator reading past
 * "please add the Bri Flip" to find the thing they are actually looking for.
 *
 * Four things about the rules below.
 *
 *  1. **`createRule` requires a signed-in rider**, where `reports.createRule` is
 *     the empty string. The open create rule on reports is a legal duty and
 *     carries a hook full of machinery to stop it being a hole; a suggestion box
 *     has no such duty, and an open one is a spam target with a person at the
 *     end of it (owner decision, 2026-09-12, in chat).
 *  2. **It does not test `consent_state`.** A rider waiting on a guardian's
 *     approval can still tell us the library is missing a trick — the consent
 *     gate exists to stop a child reaching *other riders* (plan §3 guarantee 4),
 *     and a suggestion reaches nobody but us.
 *  3. **Reads are the rider's own rows only**, same as reports. There is no
 *     public idea board, no voting and no "top requests" page: every one of
 *     those renders one rider's typing to another, which is the stranger-contact
 *     surface plan §6.1 does not have.
 *  4. **`status` and `note` are staff's**, so `updateRule` is null and the hook
 *     pins both on create. `note` is what staff wrote about an idea and is read
 *     back by the rider who sent it; it is not a reply channel.
 */
migrate(
  (app) => {
    const text = (name, opts) =>
      Object.assign({ type: 'text', name, required: false, min: 0, max: 0 }, opts || {});
    const select = (name, values, opts) =>
      Object.assign({ type: 'select', name, values, maxSelect: 1, required: false }, opts || {});
    const rel = (name, target, opts) =>
      Object.assign(
        {
          type: 'relation',
          name,
          collectionId: app.findCollectionByNameOrId(target).id,
          cascadeDelete: false,
          minSelect: 0,
          maxSelect: 1,
          required: false,
        },
        opts || {},
      );
    const created = () => ({ type: 'autodate', name: 'created', onCreate: true, onUpdate: false });
    const updated = () => ({ type: 'autodate', name: 'updated', onCreate: true, onUpdate: true });

    app.save(
      new Collection({
        type: 'base',
        name: 'suggestions',
        listRule: `@request.auth.id != '' && rider = @request.auth.id`,
        viewRule: `@request.auth.id != '' && rider = @request.auth.id`,
        createRule: `@request.auth.id != ''`,
        updateRule: null,
        deleteRule: null,
        fields: [
          rel('rider', 'users'),
          select('topic', ['trick', 'feature', 'event', 'bug', 'other'], { required: true }),
          text('detail', { max: 1000 }),
          select('status', ['new', 'reviewing', 'accepted', 'declined']),
          /** What staff made of it. Written by them, read back by whoever sent it. */
          text('note', { max: 600 }),
          created(),
          updated(),
        ],
        indexes: ['CREATE INDEX `idx_suggestions_status` ON `suggestions` (`status`)'],
      }),
    );
  },

  (app) => {
    app.delete(app.findCollectionByNameOrId('suggestions'));
  },
);
