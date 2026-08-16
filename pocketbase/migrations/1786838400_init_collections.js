/// <reference path="../.pb_data/types.d.ts" />

/**
 * Land It — the whole schema, as one initial migration.
 *
 * Plan §3 is the authority for what exists here and why. Two things about this
 * file are load-bearing and easy to break by accident:
 *
 *  1. **Migration callbacks are serialised and run in their own isolated VM.**
 *     Nothing declared outside `migrate(...)` is visible inside it, so every
 *     constant below lives in the `up` function. (Same rule as pb_hooks.)
 *
 *  2. **API rules are half of the security model; hooks are the other half.**
 *     A rule here that looks redundant with a hook usually is not — the rule
 *     stops the request before it reaches the record, the hook stops a write
 *     that never came through a request at all. Where a guarantee needs both,
 *     both are present. See `pocketbase/hooks/`.
 */
migrate(
  (app) => {
    // ---------------------------------------------------------------- rules --

    // A signed-in rider who is not held behind the guardian-consent gate.
    // Plan §3 guarantee 4: `pending` and `revoked` riders read and write their
    // own data only, so every rule that reaches *across* riders starts here.
    const VIEWER_OK =
      "@request.auth.id != '' && @request.auth.consent_state != 'pending' && @request.auth.consent_state != 'revoked'";

    // The same test applied to the rider being looked *at*, prefixed onto a
    // relation path (`""` for the users collection itself, `"user."` elsewhere).
    const subjectVisible = (p) =>
      `${p}consent_state != 'pending' && ${p}consent_state != 'revoked' && ${p}suspended = false`;

    /**
     * The three-way privacy model (plan §3 guarantee 1) as a reusable clause.
     * `p` is the path to the owning rider: `""` on `users`, `"user."` on a
     * collection that relates to one.
     *
     * - own record        → always
     * - `public`          → anyone, signed in or not
     * - `members`         → signed-in, consented riders only
     * - `private`         → nobody but the owner
     *
     * A consent-limited rider reads as `private` no matter what they chose,
     * and cannot see anyone else either.
     */
    const privacyRule = (p) => {
      const self = p === '' ? 'id = @request.auth.id' : `${p}id = @request.auth.id`;
      return [
        `(${self})`,
        `(${VIEWER_OK} && ${subjectVisible(p)} && (${p}privacy = 'public' || ${p}privacy = 'members'))`,
        `(@request.auth.id = '' && ${subjectVisible(p)} && ${p}privacy = 'public')`,
      ].join(' || ');
    };

    const OWN = 'user = @request.auth.id';
    const OWN_AND_CONSENTED = `${OWN} && ${VIEWER_OK}`;

    // --------------------------------------------------------------- helpers --

    const idOf = (name) => app.findCollectionByNameOrId(name).id;

    /**
     * Fields are described as PLAIN OBJECTS, not `new TextField(...)` instances.
     *
     * This is not a style choice and it must not be "tidied up". Under the JSVM
     * of PocketBase 0.39.x, a `new Collection({ fields: [new XField(...)] })`
     * saves, but its `createRule` and `deleteRule` can no longer resolve their
     * own collection's fields — `app.save()` fails with
     * `invalid left operand "user" - unknown field "user"`. Plain objects
     * validate correctly on every rule. `fields.add()`, used to extend the
     * built-in `users` collection, is the one place that *requires* an
     * instance, so `toField()` converts there and only there.
     */
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

    const created = () => ({ type: 'autodate', name: 'created', onCreate: true, onUpdate: false });
    const updated = () => ({ type: 'autodate', name: 'updated', onCreate: true, onUpdate: true });

    const text = (name, opts) =>
      Object.assign({ type: 'text', name, required: false, min: 0, max: 0 }, opts || {});
    const select = (name, values, opts) =>
      Object.assign({ type: 'select', name, values, maxSelect: 1, required: false }, opts || {});
    const bool = (name) => ({ type: 'bool', name, required: false });
    const num = (name, opts) =>
      Object.assign({ type: 'number', name, onlyInt: false, required: false }, opts || {});
    const date = (name, opts) => Object.assign({ type: 'date', name, required: false }, opts || {});
    const json = (name) => ({ type: 'json', name, maxSize: 0, required: false });
    const editor = (name) => ({ type: 'editor', name });
    const email = (name, opts) => Object.assign({ type: 'email', name }, opts || {});

    const FIELD_CLASSES = {
      text: TextField,
      number: NumberField,
      bool: BoolField,
      email: EmailField,
      date: DateField,
      select: SelectField,
      relation: RelationField,
      file: FileField,
      json: JSONField,
      editor: EditorField,
      autodate: AutodateField,
    };
    const toField = (def) => new FIELD_CLASSES[def.type](def);

    const save = (def) => {
      app.save(new Collection(def));
      return app.findCollectionByNameOrId(def.name);
    };

    // ============================================================== users ====
    //
    // The auth collection PocketBase ships with, extended into a rider profile.
    // `role`, `plan`, `consent_state` and `suspended` are written here but are
    // *guarded* in `hooks/10_users.pb.js`: no API rule path lets a rider grant
    // themselves any of them.

    const users = app.findCollectionByNameOrId('users');

    const userFields = [
      text('handle', { max: 20, pattern: '^[a-z0-9][a-z0-9_]{0,18}[a-z0-9]$' }),
      text('town', { max: 60 }),
      select('stance', ['regular', 'goofy', 'switch']),
      select('level', ['new', 'some', 'solid', 'send']),
      text('goal', { max: 40 }),
      text('goal_custom', { max: 60 }),
      text('avatar_key', { max: 40 }),
      select('privacy', ['public', 'members', 'private']),
      select('sports', ['scooter', 'skate'], { maxSelect: 2 }),
      num('streak', { onlyInt: true, min: 0 }),
      date('last_ride'),
      // IANA zone. Streaks, "rode today" and challenge boundaries are computed
      // in the rider's day, not UTC (plan §3).
      text('timezone', { max: 64 }),
      select('role', ['rider', 'staff']),
      select('plan', ['rookie', 'shredder', 'legend']),
      bool('onboarded'),
      bool('suspended'),
      // Age is a band, never a birth date (plan §3 / §6.2). The browser computes
      // the band and discards the date of birth; it never reaches the server.
      select('age_band', ['under_13', '13_15', '16_17', 'adult']),
      date('band_next_change_on'),
      date('age_declared_at'),
      text('country', { max: 6, pattern: '^[A-Z]{2}(-[A-Z0-9]{1,3})?$' }),
      select('consent_state', ['not_required', 'pending', 'granted', 'revoked']),
    ];
    for (const f of userFields) users.fields.add(toField(f));

    // Case-insensitive uniqueness, the way SQLite spells it. Handles appear in
    // URLs and share cards, so `@Nia` and `@nia` must not be two riders.
    users.addIndex('idx_users_handle_nocase', true, 'handle COLLATE NOCASE', "handle != ''");
    users.addIndex('idx_users_consent_state', false, 'consent_state', '');

    users.listRule = privacyRule('');
    users.viewRule = privacyRule('');
    users.createRule = ''; // sign-up is open; the guard hook owns what may be set
    users.updateRule = 'id = @request.auth.id';
    users.deleteRule = 'id = @request.auth.id';
    users.authRule = 'suspended = false';
    users.manageRule = null;

    app.save(users);

    // ============================================================== plans ====
    // Staff-editable capacity, not staff-editable achievement. `clip_cap_bytes`
    // and `unlocks_paid_tricks` are read by the hooks so the paywall and the
    // clip cap are tunable without a deploy (plan §6.6).
    save({
      type: 'base',
      name: 'plans',
      listRule: 'is_live = true',
      viewRule: 'is_live = true',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        text('slug', { required: true, max: 40 }),
        text('name', { required: true, max: 40 }),
        text('price_monthly', { max: 20 }),
        text('price_yearly', { max: 20 }),
        text('per', { max: 40 }),
        text('hue', { max: 9 }),
        text('pitch', { max: 240 }),
        json('perks'),
        json('missing'),
        bool('popular'),
        bool('unlocks_paid_tricks'),
        num('clip_cap_bytes', { onlyInt: true, min: 0 }),
        bool('is_live'),
        created(),
        updated(),
      ],
      indexes: ['CREATE UNIQUE INDEX `idx_plans_slug` ON `plans` (`slug`)'],
    });

    // ====================================================== subscriptions ====
    // Entitlements are ours, not Stripe's (plan §2.4). Written only by server
    // code; a consent-limited rider may not hold one at all (guarantee 4).
    save({
      type: 'base',
      name: 'subscriptions',
      listRule: OWN,
      viewRule: OWN,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        rel('user', 'users', { required: true, cascadeDelete: true }),
        rel('plan', 'plans', { required: true }),
        select('source', ['stripe', 'apple', 'google', 'staff']),
        select('status', ['active', 'trialing', 'past_due', 'canceled', 'expired']),
        text('external_id', { max: 120 }),
        date('period_end'),
        created(),
        updated(),
      ],
      indexes: ['CREATE INDEX `idx_subscriptions_user` ON `subscriptions` (`user`)'],
    });

    // =================================================== guardian_consents ====
    // Evidence, not state to be tidied away: revocation is a state and the
    // record is never hard-deleted while the account exists (plan §6.2).
    // The approval and revocation tokens are stored hashed and hidden, so they
    // never leave the server even to the rider.
    save({
      type: 'base',
      name: 'guardian_consents',
      listRule: OWN,
      viewRule: OWN,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        rel('user', 'users', { required: true, cascadeDelete: true }),
        email('guardian_email', { required: true }),
        text('approval_token_hash', { max: 128, hidden: true }),
        date('approval_expires'),
        // Revocation works forever, for a guardian who has no account (§6.2).
        text('revocation_token_hash', { max: 128, hidden: true }),
        date('requested'),
        date('granted'),
        date('revoked'),
        select('method', ['email_approval']),
        created(),
        updated(),
      ],
      indexes: ['CREATE INDEX `idx_guardian_consents_user` ON `guardian_consents` (`user`)'],
    });

    // ============================================================= tricks ====
    // Public: locked tricks stay visible throughout, never hidden (handoff).
    // The paywall lives on *progress*, not on the trick record.
    save({
      type: 'base',
      name: 'tricks',
      listRule: 'is_live = true',
      viewRule: 'is_live = true',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        text('slug', { required: true, max: 60 }),
        text('name', { required: true, max: 80 }),
        select('sport', ['scooter', 'skate'], { required: true }),
        select('cat', ['flat', 'street', 'park', 'hybrid', 'air'], { required: true }),
        num('diff', { required: true, onlyInt: true, min: 1, max: 5 }),
        editor('about'),
        editor('tips'),
        editor('fact'),
        // The handoff's nullable `free`: empty means "inherit from diff",
        // which a bool cannot express. Staff set it either way explicitly.
        select('free_override', ['free', 'paid']),
        bool('is_live'),
        created(),
        updated(),
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_tricks_slug` ON `tricks` (`slug`)',
        'CREATE INDEX `idx_tricks_sport` ON `tricks` (`sport`)',
      ],
    });

    // ====================================================== trick_prereqs ====
    // Same-sport constraint is enforced in a hook on every write path.
    save({
      type: 'base',
      name: 'trick_prereqs',
      listRule: '',
      viewRule: '',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        rel('trick', 'tricks', { required: true, cascadeDelete: true }),
        rel('prereq', 'tricks', { required: true, cascadeDelete: true }),
        created(),
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_trick_prereqs_edge` ON `trick_prereqs` (`trick`, `prereq`)',
      ],
    });

    // ===================================================== trick_progress ====
    // The `byId` map. Privacy-gated on read; paywalled on write by the hook.
    save({
      type: 'base',
      name: 'trick_progress',
      listRule: privacyRule('user.'),
      viewRule: privacyRule('user.'),
      createRule: OWN,
      updateRule: OWN,
      deleteRule: OWN,
      fields: [
        rel('user', 'users', { required: true, cascadeDelete: true }),
        rel('trick', 'tricks', { required: true, cascadeDelete: true }),
        select('stage', ['want', 'trying', 'some', 'most', 'every'], { required: true }),
        created(),
        updated(),
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_trick_progress_pair` ON `trick_progress` (`user`, `trick`)',
      ],
    });

    // ========================================================== trick_log ====
    // Append-only in the app's hands: create and delete own rows, never update
    // (plan §3, "log semantics, reconciled").
    save({
      type: 'base',
      name: 'trick_log',
      listRule: privacyRule('user.'),
      viewRule: privacyRule('user.'),
      createRule: OWN,
      updateRule: null,
      deleteRule: OWN,
      fields: [
        rel('user', 'users', { required: true, cascadeDelete: true }),
        rel('trick', 'tricks', { required: true, cascadeDelete: true }),
        select('stage', ['want', 'trying', 'some', 'most', 'every'], { required: true }),
        date('at'),
        // The UI says when a date is a backfill rather than pretending.
        bool('estimated'),
        created(),
      ],
      indexes: ['CREATE INDEX `idx_trick_log_user_trick` ON `trick_log` (`user`, `trick`)'],
    });

    // ======================================================== trick_notes ====
    // A rider's own notebook. Not a channel to anyone (plan §6.1) and not
    // visible to another rider at any privacy setting.
    save({
      type: 'base',
      name: 'trick_notes',
      listRule: OWN,
      viewRule: OWN,
      createRule: OWN,
      updateRule: OWN,
      deleteRule: OWN,
      fields: [
        rel('user', 'users', { required: true, cascadeDelete: true }),
        rel('trick', 'tricks', { required: true, cascadeDelete: true }),
        text('body', { max: 2000 }),
        created(),
        updated(),
      ],
      indexes: ['CREATE UNIQUE INDEX `idx_trick_notes_pair` ON `trick_notes` (`user`, `trick`)'],
    });

    // ============================================================== clips ====
    // Guarantee 2: never public. Owner-only on every rule, and the file field
    // is `protected`, so bytes come out only against a short-lived file token
    // minted for a request that still has to satisfy the view rule.
    save({
      type: 'base',
      name: 'clips',
      listRule: OWN,
      viewRule: OWN,
      createRule: OWN_AND_CONSENTED,
      updateRule: null,
      deleteRule: OWN,
      fields: [
        rel('user', 'users', { required: true, cascadeDelete: true }),
        rel('trick', 'tricks', { cascadeDelete: true }),
        {
          type: 'file',
          name: 'file',
          maxSelect: 1,
          maxSize: 209715200,
          protected: true,
          mimeTypes: ['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png'],
        },
        select('kind', ['video', 'photo']),
        num('size', { onlyInt: true, min: 0 }),
        date('at'),
        created(),
        updated(),
      ],
      indexes: ['CREATE INDEX `idx_clips_user` ON `clips` (`user`)'],
    });

    // =========================================================== stickers ====
    // The threshold `n` is editable by staff; the rule that reads it is code.
    save({
      type: 'base',
      name: 'stickers',
      listRule: 'is_live = true',
      viewRule: 'is_live = true',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        text('slug', { required: true, max: 40 }),
        text('name', { required: true, max: 40 }),
        // Empty sport = judged against the rider's combined stats.
        select('sport', ['scooter', 'skate']),
        text('hue', { max: 9 }),
        text('ico', { max: 20 }),
        text('cond', { max: 120 }),
        num('n', { onlyInt: true, min: 0 }),
        bool('is_live'),
        created(),
        updated(),
      ],
      indexes: ['CREATE UNIQUE INDEX `idx_stickers_slug` ON `stickers` (`slug`)'],
    });

    // ===================================================== rider_stickers ====
    // `createRule: null` is the whole point (plan §3): if a client could write
    // this row, achievements would be forgeable and the paywall a suggestion.
    // The award hook creates them. Riders may only mark one seen.
    save({
      type: 'base',
      name: 'rider_stickers',
      listRule: privacyRule('user.'),
      viewRule: privacyRule('user.'),
      createRule: null,
      updateRule: OWN,
      deleteRule: null,
      fields: [
        rel('user', 'users', { required: true, cascadeDelete: true }),
        rel('sticker', 'stickers', { required: true, cascadeDelete: true }),
        date('earned_at'),
        date('seen_at'),
        created(),
        updated(),
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_rider_stickers_pair` ON `rider_stickers` (`user`, `sticker`)',
      ],
    });

    // ============================================================== crews ====
    // Invite-only, no discovery (plan §6.1). You can read a crew only if you
    // are already in it, and a consent-limited rider is in none.
    // `crews` and `crew_members` reference each other, so the membership rules
    // are applied further down, once `crew_members` exists to be resolved.
    const MEMBER_OF_THIS_CREW = `crew_members_via_crew.user ?= @request.auth.id`;
    save({
      type: 'base',
      name: 'crews',
      listRule: null,
      viewRule: null,
      createRule: VIEWER_OK,
      updateRule: `${VIEWER_OK} && owner = @request.auth.id`,
      deleteRule: `${VIEWER_OK} && owner = @request.auth.id`,
      fields: [
        text('name', { required: true, max: 40 }),
        text('slug', { required: true, max: 40 }),
        rel('owner', 'users', { required: true }),
        text('hue', { max: 9 }),
        created(),
        updated(),
      ],
      indexes: ['CREATE UNIQUE INDEX `idx_crews_slug` ON `crews` (`slug`)'],
    });

    // ====================================================== crew_members ====
    // Created only by the server (crew creation, or the invite-redemption
    // route) — there is no client path into a crew that skips an invite.
    save({
      type: 'base',
      name: 'crew_members',
      listRule: null, // set below, once the back relation can resolve
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: OWN,
      fields: [
        rel('crew', 'crews', { required: true, cascadeDelete: true }),
        rel('user', 'users', { required: true, cascadeDelete: true }),
        select('role', ['owner', 'member']),
        date('joined'),
        created(),
      ],
      indexes: ['CREATE UNIQUE INDEX `idx_crew_members_pair` ON `crew_members` (`crew`, `user`)'],
    });

    // ====================================================== crew_invites ====
    save({
      type: 'base',
      name: 'crew_invites',
      listRule: `${VIEWER_OK} && crew.crew_members_via_crew.user ?= @request.auth.id`,
      viewRule: `${VIEWER_OK} && crew.crew_members_via_crew.user ?= @request.auth.id`,
      createRule: `${VIEWER_OK} && crew.crew_members_via_crew.user ?= @request.auth.id`,
      updateRule: null,
      deleteRule: `${VIEWER_OK} && crew.owner = @request.auth.id`,
      fields: [
        rel('crew', 'crews', { required: true, cascadeDelete: true }),
        text('code', { required: true, max: 24 }),
        rel('created_by', 'users'),
        date('expires'),
        num('uses', { onlyInt: true, min: 0 }),
        num('max_uses', { onlyInt: true, min: 0 }),
        created(),
      ],
      indexes: ['CREATE UNIQUE INDEX `idx_crew_invites_code` ON `crew_invites` (`code`)'],
    });

    // Now that `crew_members` exists, the membership rules can be resolved.
    // "You may read a crew only if you are already in it" is the whole of the
    // no-discovery position (plan §6.1) expressed as a rule.
    const crews = app.findCollectionByNameOrId('crews');
    crews.listRule = `${VIEWER_OK} && ${MEMBER_OF_THIS_CREW}`;
    crews.viewRule = `${VIEWER_OK} && ${MEMBER_OF_THIS_CREW}`;
    app.save(crews);

    const crewMembers = app.findCollectionByNameOrId('crew_members');
    crewMembers.listRule = `${VIEWER_OK} && crew.${MEMBER_OF_THIS_CREW}`;
    crewMembers.viewRule = `${VIEWER_OK} && crew.${MEMBER_OF_THIS_CREW}`;
    app.save(crewMembers);

    // ========================================================= challenges ====
    // State (`upcoming` / `live` / `past`) is derived from the dates and never
    // stored. One live challenge per sport is a hook, because SQLite has no
    // exclusion constraint (plan §3).
    save({
      type: 'base',
      name: 'challenges',
      listRule: '',
      viewRule: '',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        text('slug', { required: true, max: 40 }),
        select('sport', ['scooter', 'skate'], { required: true }),
        text('week', { max: 20 }),
        text('title', { required: true, max: 60 }),
        text('blurb', { max: 400 }),
        date('starts', { required: true }),
        date('ends', { required: true }),
        num('goal', { onlyInt: true, min: 0 }),
        text('reward', { max: 80 }),
        text('hue', { max: 9 }),
        text('riders_copy', { max: 60 }),
        text('verb', { max: 60 }),
        created(),
        updated(),
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_challenges_slug` ON `challenges` (`slug`)',
        'CREATE INDEX `idx_challenges_sport_dates` ON `challenges` (`sport`, `starts`, `ends`)',
      ],
    });

    // ====================================================== challenge_log ====
    save({
      type: 'base',
      name: 'challenge_log',
      listRule: OWN,
      viewRule: OWN,
      createRule: OWN,
      updateRule: null,
      deleteRule: OWN,
      fields: [
        rel('user', 'users', { required: true, cascadeDelete: true }),
        rel('challenge', 'challenges', { required: true, cascadeDelete: true }),
        date('at'),
        created(),
      ],
      indexes: ['CREATE INDEX `idx_challenge_log_user` ON `challenge_log` (`user`, `challenge`)'],
    });

    // ============================================================== spots ====
    // Rider submissions reach nobody until a human approves them (plan §6.1).
    // We store the spot's location, never the rider's (§6.4 standard 10).
    save({
      type: 'base',
      name: 'spots',
      listRule: `status = 'live' || (@request.auth.id != '' && submitted_by = @request.auth.id)`,
      viewRule: `status = 'live' || (@request.auth.id != '' && submitted_by = @request.auth.id)`,
      createRule: VIEWER_OK,
      updateRule: null,
      deleteRule: null,
      fields: [
        text('name', { required: true, max: 80 }),
        text('town', { max: 60 }),
        text('type', { max: 40 }),
        text('dist', { max: 20 }),
        num('lat'),
        num('lng'),
        select('sports', ['scooter', 'skate'], { maxSelect: 2 }),
        json('tags'),
        select('status', ['pending', 'live', 'rejected']),
        rel('submitted_by', 'users'),
        created(),
        updated(),
      ],
      indexes: ['CREATE INDEX `idx_spots_status` ON `spots` (`status`)'],
    });

    // ============================================================= events ====
    save({
      type: 'base',
      name: 'events',
      listRule: 'is_live = true',
      viewRule: 'is_live = true',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        text('slug', { required: true, max: 40 }),
        text('name', { required: true, max: 80 }),
        select('kind', ['Comp', 'Session', 'Class', 'Jam']),
        text('town', { max: 60 }),
        text('venue', { max: 80 }),
        date('date'),
        select('sports', ['scooter', 'skate'], { maxSelect: 2 }),
        text('level', { max: 60 }),
        text('price', { max: 40 }),
        text('spots_copy', { max: 40 }),
        text('blurb', { max: 400 }),
        bool('is_live'),
        created(),
        updated(),
      ],
      indexes: ['CREATE UNIQUE INDEX `idx_events_slug` ON `events` (`slug`)'],
    });

    // ================================================== event_attendance ====
    save({
      type: 'base',
      name: 'event_attendance',
      listRule: OWN,
      viewRule: OWN,
      createRule: OWN_AND_CONSENTED,
      updateRule: null,
      deleteRule: OWN,
      fields: [
        rel('user', 'users', { required: true, cascadeDelete: true }),
        rel('event', 'events', { required: true, cascadeDelete: true }),
        created(),
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_event_attendance_pair` ON `event_attendance` (`user`, `event`)',
      ],
    });

    // ====================================================== announcements ====
    save({
      type: 'base',
      name: 'announcements',
      listRule: `is_live = true && @request.auth.id != ''`,
      viewRule: `is_live = true && @request.auth.id != ''`,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        text('title', { required: true, max: 80 }),
        text('body', { max: 600 }),
        text('label', { max: 30 }),
        select('audience', ['all', 'plan', 'sport']),
        select('audience_plan', ['rookie', 'shredder', 'legend']),
        select('audience_sport', ['scooter', 'skate']),
        text('hue', { max: 9 }),
        date('starts'),
        date('ends'),
        bool('is_live'),
        created(),
        updated(),
      ],
    });

    save({
      type: 'base',
      name: 'announcement_dismissals',
      listRule: OWN,
      viewRule: OWN,
      createRule: OWN,
      updateRule: null,
      deleteRule: OWN,
      fields: [
        rel('user', 'users', { required: true, cascadeDelete: true }),
        rel('announcement', 'announcements', { required: true, cascadeDelete: true }),
        created(),
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_announcement_dismissals_pair` ON `announcement_dismissals` (`user`, `announcement`)',
      ],
    });

    // ============================================================ reports ====
    // The OSA wants a reporting route that works for people who are not
    // signed-up riders (plan §6.1/§6.5), so `reporter` is nullable and the
    // create rule is open. The hook pins `reporter`, `status` and `outcome`
    // server-side. `complaint_of` is the appeal route against our own
    // moderation decisions.
    const reports = save({
      type: 'base',
      name: 'reports',
      listRule: `@request.auth.id != '' && reporter = @request.auth.id`,
      viewRule: `@request.auth.id != '' && reporter = @request.auth.id`,
      createRule: '',
      updateRule: null,
      deleteRule: null,
      fields: [
        rel('reporter', 'users'),
        email('reporter_email'),
        select('subject_type', ['profile', 'clip', 'spot', 'other'], { required: true }),
        text('subject_id', { max: 40 }),
        select('reason', [
          'harassment',
          'unsafe',
          'illegal',
          'sexual',
          'self_harm',
          'spam',
          'other',
        ]),
        text('detail', { max: 2000 }),
        select('status', ['open', 'reviewing', 'actioned', 'dismissed']),
        text('outcome', { max: 600 }),
        created(),
        updated(),
      ],
      indexes: ['CREATE INDEX `idx_reports_status` ON `reports` (`status`)'],
    });

    // Self-link: an appeal against the handling of an earlier report.
    reports.fields.add(toField(rel('complaint_of', 'reports')));
    app.save(reports);

    // ========================================================== audit_log ====
    // Superuser-only from every direction. Written by the audit hook and by the
    // admin server actions (T16); never readable over the public API.
    save({
      type: 'base',
      name: 'audit_log',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        rel('actor', 'users'),
        select('actor_kind', ['rider', 'staff', 'superuser', 'guest', 'system']),
        text('actor_label', { max: 120 }),
        text('action', { required: true, max: 40 }),
        text('entity', { required: true, max: 60 }),
        text('entity_id', { max: 40 }),
        json('before'),
        json('after'),
        created(),
      ],
      indexes: ['CREATE INDEX `idx_audit_log_entity` ON `audit_log` (`entity`, `entity_id`)'],
    });
  },

  (app) => {
    // Down: drop what we made, and put `users` back the way PocketBase ships it.
    const names = [
      'audit_log',
      'reports',
      'announcement_dismissals',
      'announcements',
      'event_attendance',
      'events',
      'spots',
      'challenge_log',
      'challenges',
      'crew_invites',
      'crew_members',
      'crews',
      'rider_stickers',
      'stickers',
      'clips',
      'trick_notes',
      'trick_log',
      'trick_progress',
      'trick_prereqs',
      'tricks',
      'guardian_consents',
      'subscriptions',
      'plans',
    ];
    for (const name of names) {
      try {
        app.delete(app.findCollectionByNameOrId(name));
      } catch {
        // already gone
      }
    }

    const users = app.findCollectionByNameOrId('users');
    const added = [
      'handle',
      'town',
      'stance',
      'level',
      'goal',
      'goal_custom',
      'avatar_key',
      'privacy',
      'sports',
      'streak',
      'last_ride',
      'timezone',
      'role',
      'plan',
      'onboarded',
      'suspended',
      'age_band',
      'band_next_change_on',
      'age_declared_at',
      'country',
      'consent_state',
    ];
    for (const name of added) users.fields.removeByName(name);
    users.removeIndex('idx_users_handle_nocase');
    users.removeIndex('idx_users_consent_state');
    users.listRule = 'id = @request.auth.id';
    users.viewRule = 'id = @request.auth.id';
    users.createRule = '';
    users.updateRule = 'id = @request.auth.id';
    users.deleteRule = 'id = @request.auth.id';
    users.authRule = '';
    app.save(users);
  },
);
