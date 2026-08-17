/// <reference path="../.pb_data/types.d.ts" />

/**
 * Video links (T15b) — plan §1, §6.6 and §3 guarantee 2.
 *
 * Riders paste a **YouTube link** and the app embeds it. Land It still hosts no
 * video: what is stored is an eleven-character YouTube id, and `1787270400`
 * already took the file field away. Owner's decisions, all four recorded in the
 * plan (Rachid, 2026-08-17, in chat): a YouTube link, not an upload; `private`
 * or `members` and **no `public`**; a paid perk capped per plan; add, change
 * visibility, remove.
 *
 * ---
 *
 * **This extends `clips` rather than adding a collection, and that was a
 * decision rather than the path of least resistance.**
 *
 * Plan §3 already calls the surviving `clips` skeleton "the row-per-video
 * skeleton `t15b-video-links` extends", and five things read the collection: the
 * sticker award hook (`30_stickers.pb.js` fires on `clips` writes),
 * `riderSnapshot` in `@landit/db`, the staff rider sheet's count, and the
 * `reports` collection's `clip` subject. Reusing it keeps all five coherent for
 * free and makes two of them *true* again — the rider sheet's tile has read a
 * permanent zero since the reversal (issue #132), and `reports.subject_type =
 * 'clip'` gets a subject that exists, which is what T18's report button needs.
 *
 * A new collection would have meant either updating all five to point at it and
 * leaving an empty `clips` behind that nothing writes and nothing may drop, or
 * two collections that both mean "a rider's video". The row was always the same
 * row; only what identifies the video changed, from bytes we hold to an id we
 * do not. One cost is accepted openly: the **name** `clips` now reads as a
 * leftover. Renaming a merged collection is a breaking change to shared code
 * (CLAUDE.md rule 5) and it would break those same five readers to improve a
 * word, so the fields carry the honest names (`video_id`, `visibility`) and this
 * comment is the signpost.
 *
 * **`createRule` reopens.** `1787270400` closed it to everything but server code
 * for one reason: with no file field a rider could POST an empty row and earn the
 * `first-clip` sticker for nothing. That reason is gone — a row now requires a
 * link that parses — and the migration that closed it said in as many words that
 * `t15b` reopens it "alongside the `url` and `visibility` fields, with its own
 * rule". This is that rule. **The sticker stays off the wall** (`isLive: false`
 * in `@landit/core`): whether video links re-arm "Caught On Cam" is the owner's
 * call, filed as issue #131, and `lib/stickers.js` skips a sticker whose record
 * is not live, so nothing is awarded here by accident.
 *
 * ---
 *
 * **Additive.** Two fields on `clips`, two on `plans`, one index, and rules that
 * widen from "server code only" to "the owner, plus signed-in riders where the
 * rider chose it". No existing field changes shape and no stored value moves.
 * The `down` path removes exactly what `up` adds and restores `1787270400`'s
 * rules verbatim.
 */
migrate(
  (app) => {
    // ------------------------------------------------------------- clips ----

    const clips = app.findCollectionByNameOrId('clips');

    /**
     * **What is stored is always the parsed id** — `45_video_links.pb.js`
     * overwrites this field with `parseYouTubeVideoId`'s return value on every
     * create and every update, at the model layer, so there is no write path
     * that stores anything else. That is the point of guarantee 2's link half:
     * no query string, fragment or redirect target a rider or an attacker
     * supplied is ever persisted, so none can be replayed into a browser later.
     *
     * **Then why is it 300 characters and not 11 with a pattern?** Because the
     * client posts what the rider *pasted* and the hook is what turns it into an
     * id. A field of exactly 11 would make PocketBase reject a perfectly good
     * `https://youtu.be/...` with a length error before the parser ever saw it,
     * and the refusal a rider reads would be about a field width instead of
     * about their link. 300 is a sanity bound so nothing enormous reaches the
     * parser; the *shape* is the hook's guarantee, and it holds on paths a field
     * constraint would not (a superuser client included).
     */
    clips.fields.add(
      new TextField({
        type: 'text',
        name: 'video_id',
        required: false,
        max: 300,
      }),
    );

    /**
     * **Two values. There is no `public`, and that absence is the feature.**
     *
     * Profile privacy is three-way (guarantee 1) and this is not, because the
     * risks are not the same. A public *profile* exposes what a rider chose to
     * write about their own riding. A public rider-supplied *third-party video*
     * would be a page we do not control the content of, crawlable and reachable
     * by anyone who guessed a handle — which is a moderation duty over video, the
     * exact thing 2026-08-17's reversal removed from this product. Deleting the
     * state deletes the surface; defending it would have meant building the
     * moderation the reversal was about avoiding.
     *
     * `required: false` on purpose: a select field added to an existing
     * collection reads `''` on rows nobody has updated, and a required field
     * would make those rows unsaveable. Empty is safe here because every reader
     * tests **for** `members` rather than for "not private" — the view rule
     * below, `normaliseVideoVisibility` in the hook lib, and
     * `@landit/core`'s copy of it. An unset value is the most private state, and
     * the hook writes `private` explicitly on every write regardless.
     */
    clips.fields.add(
      new SelectField({
        type: 'select',
        name: 'visibility',
        required: false,
        maxSelect: 1,
        values: ['private', 'members'],
      }),
    );

    // Every surface filters by rider *and* trick (the trick page) or by rider
    // alone (the profile). `idx_clips_user` covers the second; this covers the
    // first without a table scan once a rider has a few.
    clips.indexes = clips.indexes.concat(['CREATE INDEX `idx_clips_trick` ON `clips` (`trick`)']);

    // ------------------------------------------------------------- rules ----
    //
    // Migration callbacks run in their own isolated VM, so these constants are
    // re-declared here rather than shared with `1786838400_init_collections.js`.
    // They are copied verbatim from it on purpose: a *paraphrase* of a security
    // clause is a second clause.

    /** A signed-in rider not held behind the guardian-consent gate (guarantee 4). */
    const VIEWER_OK =
      "@request.auth.id != '' && @request.auth.consent_state != 'pending' && @request.auth.consent_state != 'revoked'";

    /** The same test applied to the rider being looked *at*. */
    const subjectVisible = (p) =>
      `${p}consent_state != 'pending' && ${p}consent_state != 'revoked' && ${p}suspended = false`;

    /**
     * **Guarantee 2, the link half: profile privacy is a ceiling, not a
     * default.**
     *
     * Built as `privacyRule`'s clauses with two changes, so it is recognisably
     * the same pattern rather than a new invention:
     *
     * 1. **The `members` clause gains `visibility = 'members'`.** A video is
     *    visible to another rider only when *both* say so — the rider opened
     *    their profile **and** opened that video. So a `members` video on a
     *    `private` profile is invisible to everyone but its owner: the profile
     *    caps the video, and a per-video setting can only ever make a video
     *    *more* private than the profile, never less. Written as one boolean
     *    conjunction inside the rule rather than computed in a component,
     *    because a component is not a boundary.
     * 2. **`privacyRule`'s third clause is gone entirely.** That is the
     *    signed-out arm (`@request.auth.id = '' && … privacy = 'public'`), and
     *    there is no equivalent here at any privacy setting, because there is no
     *    `public` visibility for it to key off. A signed-out request matches
     *    neither remaining clause — the first needs an authenticated owner, the
     *    second needs `@request.auth.id != ''` — so a visitor who is not signed
     *    in sees no rider video, ever. Not "sees no video unless", not "sees no
     *    video by default". Ever.
     *
     * The owner's own row always resolves, whatever their profile privacy and
     * whatever the video's visibility, including while they are consent-limited:
     * a rider held behind the consent gate reads and writes their own data, and a
     * video they added is theirs (guarantee 4).
     */
    const videoVisibilityRule = [
      '(user = @request.auth.id)',
      `(${VIEWER_OK} && ${subjectVisible('user.')} && visibility = 'members' && ` +
        "(user.privacy = 'public' || user.privacy = 'members'))",
    ].join(' || ');

    clips.listRule = videoVisibilityRule;
    clips.viewRule = videoVisibilityRule;

    /**
     * Own row, and not held behind the consent gate — `OWN_AND_CONSENTED`
     * verbatim from the init migration, which is also exactly what
     * `1787270400`'s `down` path restores.
     *
     * The rule is not where the interesting refusals live. **The cap and the
     * link's validity are enforced in `45_video_links.pb.js` at the model
     * layer**, with no superuser bypass, because a rule cannot count rows and
     * because a server action holding a superuser client must not be able to
     * exceed a plan's allowance. That was a property of T14's byte cap and it is
     * not being lost with the change of unit.
     */
    clips.createRule =
      "user = @request.auth.id && @request.auth.id != '' && " +
      "@request.auth.consent_state != 'pending' && @request.auth.consent_state != 'revoked'";

    /**
     * **Update opens for exactly one reason: changing a video's visibility**
     * (owner's decision 4). The same hook freezes `user`, `trick` and `video_id`
     * on update, so this is a rule that lets a rider re-decide who sees a video
     * and nothing else — in particular it is not a way to swap the video behind
     * a row, which would put content into the database that the create path had
     * never seen.
     */
    clips.updateRule = clips.createRule;

    // Unchanged: a rider deletes their own rows. `deleteRule` has been `user =
    // @request.auth.id` since T2 and remove is the third thing a rider can do.

    app.save(clips);

    // ------------------------------------------------------------- plans ----

    /**
     * The allowance, as **a count plus a boolean** rather than one number with a
     * sentinel in it. `packages/core`'s `videoLinkAllowance` carries the full
     * reasoning; the two properties that decided it:
     *
     * - **`0` means none and only none.** It is read as a count, so nothing has
     *   to know that some particular integer is magic. Rookie is a real zero.
     * - **"Unlimited" is not a number.** Writing it as one needs `-1` or a very
     *   large integer, and every sentinel is a value that some later
     *   `count < cap` compares literally on the day nobody remembers it is
     *   special. A boolean says "the cap does not apply" in the schema.
     *
     * It is also the fail-closed direction *here*, which is why the fields are
     * added in this order and left unset on Rookie: a `number` field added to a
     * populated collection reads `0` on every existing row and a `bool` reads
     * `false`, so a database that has this migration but not the seed grants
     * **no links at all** rather than unlimited ones. The hook reads both off
     * the plan record — never a comparison against the slug `shredder` or
     * `legend`, which plan §2.4 and the insights precedent forbid.
     */
    const plans = app.findCollectionByNameOrId('plans');

    plans.fields.add(
      new NumberField({
        type: 'number',
        name: 'video_link_cap',
        required: false,
        onlyInt: true,
        min: 0,
      }),
    );

    plans.fields.add(
      new BoolField({
        type: 'bool',
        name: 'video_links_unlimited',
        required: false,
      }),
    );

    app.save(plans);

    /**
     * Written to the seeded records here as well as in the seed, for the reason
     * `1787097609_progress_insights.js` gives: a database that already holds the
     * three plan records would otherwise have a Shredder rider refused by a hook
     * reading a field nobody had set. The seed carries the same numbers from
     * `@landit/core`, which is where they are tunable.
     *
     * **The numbers are tunable defaults, not deliberated decisions** (plan §1,
     * the same standing as `WEEKLY_RIDE_TARGET`). Rookie's zero and Legend's
     * unlimited are the owner's; Shredder's ten is `SHREDDER_VIDEO_LINK_CAP` in
     * `packages/core/src/rules/video.ts` and moving it is that line plus the plan
     * row that records it.
     */
    const allowances = [
      { slug: 'rookie', cap: 0, unlimited: false },
      { slug: 'shredder', cap: 10, unlimited: false },
      { slug: 'legend', cap: 0, unlimited: true },
    ];

    for (const grant of allowances) {
      try {
        const record = app.findFirstRecordByFilter('plans', 'slug = {:slug}', { slug: grant.slug });
        record.set('video_link_cap', grant.cap);
        record.set('video_links_unlimited', grant.unlimited);
        app.save(record);
      } catch {
        // No plans seeded yet. The seed carries the same values.
      }
    }
  },

  (app) => {
    const clips = app.findCollectionByNameOrId('clips');

    clips.fields.removeByName('video_id');
    clips.fields.removeByName('visibility');
    clips.indexes = clips.indexes.filter((sql) => sql.indexOf('idx_clips_trick') === -1);

    // Back to what `1787270400_clips_no_hosting.js` left: owner-only reads, no
    // rider write path in at all, no updates. Restated verbatim rather than
    // reconstructed, because a paraphrase of a closed rule is not a closed rule.
    clips.listRule = 'user = @request.auth.id';
    clips.viewRule = 'user = @request.auth.id';
    clips.createRule = null;
    clips.updateRule = null;
    clips.deleteRule = 'user = @request.auth.id';

    app.save(clips);

    const plans = app.findCollectionByNameOrId('plans');
    plans.fields.removeByName('video_link_cap');
    plans.fields.removeByName('video_links_unlimited');
    app.save(plans);
  },
);
