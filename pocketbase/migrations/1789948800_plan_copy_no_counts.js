/// <reference path="../.pb_data/types.d.ts" />

/**
 * Takes the **count of free tricks out of the plan cards** on a running box
 * (Rachid, 2026-09-17, in chat, on PR #572: "dont mention counts of tricks in
 * free text as its always subject to change, so remove it everywhere"). Copy
 * only, three fields, the same blast radius as `1789776000_plan_copy_refresh.js`
 * — no entitlement, no price, no trick, and **not the allowance itself**.
 *
 * ---
 *
 * **Why a fourth copy migration rather than an edit to the third.**
 *
 * `/plans` reads `pitch`, `perks` and `missing` from the `plans` rows rather
 * than from the repository (`apps/web/src/app/(app)/plans/view.ts`), so a card
 * is only as true as the last thing written to the collection. Production has
 * already run `1789776000`; editing it now would change a file the box has a
 * row in `_migrations` for, which PocketBase will not re-run — the change would
 * live in the repository and never reach the card. A new file is the only thing
 * that moves a live card.
 *
 * **What changed in the words, and what did not.**
 *
 * Three sentences carried the number and now do not:
 *
 * - Rookie's pitch, "Twenty hand-picked tricks in every sport…" → "Loads of
 *   hand-picked tricks in every sport…"
 * - Rookie's second perk, "Twenty free tricks in each sport, not just the
 *   beginner ones" → "Free tricks in each sport, not just the beginner ones"
 * - Shredder's pitch, "…not just the twenty we picked for you" → "…not just the
 *   ones we picked for you"
 *
 * Legend's copy is unchanged and is written anyway, for the reason `1789776000`
 * gives: a card half-restored is harder to reason about than one that matches
 * canonical, and Legend is the row with the longest history of not being
 * written at all (issue #381).
 *
 * **`FREE_TRICKS_PER_SPORT` is untouched.** The free tier still grants exactly
 * what it granted this morning, and the hook that enforces it is not in this
 * file. What went is the sentence quoting the number — because the allowance is
 * a pricing lever that has already moved once (ten on 2026-09-04, twenty on
 * 2026-09-12), and every move drags a copy edit across seven files, two
 * migrations and the specs behind them. `packages/core/src/data/plans.ts`
 * carries the full reasoning and the rule that replaced "'Twenty' is safe to
 * write down".
 *
 * **The down migration restores the 2026-09-12 wording**, which is what
 * `1789776000` wrote and what a box rolled back past this file should say — a
 * real previous state, unlike `1789776000`'s own down, which had none to
 * return to. It is the same three sentences with the number back in, so a
 * rollback leaves three accurate cards rather than a mixture.
 */

// Verbatim from `PLANS` in `packages/core/src/data/plans.ts`, pinned by
// `pocketbase/tests/plan-copy-no-counts.test.ts` — the migration runs in
// PocketBase's JSVM and cannot resolve the workspace, so the duplication is
// guarded by a test rather than by care.
//
// Shredder's "10 video links" is rendered in core by `videoLinkAllowanceLabel`
// from `videoLinkCap`. It is a literal *here* only because the JSVM cannot call
// that function, and the test pins it to whatever core renders — so moving
// `SHREDDER_VIDEO_LINK_CAP` fails the build rather than drifting the card. It
// is a **video** allowance, not a count of tricks, and the owner's line is
// about tricks; it stays.
const COPY = [
  {
    slug: 'rookie',
    pitch:
      'Loads of hand-picked tricks in every sport, easy ones and hard ones, tracked properly. No trial, no card.',
    perks: [
      'Scooter, skateboard and BMX libraries',
      'Free tricks in each sport, not just the beginner ones',
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
      'The whole library, not just the ones we picked for you. The whips, flips and tre flips.',
    perks: [
      'Everything in Rookie',
      'Every trick in all three sports, nothing locked',
      'Challenge history kept, week after week',
      'Custom printable trick sheets',
      '10 video links, private until you say otherwise',
    ],
    missing: ['Legend flair', 'Progress insights'],
  },
  {
    slug: 'legend',
    pitch: 'Everything unlocked, plus the numbers behind your riding.',
    perks: [
      'Everything in Shredder',
      'Legend flair on your profile and crew board',
      'Progress insights: which categories you are speeding up in',
      'Personal records: best month, longest run, hardest landing',
      'Next-trick suggestions from the skill tree',
      'Unlimited video links',
    ],
    missing: [],
  },
];

// What the cards said between 2026-09-12 and 2026-09-17 — `1789776000`'s `COPY`,
// which is the state a box rolled back past this migration should be in. A
// snapshot and history from here, exactly as `COPY_TEN` and `COPY_TWENTY` in
// `1789171200_free_tier_twenty.js` already are: it is deliberately **not**
// pinned to `@landit/core`, because core has moved on.
const COPY_WITH_COUNTS = COPY.map((card) => {
  if (card.slug === 'rookie') {
    return {
      ...card,
      pitch:
        'Twenty hand-picked tricks in every sport, easy ones and hard ones, tracked properly. No trial, no card.',
      perks: card.perks.map((perk) =>
        perk === 'Free tricks in each sport, not just the beginner ones'
          ? 'Twenty free tricks in each sport, not just the beginner ones'
          : perk,
      ),
    };
  }
  if (card.slug === 'shredder') {
    return {
      ...card,
      pitch:
        'The whole library, not just the twenty we picked for you. The whips, flips and tre flips.',
    };
  }
  return card;
});

/**
 * Write `cards` onto the `plans` rows they name. Shared by both directions, so
 * a rollback cannot drift from the way the forward write behaves.
 */
function writeCopy(app, cards) {
  for (const card of cards) {
    let record;
    try {
      record = app.findFirstRecordByFilter('plans', 'slug = {:slug}', { slug: card.slug });
    } catch {
      // No such plan row — a fresh database that has not been seeded yet. The
      // seed writes this same copy from `@landit/core`, so there is nothing to
      // correct and nothing to create here: a migration that invented a plan row
      // would be inventing an entitlement with it.
      continue;
    }

    // Saved only when something actually differs, so a re-run is a no-op and the
    // audit trail stays readable. `perks` and `missing` come back as whatever
    // the JSON column holds, so they are compared serialised.
    const sameList = (field, wanted) =>
      JSON.stringify(record.get(field) || []) === JSON.stringify(wanted);

    if (
      record.getString('pitch') === card.pitch &&
      sameList('perks', card.perks) &&
      sameList('missing', card.missing)
    ) {
      continue;
    }

    record.set('pitch', card.pitch);
    record.set('perks', card.perks);
    record.set('missing', card.missing);
    app.save(record);
  }
}

migrate(
  (app) => {
    writeCopy(app, COPY);
  },

  (app) => {
    writeCopy(app, COPY_WITH_COUNTS);
  },
);
