/// <reference path="../.pb_data/types.d.ts" />

/**
 * The free tier doubles to twenty tricks a sport (Rachid, 2026-09-12, in chat;
 * plan §T27, "Superseded 2026-09-12"). PR #429 moved the canonical data in
 * `@landit/core`; this moves the rows the running server actually reads.
 *
 * ---
 *
 * **Why this exists at all, and why it is not a reseed.**
 *
 * The paywall a rider hits is `isTrickFree` applied to a `tricks` *row*, and
 * the row's answer comes from `free_override` — not from anything in the
 * repository. Merging #429 changed the library in `packages/core` and changed
 * every card that quotes a number; it changed nothing on the box. Deploy
 * without this and the site advertises twenty free tricks and enforces ten,
 * with `/legal` promising twenty in a published document (issue #427).
 *
 * A seed run would also fix it and was rejected: `pnpm db:seed` upserts every
 * seeded field on every seeded row, so it reverts staff edits to trick content
 * wholesale (issue #273, unresolved). This writes two fields and nothing else,
 * so a staff correction to a trick's `tips` or `mistakes` survives it.
 *
 * **What it does overwrite, deliberately.** `free_override` on every trick, and
 * the copy on the Rookie and Shredder plan rows. If staff have moved a trick
 * across the paywall by hand in the portal, this puts it back where
 * `@landit/core` says it belongs — the free tier is an owner decision with a
 * test pinning it (`packages/core/src/rules/tricks.test.ts`), not a per-row
 * staff setting. Legend is not touched: none of its copy changed.
 *
 * **The two lists below are duplicated from `@landit/core` and cannot import
 * it** — migrations run in PocketBase's JSVM, which has no module resolution
 * for the workspace. `pocketbase/tests/free-tier-twenty.test.ts` reads this file
 * and fails if either list drifts from the canonical data, which is what keeps
 * the duplication honest (the same trick `1787356800_video_links.js` plays with
 * its hard-coded allowances, minus the drift risk).
 *
 * **`down` restores the ten-trick tier**, because the data is the entitlement.
 * Rolling the application back without it would leave every rider on the free
 * plan holding twenty tricks with a build that believes they hold ten.
 *
 * One thing `down` cannot undo, and it is the reason to prefer rolling forward:
 * riders will have tracked the ten tricks a sport this opens. Going back puts
 * those tricks behind the paywall **with the rider's `trick_progress` still on
 * them** — the rows are never deleted, so nothing is lost, but a rookie would
 * see stages they filled in on a trick they can no longer open. Fixing a wrong
 * value by editing these lists and migrating again costs nobody that.
 *
 * **It takes no backup, and should not.** The box's safety net is Litestream,
 * replicating `data.db` to R2 continuously with 7-day retention
 * (`docs/infrastructure.md`, Backups) — point-in-time restore already covers
 * this, and a migration that shelled out to make its own copy would be a second
 * unrehearsed mechanism next to a rehearsed one. What is worth doing before
 * the deploy is confirming the rehearsed one is healthy:
 * `journalctl -u litestream -n 40`.
 */

// The 2026-09-12 twenty: every Rookie trick, an Easy fill, 4 Spicy, 2 Gnarly.
// A trick absent from this map inherits from `diff` — `free_override` empty.
const OVERRIDES_TWENTY = [
  ['x-up', 'paid'],
  ['nose-manual', 'free'],
  ['tailwhip', 'free'],
  ['bar-spin', 'free'],
  ['360', 'free'],
  ['nose-pivot', 'paid'],
  ['powerslide', 'paid'],
  ['cali-slider', 'paid'],
  ['chairman', 'paid'],
  ['boardslide', 'free'],
  ['bank-transfer', 'paid'],
  ['one-hander', 'paid'],
  ['indy-grab', 'paid'],
  ['bar-to-whip', 'free'],
  ['sk-kickflip', 'free'],
  ['sk-50-50', 'free'],
  ['sk-axle-stall', 'free'],
  ['sk-indy', 'free'],
  ['sk-backside-air', 'free'],
  ['sk-hippie-jump', 'paid'],
  ['sk-body-varial', 'paid'],
  ['sk-caveman', 'paid'],
  ['sk-boneless', 'paid'],
  ['sk-no-comply', 'paid'],
  ['sk-roll-in', 'paid'],
  ['sk-tail-stall', 'paid'],
  ['sk-slash-grind', 'paid'],
  ['sk-wallride', 'free'],
  ['bmx-pull-up-barspin', 'paid'],
  ['bmx-footjam', 'paid'],
  ['bmx-double-peg', 'free'],
  ['bmx-tyre-tap', 'paid'],
  ['bmx-wallride', 'free'],
  ['bmx-360', 'free'],
  ['bmx-flyout-tailwhip', 'free'],
  ['bmx-endo', 'paid'],
  ['bmx-rollback', 'paid'],
  ['bmx-half-cab', 'free'],
  ['bmx-feeble-stall', 'paid'],
  ['bmx-peg-stall', 'paid'],
  ['bmx-footplant', 'paid'],
  ['bmx-one-hander', 'free'],
];

// The 2026-09-04 ten: 4 Rookie / 3 Easy / 2 Spicy / 1 Gnarly. `down` only.
const OVERRIDES_TEN = [
  ['manual', 'paid'],
  ['hippie-jump', 'paid'],
  ['x-up', 'paid'],
  ['gap', 'paid'],
  ['tailwhip', 'free'],
  ['bar-spin', 'free'],
  ['360', 'free'],
  ['kickturn', 'paid'],
  ['nose-pivot', 'paid'],
  ['powerslide', 'paid'],
  ['cali-slider', 'paid'],
  ['chairman', 'paid'],
  ['tail-tap', 'paid'],
  ['acid-drop', 'paid'],
  ['quarter-pipe-air', 'paid'],
  ['bank-transfer', 'paid'],
  ['one-hander', 'paid'],
  ['indy-grab', 'paid'],
  ['sk-shuvit', 'paid'],
  ['sk-fakie-ollie', 'paid'],
  ['sk-kickflip', 'free'],
  ['sk-50-50', 'free'],
  ['sk-rock-to-fakie', 'paid'],
  ['sk-powerslide', 'paid'],
  ['sk-hippie-jump', 'paid'],
  ['sk-body-varial', 'paid'],
  ['sk-caveman', 'paid'],
  ['sk-boneless', 'paid'],
  ['sk-no-comply', 'paid'],
  ['sk-curb-drop', 'paid'],
  ['sk-curb-ollie', 'paid'],
  ['sk-ramp-kickturn', 'paid'],
  ['sk-roll-in', 'paid'],
  ['sk-tail-stall', 'paid'],
  ['sk-slash-grind', 'paid'],
  ['sk-wallride', 'free'],
  ['bmx-manual', 'paid'],
  ['bmx-fakie', 'paid'],
  ['bmx-x-up', 'paid'],
  ['bmx-nollie', 'paid'],
  ['bmx-pull-up-barspin', 'paid'],
  ['bmx-180', 'paid'],
  ['bmx-footjam', 'paid'],
  ['bmx-double-peg', 'free'],
  ['bmx-tyre-tap', 'paid'],
  ['bmx-flyout-tailwhip', 'free'],
  ['bmx-endo', 'paid'],
  ['bmx-rollback', 'paid'],
  ['bmx-hop-on-off', 'paid'],
  ['bmx-double-peg-stall', 'paid'],
  ['bmx-feeble-stall', 'paid'],
  ['bmx-peg-stall', 'paid'],
  ['bmx-footplant', 'paid'],
  ['bmx-one-hander', 'free'],
];

// Rookie's and Shredder's copy, verbatim from `PLANS` in `@landit/core`. Only
// the lines that quote the number changed, but the whole card is written: the
// production rows may still carry the prototype's copy (issue #381), and a card
// half-restored is harder to reason about than one that matches canonical.
const COPY_TWENTY = [
  {
    slug: 'rookie',
    pitch:
      'Twenty hand-picked tricks in every sport, easy ones and hard ones, tracked properly. No trial, no card.',
    perks: [
      'Scooter, skateboard and BMX libraries',
      'Twenty free tricks in each sport, not just the beginner ones',
      'Track every trick through 5 stages',
      'Digital sticker wall',
      "This week's challenge",
      'Spots map and your crew',
    ],
    missing: ['Every other trick in the library', 'Progress insights', 'Video links'],
  },
  {
    slug: 'shredder',
    pitch:
      'The whole library, not just the twenty we picked for you. The whips, flips and tre flips.',
    perks: [
      'Everything in Rookie',
      'Every trick in all three sports, nothing locked',
      'Challenge history kept, week after week',
      'Custom printable trick sheets',
      '10 video links, private until you say otherwise',
    ],
    missing: ['Legend flair', 'Progress insights'],
  },
];

const COPY_TEN = [
  {
    slug: 'rookie',
    pitch:
      'Ten hand-picked tricks in every sport, easy ones and hard ones, tracked properly. No trial, no card.',
    perks: [
      'Scooter, skateboard and BMX libraries',
      'Ten free tricks in each sport, not just the beginner ones',
      'Track every trick through 5 stages',
      'Digital sticker wall',
      "This week's challenge",
      'Spots map and your crew',
    ],
    missing: ['Every other trick in the library', 'Progress insights', 'Video links'],
  },
  {
    slug: 'shredder',
    pitch: 'The whole library, not just the ten we picked for you. The whips, flips and tre flips.',
    perks: [
      'Everything in Rookie',
      'Every trick in all three sports, nothing locked',
      'Challenge history kept, week after week',
      'Custom printable trick sheets',
      '10 video links, private until you say otherwise',
    ],
    missing: ['Legend flair', 'Progress insights'],
  },
];

/**
 * Writes `free_override` on every trick row to match `overrides`, and the copy
 * on the two plan rows. Saves only rows that actually differ, so a re-run is a
 * no-op and the audit trail stays readable.
 */
function applyFreeTier(app, overrides, copy) {
  const wanted = new Map(overrides);

  /*
   * **Only rows this change is actually about are touched**, and that is a
   * safety property rather than an optimisation. The set is every trick either
   * tier overrides — the twenty's forty-two plus the ten's fifty-four — and a
   * row outside it is left exactly as it is.
   *
   * The alternative, writing `wanted.get(slug) || ''` across the whole
   * collection, quietly clears the override on any row the maps do not name.
   * That is fine for a canonical trick, which has no override to clear, and
   * wrong for a trick **staff added in the portal**: one marked `paid` at
   * difficulty 2 would come back free, and a paywall that opens itself is the
   * failure this product can least afford (plan §3, guarantee 3). Staff-added
   * tricks are not in `@landit/core`, so nothing here can know what they should
   * be — leaving them alone is the only honest answer.
   *
   * A page size of zero returns every match, the way `1788134400`'s backfill
   * does — the library is a few hundred rows, so this is one pass.
   */
  const touched = new Set([...wanted.keys(), ...OVERRIDES_TEN.map(([id]) => id)]);

  try {
    const tricks = app.findRecordsByFilter('tricks', "id != ''", 'created,id', 0, 0);
    for (const trick of tricks) {
      const slug = trick.getString('slug');
      if (!touched.has(slug)) continue;
      const next = wanted.get(slug) || '';
      if (trick.getString('free_override') === next) continue;
      trick.set('free_override', next);
      app.save(trick);
    }
  } catch {
    // No tricks seeded yet (a fresh database). The seed carries the canonical
    // overrides from `@landit/core`, so there is nothing to correct.
  }

  for (const card of copy) {
    try {
      const record = app.findFirstRecordByFilter('plans', 'slug = {:slug}', { slug: card.slug });
      record.set('pitch', card.pitch);
      record.set('perks', card.perks);
      record.set('missing', card.missing);
      app.save(record);
    } catch {
      // No plans seeded yet. The seed carries the same copy from `@landit/core`.
    }
  }
}

migrate(
  (app) => {
    applyFreeTier(app, OVERRIDES_TWENTY, COPY_TWENTY);
  },

  (app) => {
    applyFreeTier(app, OVERRIDES_TEN, COPY_TEN);
  },
);
