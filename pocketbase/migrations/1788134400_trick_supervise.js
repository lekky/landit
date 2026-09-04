/// <reference path="../.pb_data/types.d.ts" />

/**
 * `tricks.supervise` — the guardian supervise list gets its own column
 * (Rachid, 2026-09-04, in chat).
 *
 * **Why the column has to exist at all.** T27 added an optional `supervise`
 * flag to the `Trick` shape in `@landit/core` and set it on 24 tricks, but only
 * in the canonical TypeScript data. Every rule in `@landit/core` is designed to
 * be handed the *live rows* instead — that is what makes a staff edit take
 * effect without a deploy (`packages/core/src/rules/tricks.ts`) — so a rule
 * reading a field the database has no column for reads `undefined` on every
 * trick in the product. For this particular field that failure has a direction:
 * the coach view would tell every guardian that nothing their child is doing
 * needs supervising. The column is the other half of the flag.
 *
 * **Why a plain bool rather than a nullable select.** `free_override` is a
 * select because "inherit from difficulty" is a third state that has to be
 * spelled out. `supervise` has no third state: a trick either is one a guardian
 * should know about or it is not, and absent means no (`Trick.supervise` in
 * `packages/core/src/types.ts`). What difficulty still does is act as a
 * *fallback* in `supervisedTricks()`, and that fallback is about the plumbing
 * being incomplete, not about a value staff can choose.
 *
 * **The backfill, which is the safety-critical half of this file.** A `bool`
 * added to a populated collection reads `false` on every existing row — so
 * between this migration running and the next seed, an un-backfilled column
 * would say "no trick needs supervising" about a library where 24 do. That is
 * the exact failure the column exists to prevent, arriving through the door
 * marked "deploy". So every live row at `diff >= 5` is set `true` here, which
 * is precisely the list the coach view drew before this change: a database that
 * has been migrated and not yet re-seeded shows a guardian *today's* list, and
 * the seed then narrows it to the marked tricks. Slightly too long is the
 * tolerable failure; empty is not.
 *
 * Re-running is harmless — the same rows are set to the same value — and a
 * database seeded after this point never reaches the backfill's rows at all,
 * because the seed writes the canonical value over it.
 *
 * **Additive.** One nullable field on `tricks` and one value written to rows
 * that already exist. No existing field changes shape and no stored value
 * moves. The `down` path removes exactly what `up` adds.
 */
migrate(
  (app) => {
    const tricks = app.findCollectionByNameOrId('tricks');
    tricks.fields.add(
      new BoolField({
        type: 'bool',
        name: 'supervise',
        required: false,
      }),
    );
    app.save(tricks);

    // See the backfill note above. `findRecordsByFilter` with a page size of
    // zero returns every match; the library is a few hundred rows, so this is
    // one pass and not a paged loop.
    try {
      const risky = app.findRecordsByFilter('tricks', 'diff >= 5', '', 0, 0);
      for (const record of risky) {
        record.set('supervise', true);
        app.save(record);
      }
    } catch {
      // No tricks seeded yet (a fresh database). The seed carries the
      // canonical values, which are better than the fallback this replaces.
    }
  },

  (app) => {
    const tricks = app.findCollectionByNameOrId('tricks');
    tricks.fields.removeByName('supervise');
    app.save(tricks);
  },
);
