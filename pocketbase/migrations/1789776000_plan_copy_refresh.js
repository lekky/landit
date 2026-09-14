/// <reference path="../.pb_data/types.d.ts" />

/**
 * Rewrites **all three plan cards' copy** on a running box from `@landit/core`
 * (issue #381; the vehicle issue #446 asked for). Nothing else — no
 * entitlement, no price, no trick.
 *
 * ---
 *
 * **The defect this closes, and why Legend is the point of it.**
 *
 * `/plans` reads `pitch`, `perks` and `missing` from the `plans` rows, not from
 * the repository (`apps/web/src/app/(app)/plans/view.ts`). So a card is only as
 * true as the last thing written to the collection, and two rewrites of the
 * canonical copy have never reached a running box:
 *
 * - **2026-09-04** rewrote all three cards (`chore-plan-card-rewrite`, issue
 *   #286). Rookie and Shredder had described the free tier as a *tier line*
 *   ("Both libraries, up to the Easy tier", "Unlocks the Spicy, Gnarly and Pro
 *   tiers") — false in both directions — and both named **two sports**, which
 *   has been wrong since BMX launched. Legend lost **"Exclusive avatar drops"**,
 *   a perk that was never true at all: `data/avatars.ts` gates nothing on a
 *   plan and never has, so every rider on every tier has always seen all 36.
 * - **2026-09-12** doubled the free tier to twenty, which moved the number in
 *   Rookie's and Shredder's copy.
 *
 * `1789171200_free_tier_twenty.js` carried the second of those to the box, but
 * **only for Rookie and Shredder** — it says so, and correctly for what it was:
 * Legend's copy did not change in the tier doubling. The consequence is that
 * **no migration has ever written Legend's row.** Whatever the seed put there
 * when the box was built is what it still says, and issue #381 found the
 * prototype's copy sitting in both local databases on 2026-09-08. If production
 * matches, the live Legend card has been selling a perk that does not exist, on
 * a page with a live Stripe checkout behind it, since the day the site went up.
 *
 * A build session cannot look at production to find out (CLAUDE.md: never touch
 * the production box), and "probably fine" is not a thing to say about a paid
 * line. So this writes all three rows unconditionally and the question stops
 * mattering.
 *
 * **Why a migration rather than a staff edit.** A staff edit fixes the box
 * once and drifts again at the next copy change, and it is three careful
 * paste-ins done by hand on a live instance. This is checked by a test against
 * `@landit/core` before it ever runs.
 *
 * **Why not a seed run.** `pnpm db:seed` upserts every seeded field on every
 * seeded row, so it reverts staff edits to trick content wholesale (issue
 * #273, unresolved). This touches three rows and three fields on each.
 *
 * **What it does not touch, deliberately.** Prices (`price_monthly`,
 * `price_yearly`) are staff-retunable and have Stripe behind them (issue #123);
 * `hue`, `popular`, `is_live` and every entitlement column are left exactly as
 * they are. Copy only.
 *
 * **The session lines are not here, and that is the decision, not an omission**
 * (Rachid, 2026-09-14, in chat, on issue #507). "Four sessions a month" is
 * derived on the page from the row's own `session_month_cap` —
 * `sessionCardPerks` in `apps/web/src/lib/sessionPlanRows.ts` — for two reasons
 * this file cannot satisfy: a literal written into a row is one staff retune of
 * the cap away from advertising a number the hook does not enforce, and copy
 * written by a migration appears at the next deploy whether or not
 * `LANDIT_SESSIONS_OPEN` went with it. A card must not announce sessions before
 * the screens are open.
 *
 * **The three arrays below are duplicated from `@landit/core` and cannot import
 * it** — migrations run in PocketBase's JSVM, which has no module resolution
 * for the workspace. `pocketbase/tests/plan-copy-refresh.test.ts` reads this
 * file and fails if any line drifts from the canonical cards, which is the same
 * guard `1789171200`'s test provides and the only thing that makes the
 * duplication honest.
 *
 * **`down` is deliberately a no-op**, which is unusual enough to justify. Every
 * other `down` in this directory restores a known previous state; here there
 * is no such thing. The state being replaced is *whatever each box drifted to*
 * — different on production, on the e2e database and on a developer's — so
 * there is nothing to restore *to*. Writing the prototype's copy back would be
 * inventing a past that most boxes never had, and would deliberately reinstate
 * "Exclusive avatar drops". Rolling the application back past this migration
 * leaves the rows carrying canonical copy, which describes the product
 * accurately for every build since 2026-09-04 — a safe place to land.
 */

// Verbatim from `PLANS` in `packages/core/src/data/plans.ts`. Every line,
// including the ones that did not change, because a card half-restored is
// harder to reason about than one that matches canonical — the same reasoning
// `1789171200_free_tier_twenty.js` gives for writing whole cards.
//
// Shredder's "10 video links" and Legend's "Unlimited video links" are rendered
// in core by `videoLinkAllowanceLabel` from `videoLinkCap` /
// `videoLinksUnlimited`. They are literals *here* only because the JSVM cannot
// call that function; the test pins them to whatever core renders, so moving
// `SHREDDER_VIDEO_LINK_CAP` fails the build rather than drifting the card.
const COPY = [
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

migrate(
  (app) => {
    for (const card of COPY) {
      let record;
      try {
        record = app.findFirstRecordByFilter('plans', 'slug = {:slug}', { slug: card.slug });
      } catch {
        // No such plan row — a fresh database that has not been seeded yet. The
        // seed writes this same copy from `@landit/core`, so there is nothing
        // to correct and nothing to create here: a migration that invented a
        // plan row would be inventing an entitlement with it.
        continue;
      }

      // Saved only when something actually differs, so a re-run is a no-op and
      // the audit trail stays readable. `perks` and `missing` come back as
      // whatever the JSON column holds, so they are compared serialised.
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
  },

  () => {
    // No-op on purpose. See the note at the top: there is no single previous
    // state to restore, and reinstating the prototype's copy would put a perk
    // that was never true ("Exclusive avatar drops") back on a live card.
  },
);
