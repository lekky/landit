/// <reference path="../.pb_data/types.d.ts" />

/**
 * Sessions (T36) — a logged ride at a spot. Plan §1 D1–D6, §3, §6.4 standard
 * 10 as amended 2026-09-13, §6.6.
 *
 * Owner's decisions, all six recorded in the plan (Rachid, 2026-09-13, in
 * chat): a session stores **where and when** (D1); visibility is **Public /
 * Crew / Only me** on the profile privacy ids, default `private` (D2); "rode
 * with" is **crew-mates only** (D3); a clip is a **YouTube, Instagram or TikTok
 * link**, never an upload (D4); session clips have **their own allowance** (D5);
 * Rookie logs **four a month** with a once-per-account grace, and the ride and
 * the streak always save (D6).
 *
 * **Additive.** Three new collections, one field on `users`, four on `plans`.
 * No existing field, rule or stored value moves, and `down` removes exactly
 * what `up` adds.
 *
 * ---
 *
 * **Three collections, and why the trick entries are their own.**
 *
 * - `sessions` — one row per ride.
 * - `session_tricks` — one row per trick worked on in a session. A join rather
 *   than a JSON column because three things need to *query* it: "your sessions
 *   on this trick" on the trick page (a filter on `trick`), the paywall (which
 *   already knows how to refuse a row with a `user` and a `trick` —
 *   `enforcePaywall` is reused, not copied) and the one-way stage promotion,
 *   which has to record exactly once per entry which move it made.
 * - `session_grace` — the once-per-account "save this one anyway". A row of its
 *   own, with **no delete rule**, so the grace cannot be restored by deleting
 *   the session that spent it. A unique index on `user` is what makes it once.
 *
 * **Why the grace is not a field on `users`.** A server-owned field there would
 * have to join the frozen list in `guardUserWrite`, which is a behaviour change
 * to a merged shared hook (CLAUDE.md rule 5). A collection nobody can write
 * holds the same fact with nothing existing touched.
 */
migrate(
  (app) => {
    // Copied verbatim from `1786838400_init_collections.js`, on purpose: a
    // paraphrase of a security clause is a second clause.
    const VIEWER_OK =
      "@request.auth.id != '' && @request.auth.consent_state != 'pending' && @request.auth.consent_state != 'revoked'";
    const subjectVisible = (p) =>
      `${p}consent_state != 'pending' && ${p}consent_state != 'revoked' && ${p}suspended = false`;

    /**
     * **Who can read a session: the stricter of the session and the profile
     * wins** (guarantee 1, applied by D2), and a consent-limited or suspended
     * rider's sessions reach nobody (guarantee 4).
     *
     * `privacyRule`'s three arms, each gaining the session's own setting, plus
     * a fourth for Crew. `p` is the path to the session — `''` on `sessions`,
     * `'session.'` on `session_tricks`, so a trick entry is exactly as visible
     * as the session it belongs to and never more.
     *
     * 1. The owner, always — including while consent-limited: a rider held
     *    behind the gate reads their own data (guarantee 4).
     * 2. `public` session, `public` or `members` profile: any signed-in,
     *    consented rider.
     * 3. `public` session **and** `public` profile: a signed-out visitor too.
     *    This arm is the D2 divergence from `clips`, whose rule has no
     *    signed-out arm at all. It covers sessions only; the trick video rule
     *    is unchanged.
     * 4. `members` session ("Crew"), `public` or `members` profile: a signed-in,
     *    consented rider **who shares a crew with the owner**. On a session
     *    `members` is narrower than on a profile — crew-mates, not everyone
     *    signed in. Expressed as a walk from the owner through their
     *    memberships to the crews' members, so it holds in the rule rather than
     *    in a component.
     *
     * A `private` session, or any session on a `private` profile, matches only
     * arm 1.
     */
    const sessionRule = (p) => {
      const owner = `${p}user`;
      const open = `(${owner}.privacy = 'public' || ${owner}.privacy = 'members')`;
      return [
        `(${owner} = @request.auth.id)`,
        `(${VIEWER_OK} && ${subjectVisible(`${owner}.`)} && ${p}visibility = 'public' && ${open})`,
        `(@request.auth.id = '' && ${subjectVisible(`${owner}.`)} && ${p}visibility = 'public' && ${owner}.privacy = 'public')`,
        `(${VIEWER_OK} && ${subjectVisible(`${owner}.`)} && ${p}visibility = 'members' && ${open} && ` +
          `${owner}.crew_members_via_user.crew.crew_members_via_crew.user ?= @request.auth.id)`,
      ].join(' || ');
    };

    const idOf = (name) => app.findCollectionByNameOrId(name).id;
    const rel = (name, target, opts) =>
      Object.assign(
        {
          type: 'relation',
          name,
          collectionId: idOf(target),
          cascadeDelete: false,
          minSelect: 0,
          maxSelect: 1,
          required: false,
        },
        opts || {},
      );
    const select = (name, values, opts) =>
      Object.assign({ type: 'select', name, values, maxSelect: 1, required: false }, opts || {});
    const created = () => ({ type: 'autodate', name: 'created', onCreate: true, onUpdate: false });
    const updated = () => ({ type: 'autodate', name: 'updated', onCreate: true, onUpdate: true });

    const STAGES = ['want', 'trying', 'some', 'most', 'every'];

    // ------------------------------------------------------------ sessions ----

    app.save(
      new Collection({
        type: 'base',
        name: 'sessions',
        listRule: sessionRule(''),
        viewRule: sessionRule(''),
        /*
         * Own row, signed in. **Not** `OWN_AND_CONSENTED`: a rider waiting on a
         * guardian may keep a diary, the way they may keep notes and faves —
         * what guarantee 4 forbids is their sessions *reaching* anybody, and the
         * read rule above is what makes those owner-only whatever the setting.
         * Tagging another rider, which does reach somebody, is refused for them
         * in `66_sessions.pb.js`.
         */
        createRule: "@request.auth.id != '' && user = @request.auth.id",
        updateRule: "@request.auth.id != '' && user = @request.auth.id",
        deleteRule: "@request.auth.id != '' && user = @request.auth.id",
        fields: [
          rel('user', 'users', { required: true, cascadeDelete: true }),
          { type: 'date', name: 'started_at', required: true },
          // One of 30, 60, 120, 180 — the hook checks the set.
          { type: 'number', name: 'duration_minutes', required: false, onlyInt: true, min: 0 },
          select('sport', ['scooter', 'skate', 'bmx'], { required: true }),
          // Not `required` in the schema so staff can still remove a spot: a
          // required relation would refuse the spot's delete. The hook requires
          // it on every rider write instead.
          rel('spot', 'spots'),
          rel('event', 'events'),
          { type: 'text', name: 'aim', required: false, max: 120 },
          select('feel', ['sent', 'good', 'fine', 'rough', 'hurt'], { required: true }),
          select('weather', ['sun', 'cloud', 'rain', 'wind', 'cold']),
          { type: 'text', name: 'notes', required: false, max: 2000 },
          rel('rode_with', 'users', { maxSelect: 10 }),
          /*
           * The clip, as `{ platform, id }` in two columns (D4). `clip_id` is
           * 300 wide for the reason `clips.video_id` is: the client posts what
           * the rider pasted and the hook overwrites it with the parsed id, so a
           * narrow field would refuse a good link on its length before the
           * parser saw it.
           */
          select('clip_platform', ['youtube', 'instagram', 'tiktok']),
          { type: 'text', name: 'clip_id', required: false, max: 300 },
          select('visibility', ['public', 'members', 'private']),
          /*
           * The rider-clock month the session was *logged* in, `YYYY-MM`.
           * Computed in Node (goja has no `Intl`, LESSONS §5), bounds-checked in
           * the hook, frozen after create. The quota counts it.
           */
          {
            type: 'text',
            name: 'month_key',
            required: false,
            max: 7,
            pattern: '^$|^[0-9]{4}-[0-9]{2}$',
          },
          // Saved on the once-per-account grace. Server-decided, frozen.
          { type: 'bool', name: 'grace', required: false },
          created(),
          updated(),
        ],
        indexes: [
          'CREATE INDEX `idx_sessions_user_started` ON `sessions` (`user`, `started_at`)',
          'CREATE INDEX `idx_sessions_user_month` ON `sessions` (`user`, `month_key`)',
          'CREATE INDEX `idx_sessions_user_spot` ON `sessions` (`user`, `spot`)',
          'CREATE INDEX `idx_sessions_user_event` ON `sessions` (`user`, `event`)',
        ],
      }),
    );

    // ------------------------------------------------------ session_tricks ----

    app.save(
      new Collection({
        type: 'base',
        name: 'session_tricks',
        listRule: sessionRule('session.'),
        viewRule: sessionRule('session.'),
        createRule: "@request.auth.id != '' && session.user = @request.auth.id",
        updateRule: "@request.auth.id != '' && session.user = @request.auth.id",
        deleteRule: "@request.auth.id != '' && session.user = @request.auth.id",
        fields: [
          rel('session', 'sessions', { required: true, cascadeDelete: true }),
          // Copied from the session by the hook, so the paywall can read it and
          // "your sessions on this trick" is one indexed filter.
          rel('user', 'users', { required: true, cascadeDelete: true }),
          rel('trick', 'tricks', { required: true, cascadeDelete: true }),
          { type: 'bool', name: 'landed', required: false },
          // The move this entry made, written once by the hook and never by a
          // client. Both empty means it moved nothing.
          select('stage_from', STAGES),
          select('stage_to', STAGES),
          created(),
          updated(),
        ],
        indexes: [
          'CREATE UNIQUE INDEX `idx_session_tricks_pair` ON `session_tricks` (`session`, `trick`)',
          'CREATE INDEX `idx_session_tricks_user_trick` ON `session_tricks` (`user`, `trick`)',
        ],
      }),
    );

    // ------------------------------------------------------- session_grace ----

    app.save(
      new Collection({
        type: 'base',
        name: 'session_grace',
        listRule: "@request.auth.id != '' && user = @request.auth.id",
        viewRule: "@request.auth.id != '' && user = @request.auth.id",
        // Written by `66_sessions.pb.js` and nothing else; never deleted by a
        // rider, which is what makes it once per account.
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          rel('user', 'users', { required: true, cascadeDelete: true }),
          rel('session', 'sessions'),
          { type: 'text', name: 'month_key', required: false, max: 7 },
          created(),
        ],
        indexes: ['CREATE UNIQUE INDEX `idx_session_grace_user` ON `session_grace` (`user`)'],
      }),
    );

    // --------------------------------------------------------------- users ----

    /**
     * Who sees new sessions (D2). Not required, and empty reads as `private`
     * everywhere it is read (`sessionVisibilityDefault` in `@landit/core`), so
     * every existing rider starts on the conservative default without a
     * backfill. A rider writes it on their own row; nothing guards it, because
     * choosing it is the point.
     */
    const users = app.findCollectionByNameOrId('users');
    users.fields.add(
      new SelectField({
        type: 'select',
        name: 'session_visibility_default',
        required: false,
        maxSelect: 1,
        values: ['public', 'members', 'private'],
      }),
    );
    app.save(users);

    // --------------------------------------------------------------- plans ----

    /**
     * Two allowances, each a count plus a boolean — the encoding
     * `1787356800_video_links.js` argues for, and the fail-closed direction:
     * a row nobody updated reads `0` and `false`, which logs no sessions and
     * holds no clips. (The ride still saves, D6.)
     */
    const plans = app.findCollectionByNameOrId('plans');
    plans.fields.add(
      new NumberField({
        type: 'number',
        name: 'session_month_cap',
        required: false,
        onlyInt: true,
        min: 0,
      }),
    );
    plans.fields.add(new BoolField({ type: 'bool', name: 'sessions_unlimited', required: false }));
    plans.fields.add(
      new NumberField({
        type: 'number',
        name: 'session_clip_cap',
        required: false,
        onlyInt: true,
        min: 0,
      }),
    );
    plans.fields.add(
      new BoolField({ type: 'bool', name: 'session_clips_unlimited', required: false }),
    );
    app.save(plans);

    /**
     * Written onto already-seeded plan rows here as well as in the seed, so a
     * live database is not left refusing every session between this migration
     * and the next seed run. The numbers are `@landit/core`'s — Rookie's four
     * and zero, and Legend's unlimited, are the owner's; Shredder's clip cap is
     * `SHREDDER_SESSION_CLIP_CAP`, a tunable default. A test holds these to core.
     */
    const grants = [
      { slug: 'rookie', sessions: 4, sessionsUnlimited: false, clips: 0, clipsUnlimited: false },
      { slug: 'shredder', sessions: 0, sessionsUnlimited: true, clips: 10, clipsUnlimited: false },
      { slug: 'legend', sessions: 0, sessionsUnlimited: true, clips: 0, clipsUnlimited: true },
    ];
    for (const grant of grants) {
      try {
        const record = app.findFirstRecordByFilter('plans', 'slug = {:slug}', { slug: grant.slug });
        record.set('session_month_cap', grant.sessions);
        record.set('sessions_unlimited', grant.sessionsUnlimited);
        record.set('session_clip_cap', grant.clips);
        record.set('session_clips_unlimited', grant.clipsUnlimited);
        app.save(record);
      } catch {
        // No plans seeded yet. The seed carries the same values.
      }
    }
  },

  (app) => {
    app.delete(app.findCollectionByNameOrId('session_grace'));
    app.delete(app.findCollectionByNameOrId('session_tricks'));
    app.delete(app.findCollectionByNameOrId('sessions'));

    const users = app.findCollectionByNameOrId('users');
    users.fields.removeByName('session_visibility_default');
    app.save(users);

    const plans = app.findCollectionByNameOrId('plans');
    plans.fields.removeByName('session_month_cap');
    plans.fields.removeByName('sessions_unlimited');
    plans.fields.removeByName('session_clip_cap');
    plans.fields.removeByName('session_clips_unlimited');
    app.save(plans);
  },
);
