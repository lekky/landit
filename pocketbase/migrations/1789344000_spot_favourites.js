/// <reference path="../.pb_data/types.d.ts" />

/**
 * `spot_favourites` — the handful of places a rider actually rides.
 *
 * `/spots` opens on the whole world. After the France census and the world
 * import that is tens of thousands of rows, and a rider's fiftieth visit costs
 * them exactly what their first did: a search box and a town name. This is the
 * shortcut — a spot a rider has marked, listed back to them, and removable.
 *
 * **The shape is `event_attendance`'s, deliberately.** Two relations, a
 * `created`, a unique pair index, and no payload of its own. A favourite is a
 * fact about a rider and a spot and nothing else; there is no note field and no
 * rating, because both would be a rider's typing and neither has a reader.
 *
 * Four things about the rules below.
 *
 *  1. **Every rule is `OWN`.** A rider lists, views, creates and deletes their
 *     own rows and nobody else's — not staff in the portal, not another rider,
 *     not a crew. On create the rule reads `user` as *submitted*, so a body
 *     naming somebody else is refused outright rather than quietly rewritten.
 *     There is no count on a spot page ("12 riders faved this") and
 *     there is no path to one: a public tally over this collection would turn a
 *     public place into a signal about which children are at it, which is the
 *     stranger-contact surface plan §6.1 does not have.
 *  2. **`updateRule` is `null`**, because there is nothing to update. A
 *     favourite is created or deleted; a row that can only be made and unmade
 *     needs no edit door, and an open one is a door to check.
 *  3. **It does not test `consent_state`**, where `event_attendance` — the
 *     collection this is otherwise a copy of — uses `OWN_AND_CONSENTED`. That
 *     is a deliberate divergence, on the reasoning `suggestions` was built
 *     with: the guardian-consent gate exists to stop a child reaching *other
 *     riders* (plan §3, guarantee 4), and a favourite reaches nobody. Going to
 *     an event is a child telling us they will be at a place at a time, which
 *     is why that one is gated; bookmarking a park is a note to self. A rider
 *     waiting on a guardian can still mark the park at the end of their road.
 *  4. **Both relations `cascadeDelete`.** On the `user` side that is the
 *     erasure promise `/legal` makes — closing an account takes the favourites
 *     with it, and `hooks/lib/erasure.js` lists this collection so the sweep
 *     and the data export both know about it. On the `spot` side it is
 *     housekeeping: a spot staff delete should not leave rows pointing at
 *     nothing for the list to filter out forever.
 *
 * **No plan gate.** Favourites are free on every plan (owner decision,
 * 2026-09-13, in chat). The paywall in this product is over trick *content*;
 * a spot is a public place, `/spots` is readable signed out, and putting a
 * bookmark of one behind Shredder would be the first paywall over something
 * public. The only ceiling is the flood cap in `64_spot_favourites.pb.js`,
 * which is a rate limit rather than an entitlement.
 */
migrate(
  (app) => {
    // A signed-in rider's own row. The same clause `event_attendance` and
    // `announcement_dismissals` carry, spelled out here rather than imported:
    // migrations run in PocketBase's JSVM, which has no module resolution for
    // the workspace, so every migration defines its own helpers.
    const OWN = `@request.auth.id != '' && user = @request.auth.id`;

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

    app.save(
      new Collection({
        type: 'base',
        name: 'spot_favourites',
        listRule: OWN,
        viewRule: OWN,
        createRule: OWN,
        updateRule: null,
        deleteRule: OWN,
        fields: [
          rel('user', 'users', { required: true, cascadeDelete: true }),
          rel('spot', 'spots', { required: true, cascadeDelete: true }),
          created(),
        ],
        indexes: [
          /*
           * The unique pair is the idempotency. Two taps, two tabs, or a
           * retried request cannot make a rider hold the same spot twice — the
           * database refuses the second rather than the screen remembering to.
           */
          'CREATE UNIQUE INDEX `idx_spot_favourites_pair` ON `spot_favourites` (`user`, `spot`)',
          /*
           * The read this collection exists for: "every favourite of mine,
           * newest first". Without it that is a scan of everybody's.
           */
          'CREATE INDEX `idx_spot_favourites_user` ON `spot_favourites` (`user`, `created`)',
        ],
      }),
    );
  },

  (app) => {
    app.delete(app.findCollectionByNameOrId('spot_favourites'));
  },
);
