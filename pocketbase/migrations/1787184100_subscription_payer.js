/// <reference path="../.pb_data/types.d.ts" />

/**
 * Who paid, and whether they said they were an adult (T15, plan §6.2).
 *
 * `subscriptions` already carried `source`, `status`, `external_id` and
 * `period_end` — enough to say *that* a rider is entitled. It carried nothing
 * about **who the counterparty was**, and §6.2 makes that a safeguarding fact
 * rather than a billing detail:
 *
 *   "The upgrade flow requires the payer to confirm they are 18 or over; for
 *   riders under 16 it routes to a guardian by email rather than being
 *   purchasable in-app by the child."
 *
 * A rule the server cannot check afterwards is a rule that lived in the client,
 * and the whole of plan §3 is about not doing that. So the two facts are stored
 * on the record the entitlement hangs off:
 *
 * - **`payer_kind`** (`rider` | `guardian`) — which of the two routes this
 *   subscription came down. `pocketbase/hooks/55_subscriptions.pb.js` refuses a
 *   subscription marked `rider` for a rider whose age band is under 16, at the
 *   model layer, on every write path including a superuser one. That refusal is
 *   the enforceable half of "not purchasable in-app by the child": the checkout
 *   route can be edited away and the paywall still holds.
 * - **`payer_adult_confirmed`** — the 18+ confirmation, recorded rather than
 *   merely required. A subscription without it is refused by the same hook,
 *   which is what makes the tick box on the plans page evidence instead of
 *   decoration.
 *
 * **`checkout_ref`** is the third field and it is plumbing, not policy: the
 * Stripe Checkout Session id, so a webhook redelivery finds the row it already
 * wrote instead of creating a second one. Stripe retries on any non-2xx and
 * will happily deliver the same event twice; without a key to match on, a
 * retried `checkout.session.completed` is a duplicate subscription.
 *
 * The unique index on `external_id` is **partial** — `WHERE external_id != ''`.
 * Rows written by staff or by a future Apple/Google source have no Stripe id,
 * and SQLite treats every empty string as equal, so an unconditional unique
 * index would allow exactly one of them to exist.
 *
 * **Additive.** Three new fields and one index. No existing field changes
 * shape, no stored value moves, and every existing row reads
 * `payer_adult_confirmed = false` — which the hook refuses. That is the
 * intended direction: nothing is holding a subscription today (the collection
 * has never had a writer), and a subscription whose payer is unknown is not one
 * this product will honour.
 */
migrate(
  (app) => {
    const subscriptions = app.findCollectionByNameOrId('subscriptions');

    subscriptions.fields.add(
      new SelectField({
        type: 'select',
        name: 'payer_kind',
        required: false,
        maxSelect: 1,
        values: ['rider', 'guardian'],
      }),
    );

    subscriptions.fields.add(
      new BoolField({
        type: 'bool',
        name: 'payer_adult_confirmed',
        required: false,
      }),
    );

    subscriptions.fields.add(
      new TextField({
        type: 'text',
        name: 'checkout_ref',
        required: false,
        max: 255,
      }),
    );

    subscriptions.indexes = subscriptions.indexes.concat([
      "CREATE UNIQUE INDEX `idx_subscriptions_external` ON `subscriptions` (`external_id`) WHERE `external_id` != ''",
      'CREATE INDEX `idx_subscriptions_checkout` ON `subscriptions` (`checkout_ref`)',
    ]);

    app.save(subscriptions);
  },

  (app) => {
    const subscriptions = app.findCollectionByNameOrId('subscriptions');
    subscriptions.indexes = subscriptions.indexes.filter(
      (sql) =>
        sql.indexOf('idx_subscriptions_external') === -1 &&
        sql.indexOf('idx_subscriptions_checkout') === -1,
    );
    subscriptions.fields.removeByName('payer_kind');
    subscriptions.fields.removeByName('payer_adult_confirmed');
    subscriptions.fields.removeByName('checkout_ref');
    app.save(subscriptions);
  },
);
