/// <reference path="../.pb_data/types.d.ts" />

/**
 * Crews, per plan — and a crew that nobody is in stops existing.
 *
 * Two owner decisions from 2026-09-17 (Rachid, in chat), both taken while
 * reviewing the shell rethink on a phone:
 *
 *  1. **"1 for free, 3 for 3.99 and 10 for the top tier."** How many crews a
 *     rider may *create*. Creating, not belonging: joining with a code stays
 *     uncapped at every tier. What it limits is minting, because a crew is an
 *     invite-code generator — the anti-spam argument the old flat five carried
 *     alone (`MAX_OWNED_CREWS` in `@landit/core`, now the ceiling no plan
 *     exceeds rather than the number anybody gets).
 *
 *     It is **capacity, not achievement**, which is what keeps it on the right
 *     side of plan §2.4: paid tiers sell room, cosmetics and insight, never a
 *     sticker or a stage.
 *
 *     The number lives on the `plans` record like every other entitlement
 *     (`unlocks_paid_tricks`, `video_link_cap`, `session_month_cap`), so staff
 *     can move it without a deploy and **nothing compares a plan slug to
 *     `shredder` or `legend`** anywhere in the codebase.
 *
 *  2. **"need to delete a crew if the last person leaves too."** The other half
 *     of issue #143, which `85_crews.pb.js` has been carrying an open question
 *     about since: it promotes the longest-standing member when an owner
 *     leaves, and left a crew with nobody in it exactly as it was, saying in as
 *     many words that deleting it outright "is the owner's to decide because
 *     the members would lose a board they did not close". With nobody left
 *     there are no members to lose it, and the owner has now decided.
 *
 *     The hook does the deleting from here on. **This migration clears the ones
 *     already stranded**, which is what the owner hit: five crews, four
 *     memberships, and a cap counting a crew they could not see, open or leave
 *     ("but i only have 4").
 *
 * ---
 *
 * **Why the backfill is here as well as in the seed.** The reason
 * `1787097609_progress_insights.js` gives and every entitlement migration since
 * has repeated: a database that already holds the three plan records would
 * otherwise have a Shredder rider refused by a hook reading a field nobody had
 * set. The seed carries the same numbers from `@landit/core`, which is where
 * they are tunable.
 *
 * **`down` is honest.** It drops the column, which is reversible. It cannot put
 * back the crews deleted above — nothing recorded them — and says so rather
 * than pretending.
 */
migrate(
  (app) => {
    const plans = app.findCollectionByNameOrId('plans');

    plans.fields.add(
      new NumberField({
        type: 'number',
        name: 'crew_cap',
        required: false,
        onlyInt: true,
        min: 0,
      }),
    );

    app.save(plans);

    /**
     * The owner's three numbers. `CREW_CAPS` in
     * `packages/core/src/rules/crew.ts` is the same three, and the seed writes
     * them from there; these exist so an already-seeded database is not left
     * with an entitlement nobody set.
     */
    const caps = [
      { slug: 'rookie', cap: 1 },
      { slug: 'shredder', cap: 3 },
      { slug: 'legend', cap: 10 },
    ];

    for (const grant of caps) {
      try {
        const record = app.findFirstRecordByFilter('plans', 'slug = {:slug}', { slug: grant.slug });
        record.set('crew_cap', grant.cap);
        app.save(record);
      } catch {
        // No plans seeded yet. The seed carries the same values.
      }
    }

    /*
     * The crews nobody is in.
     *
     * A crew is created with its owner's membership row in the same breath, so
     * a crew with no `crew_members` rows is not a state the product makes on
     * purpose: it is what leaving used to leave behind. Each one still counted
     * against its owner's cap while being unreachable from every screen — there
     * is no route to a crew you are not a member of — so this is a cleanup, not
     * a deletion of anything a rider could open.
     *
     * Written as a scan rather than a filter because PocketBase's filter syntax
     * has no "has no related rows": the set is small (crews are counted in
     * hundreds, not millions) and this runs once.
     */
    const crews = app.findRecordsByFilter('crews', 'id != ""', '', 0, 0, {});
    for (const crew of crews) {
      const members = app.findRecordsByFilter('crew_members', 'crew = {:crew}', '', 1, 0, {
        crew: crew.id,
      });
      if (members.length > 0) continue;

      try {
        app.delete(crew);
      } catch (err) {
        // A crew that will not delete is left alone and logged: a migration
        // that dies here would take the column with it.
        $app.logger().error('orphan crew not removed', 'crew', crew.id, 'error', String(err));
      }
    }
  },

  (app) => {
    const plans = app.findCollectionByNameOrId('plans');
    plans.fields.removeByName('crew_cap');
    app.save(plans);
    // The orphaned crews deleted in `up` are not restored: nothing recorded
    // what they were, and a crew nobody is a member of has no rider waiting for
    // it. Said out loud rather than left as a silent asymmetry.
  },
);
