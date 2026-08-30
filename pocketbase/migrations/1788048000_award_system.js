/// <reference path="../.pb_data/types.d.ts" />

/**
 * The award system (T24, owner-directed 2026-08-30).
 *
 * Two things happen here, and the order matters.
 *
 * **1. New `stickers` fields.** `img` (the printed badge file under
 * `/stickers/`), `stars`, `rarity` (display), and the rule wiring: `kind` —
 * which coded rule judges the record — plus its parameters `trick` and `cat`.
 * The rule *shapes* stay in code (`hooks/lib/stickers.js`, `@landit/core`);
 * the record carries only tunable parameters, exactly as `n` always has
 * (plan §3). All additive: no existing field changes shape.
 *
 * **2. Slug renames, in place.** Fifteen legacy stickers' conditions match a
 * new award exactly, so their records *become* that award rather than
 * retiring: `rider_stickers` points at the record id, which means every
 * earned row carries straight over to the new badge. Renaming here rather
 * than in the seed is deliberate — the seed matches on `slug`, so without
 * this step it would create a duplicate award record and strand the earned
 * rows on a forever-retired twin. Three of the fifteen (`first-land`,
 * `first-clip`, `flat-out`) already carry their award slug and need no
 * rename. Renames are idempotent and each guards its own absence, so a fresh
 * database (nothing seeded yet) migrates clean.
 *
 * Everything else — the 120 genuinely new records, names, art, kinds,
 * thresholds, and the retirement of the ten legacy stickers with no honest
 * equivalent — is data, and lands with the next seed run
 * (`pnpm --filter @landit/db seed`). Until that runs, renamed records keep
 * working under their legacy slug-keyed rules where those still exist, and
 * the wall simply shows the old set; nothing breaks in the gap.
 */
migrate(
  (app) => {
    const stickers = app.findCollectionByNameOrId('stickers');
    stickers.fields.add(new TextField({ type: 'text', name: 'img', max: 60, required: false }));
    stickers.fields.add(
      new NumberField({
        type: 'number',
        name: 'stars',
        onlyInt: true,
        min: 0,
        max: 3,
        required: false,
      }),
    );
    stickers.fields.add(new TextField({ type: 'text', name: 'rarity', max: 12, required: false }));
    stickers.fields.add(new TextField({ type: 'text', name: 'kind', max: 30, required: false }));
    stickers.fields.add(new TextField({ type: 'text', name: 'trick', max: 40, required: false }));
    stickers.fields.add(new TextField({ type: 'text', name: 'cat', max: 12, required: false }));
    app.save(stickers);

    // Legacy slug → award slug. The mapped pairs' conditions are equivalent
    // (or strictly easier, for the two "every time on X" records whose award
    // asks only for X landed), so no carried row claims something its rider
    // has not done.
    const RENAMES = {
      'ten-deep': 'rolling-deep',
      'week-one': 'hot-streak',
      'month-on': 'all-season',
      challenger: 'first-challenge',
      'crew-up': 'crewed-up',
      'every-time': 'on-lock',
      'whip-club': 'tailwhip',
      'hop-master': 'bunny-hop',
      'flip-club': 'sk-kickflip',
      'coping-time': 'sk-axle-stall',
      'tre-deep': 'sk-tre-flip',
      'ollie-up': 'sk-ollie',
    };

    for (const from of Object.keys(RENAMES)) {
      try {
        const record = app.findFirstRecordByFilter('stickers', 'slug = {:slug}', { slug: from });
        record.set('slug', RENAMES[from]);
        app.save(record);
      } catch {
        // Not seeded (fresh database) or already renamed (re-run). Both fine.
      }
    }
  },

  (app) => {
    const stickers = app.findCollectionByNameOrId('stickers');
    for (const name of ['img', 'stars', 'rarity', 'kind', 'trick', 'cat']) {
      stickers.fields.removeByName(name);
    }
    app.save(stickers);
    // The renames are not reversed: by the time a rollback runs, rider rows
    // may already have been earned against the new slugs, and un-renaming
    // would strand those instead.
  },
);
