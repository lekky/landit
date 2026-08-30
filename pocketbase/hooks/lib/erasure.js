/// <reference path="../../.pb_data/types.d.ts" />

/**
 * Erasure and export — the two halves of what the privacy policy promises
 * (T18; plan §6.5).
 *
 * **Deletion is anonymise-and-retain.** Owner decision, Rachid, 2026-08-17, in
 * chat: rider-identifying fields are wiped and the account is made unusable;
 * `audit_log`, `guardian_consents` and any `reports` naming the rider are kept,
 * with the identity reduced to a stable pseudonym. The reasoning is in the
 * migration that adds `users.anonymised_at`, and the short version is that a
 * service whose moderation trail can be erased by the person it is about has no
 * moderation trail (plan §6.1).
 *
 * That leaves a line to draw, and it is drawn once, here:
 *
 * - **What the rider generated about themselves goes.** Progress, log, notes,
 *   clips, stickers, crew memberships, challenge and event participation,
 *   dismissed announcements. None of it is evidence of anything and all of it is
 *   theirs; a "deletion" that left a child's ride history in the database
 *   would not be one.
 * - **What records a decision, or somebody else's, stays.** The audit trail, the
 *   guardian consent records (§6.2 is explicit that revocation is a state and
 *   the record is evidence), reports filed by or about the account, the
 *   subscription rows a payment leaves behind, and any spot the rider submitted
 *   that is now live and being used by other riders.
 * - **Everything retained is relabelled.** `audit_log.actor_label` is rewritten
 *   to the pseudonym and `reports.reporter_email` is cleared, so nothing kept
 *   still spells out who the rider was. The account row remains as the anchor
 *   those foreign keys point at — which is what makes the retained records
 *   *pseudonymous* rather than merely orphaned.
 *
 * **The pseudonym is deterministic and stable**: `exrider_` plus the first eight
 * hex characters of the account id's SHA-256. The same account always produces
 * the same name, so two retained records that were the same rider still read as
 * the same rider, and no lookup table has to be kept to know it.
 *
 * **Export is a fixed field list, built server-side**, the same shape guarantee
 * 1 forced on the crew board (`80_routes.pb.js`). Every filter below is keyed on
 * the authenticated account and on nothing the request said, so there is no
 * parameter to tamper with — a rider cannot ask for somebody else's export
 * because there is nowhere to put the request.
 */

// --------------------------------------------------------------- pseudonym --

/** `exrider_<8 hex>`, stable for the life of the account id. */
function pseudonymFor(userId) {
  return 'exrider_' + $security.sha256(String(userId)).slice(0, 8);
}

/**
 * The rider's own content, by collection. Deleted on erasure and included in an
 * export, which is the same list read two ways: what a rider may take with them
 * is what we would otherwise be holding about them.
 */
const OWN_COLLECTIONS = [
  'trick_progress',
  'trick_log',
  'trick_notes',
  'clips',
  'rider_stickers',
  'crew_members',
  'challenge_log',
  'event_attendance',
  'announcement_dismissals',
];

/**
 * Kept, and relabelled. Named here so the list is one thing a reviewer can read
 * rather than a shape inferred from the code below.
 */
const RETAINED_COLLECTIONS = [
  'audit_log',
  'guardian_consents',
  'reports',
  'subscriptions',
  'spots',
];

// ----------------------------------------------------------------- erasure --

/**
 * Wipe the account and everything it generated, keep the trail, and say so in
 * the audit log.
 *
 * Deliberately **not** a delete of the `users` row. A cascade delete would take
 * `guardian_consents` and `subscriptions` with it (both are `cascadeDelete`),
 * and would leave `reports.reporter` and `audit_log.actor` pointing at nothing —
 * which turns a pseudonymous trail into an unreadable one.
 *
 * @param {core.App} app
 * @param {core.Record} rider
 * @param {{ actorKind?: string, actorLabel?: string }} by
 */
function anonymiseAccount(app, rider, by) {
  const lib = require(`${__hooks}/lib/landit.js`);

  const pseudonym = pseudonymFor(rider.id);
  const before = {
    handle: rider.getString('handle'),
    privacy: rider.getString('privacy'),
    suspended: rider.getBool('suspended'),
  };

  // 1. **The account first, and the deletions second.** The order is a fix, not
  //    a preference. `users.handle` and `users.email` both carry unique
  //    indexes, and both new values are derived from the account id — which is
  //    not a secret: it is in the "Report this profile" link on every profile a
  //    viewer can resolve. So the values are *predictable*, and anything
  //    predictable and unique can be squatted: sign up (the create rule is
  //    open), claim `erased-exrider_<hash>@landthetrick.invalid`, and the
  //    victim's erasure now fails on a unique index. With the deletions first,
  //    that failure left a rider with every trick, note and sticker destroyed
  //    and their name, email and working password intact — the worst of both,
  //    permanently, because every retry failed the same way.
  //
  //    Two changes close it. The identity is written and **saved before
  //    anything is destroyed**, so a collision aborts an erasure that has not
  //    yet taken anything; and the email is derived from the handle
  //    `uniquePseudonym` actually returned, so a squatter is stepped around
  //    rather than collided with.
  const handle = uniquePseudonym(app, rider.id, pseudonym);

  rider.set('handle', handle);
  rider.set('email', 'erased-' + handle + '@landthetrick.invalid');
  rider.set('emailVisibility', false);
  rider.set('verified', false);
  rider.set('name', '');
  rider.set('town', '');
  rider.set('goal', '');
  rider.set('goal_custom', '');
  rider.set('avatar_key', '');
  rider.set('avatar', '');
  rider.set('stance', '');
  rider.set('level', '');
  rider.set('timezone', '');
  rider.set('sports', []);
  rider.set('insights_opt_in', false);
  rider.set('streak', 0);
  rider.set('last_ride', '');
  rider.set('week_start', '');
  rider.set('rides_this_week', 0);
  rider.set('last_qualifying_week', '');

  // Private, suspended and stamped. `privacy` matters even on a wiped row: it is
  // what the view rules read, and a `public` shell is still a record another
  // rider can resolve.
  rider.set('privacy', 'private');
  rider.set('suspended', true);
  rider.set('anonymised_at', new DateTime().string());

  // The account cannot be signed into again, and every session already open
  // stops working: `refreshTokenKey` invalidates issued tokens, which is the
  // half a new password does not do.
  rider.setPassword($security.randomString(60));
  rider.refreshTokenKey();

  app.save(rider);

  // 2. The rider's own content. Cascade would have taken these anyway had this
  //    been a delete; doing it explicitly is what lets the row survive. Safe to
  //    run now: the account above is already unusable, so a failure here leaves
  //    a rider who is erased and has some rows left, never a rider who is
  //    identifiable and has none.
  let removed = 0;
  for (const collection of OWN_COLLECTIONS) {
    for (const row of lib.findAll(app, collection, 'user = {:user}', { user: rider.id })) {
      app.delete(row);
      removed += 1;
    }
  }

  // 3. The retained records, relabelled. `actor` and `reporter` still point at
  //    the row, so the link survives; what is removed is the plain-text name and
  //    address that would have spelled out who it was. The label is the handle
  //    that actually stuck, so a squatted pseudonym does not desynchronise the
  //    trail from the account it belongs to.
  for (const row of lib.findAll(app, 'audit_log', 'actor = {:user}', { user: rider.id })) {
    if (row.getString('actor_label') === handle) continue;
    row.set('actor_label', handle);
    app.save(row);
  }
  for (const row of lib.findAll(app, 'reports', 'reporter = {:user}', { user: rider.id })) {
    if (!row.getString('reporter_email')) continue;
    row.set('reporter_email', '');
    app.save(row);
  }

  lib.writeAudit(app, {
    actor: rider.id,
    actorKind: (by && by.actorKind) || 'rider',
    actorLabel: handle,
    action: 'account_anonymised',
    entity: 'users',
    entityId: rider.id,
    before: before,
    // No copy of what was wiped. An audit row saying what the name used to be
    // would undo the erasure in the one table erasure does not touch.
    after: { handle: handle, anonymised: true, records_removed: removed },
  });

  return { pseudonym: handle, records_removed: removed };
}

/**
 * The pseudonym, unless somebody is already sitting on it.
 *
 * **Both unique columns are checked, not just the handle.** The pseudonym is
 * derived from the account id, the account id is public, and `users.createRule`
 * is open — so a stranger can compute the value a given rider's erasure will
 * want and take it first, with an ordinary free sign-up. Checking only the
 * handle would step around a squatted handle and then collide on the email that
 * was derived from it, which is the same failure by a longer route.
 *
 * An erasure that cannot complete is the one outcome this route must not have,
 * so it keeps trying and ends on a random suffix rather than on an exception.
 */
function uniquePseudonym(app, userId, base) {
  const free = (candidate) => {
    const filter = 'handle = {:v} || email = {:email}';
    const params = { v: candidate, email: 'erased-' + candidate + '@landthetrick.invalid' };
    try {
      const clash = app.findFirstRecordByFilter('users', filter, params);
      return clash.id === userId;
    } catch {
      return true; // nobody holds either
    }
  };

  for (let n = 0; n < 20; n += 1) {
    const candidate = n === 0 ? base : base + n;
    if (free(candidate)) return candidate;
  }
  return base + $security.randomString(4).toLowerCase();
}

// ------------------------------------------------------------------ export --

/**
 * Everything we hold about the rider, as JSON a person can read.
 *
 * `publicExport()` is not used: it returns whatever the collection happens to
 * carry, which is how a later field lands in a download nobody decided to put
 * there. Each list below names its fields.
 *
 * **Written in words, not in row ids** (owner decision, Rachid, 2026-08-30, in
 * chat). Until that date this function answered a subject access request in
 * database keys — `"trick": "mew7o75ag0ig9jy"` on every row of a rider's
 * history, `"stage": "most"`, a `plans` id where the account said `legend` —
 * and a file whose owner cannot tell which trick they landed is complete
 * without being intelligible, which is the half of GDPR Art. 15 that matters to
 * the person holding it. So every relation is resolved to the name the app shows
 * for it, every stored code goes through `lib/labels.js`, and every timestamp is
 * spelled out. Nothing was removed from the disclosure to get there.
 *
 * **The per-row `id`s are gone, and `account.id` stays.** A `trick_log` row id
 * is a primary key: it identifies nothing the rider can act on and it is the
 * noise that made the file unreadable in the first place. The account id is the
 * opposite — it is the number to quote when writing to us about this download,
 * and it is already public on the rider's own profile.
 */
function exportFor(app, rider) {
  const lib = require(`${__hooks}/lib/landit.js`);
  const labels = require(`${__hooks}/lib/labels.js`);

  /**
   * The catalogue row's name, read once however many of the rider's rows point
   * at it — a hundred log entries on one trick are one query, not a hundred.
   *
   * A catalogue row that has since been retired or removed leaves the rider
   * holding the id rather than an empty string: an unreadable fact still beats a
   * missing one, and this is the only path in the export that can produce one.
   */
  const seen = {};
  const nameOf = (collection, id, field) => {
    if (!id) return '';
    const key = collection + '/' + id;
    if (seen[key] === undefined) {
      let label = '';
      try {
        label = app.findRecordById(collection, id).getString(field || 'name');
      } catch {
        label = '';
      }
      seen[key] = label || String(id);
    }
    return seen[key];
  };

  /** `users.plan` holds a slug, where `subscriptions.plan` holds a relation. */
  const planNamed = (slug) => {
    if (!slug) return '';
    try {
      const plan = app.findFirstRecordByFilter('plans', 'slug = {:slug}', { slug: String(slug) });
      return plan.getString('name') || String(slug);
    } catch {
      return String(slug);
    }
  };

  // Built by hand rather than with `.map`: `get` on a multi-select hands back
  // the Go slice PocketBase stores it in, and an array *method* is not something
  // goja promises on one. Indexing is.
  const storedSports = rider.get('sports') || [];
  const sportsRidden = [];
  for (let i = 0; i < storedSports.length; i += 1) {
    sportsRidden.push(labels.labelFor(labels.SPORT_LABELS, storedSports[i]));
  }

  const rows = (collection, build) =>
    lib.findAll(app, collection, 'user = {:user}', { user: rider.id }).map(build);

  const on = (row, field) => labels.readableDate(row.getString(field));
  const stageOf = (row) => labels.labelFor(labels.STAGE_LABELS, row.getString('stage'));
  const trickOf = (row) => nameOf('tricks', row.getString('trick'));

  return {
    exported_at: labels.readableDate(new DateTime().string()),
    account: {
      id: rider.id,
      email: rider.getString('email'),
      name: rider.getString('name'),
      handle: rider.getString('handle'),
      town: rider.getString('town'),
      country: rider.getString('country'),
      age_band: labels.labelFor(labels.AGE_BAND_LABELS, rider.getString('age_band')),
      age_declared_at: on(rider, 'age_declared_at'),
      // Added 2026-08-30 with the readability pass: a rider is entitled to know
      // the date their age band moves on its own, and it was held and never
      // disclosed. Same for the three weekly-streak fields below, which arrived
      // in `1786924800_weekly_streak_fields.js` and never reached this list.
      band_next_change_on: on(rider, 'band_next_change_on'),
      consent_state: labels.labelFor(labels.CONSENT_LABELS, rider.getString('consent_state')),
      stance: labels.labelFor(labels.STANCE_LABELS, rider.getString('stance')),
      level: labels.labelFor(labels.LEVEL_LABELS, rider.getString('level')),
      goal: labels.labelFor(labels.GOAL_LABELS, rider.getString('goal')),
      goal_custom: rider.getString('goal_custom'),
      avatar_key: rider.getString('avatar_key'),
      privacy: labels.labelFor(labels.PRIVACY_LABELS, rider.getString('privacy')),
      sports: sportsRidden,
      timezone: rider.getString('timezone'),
      plan: planNamed(rider.getString('plan')),
      insights_opt_in: rider.getBool('insights_opt_in'),
      streak: rider.getInt('streak'),
      week_start: rider.getString('week_start'),
      rides_this_week: rider.getInt('rides_this_week'),
      last_qualifying_week: rider.getString('last_qualifying_week'),
      last_ride: on(rider, 'last_ride'),
      created: on(rider, 'created'),
    },
    trick_progress: rows('trick_progress', (row) => ({
      trick: trickOf(row),
      stage: stageOf(row),
      updated: on(row, 'updated'),
    })),
    // `created` is dropped from the rows that carry an `at`: the two differ by
    // the milliseconds between landing a trick and the row being written, and
    // printing both said nothing twice. Where a row has no `at` — a challenge
    // joined, an event attended — `created` is the only date it has and stays.
    trick_log: rows('trick_log', (row) => ({
      trick: trickOf(row),
      stage: stageOf(row),
      at: on(row, 'at'),
      estimated: row.getBool('estimated'),
    })),
    trick_notes: rows('trick_notes', (row) => ({
      trick: trickOf(row),
      body: row.getString('body'),
      updated: on(row, 'updated'),
    })),
    // T15b: `video_id` and `visibility` are what a `clips` row now holds, and
    // `kind`/`size` are field names that stopped existing when the file field was
    // removed on 2026-08-17 (`1787270400_clips_no_hosting.js`) — `row.get` was
    // returning undefined for both. Named explicitly, per this function's own
    // rule that each list names its fields *so that* a new one is a decision
    // rather than an accident: a rider's download has to include the videos they
    // linked, or it is not everything we hold about them.
    //
    // The link is spelled out as well as the id, because the id is the half of a
    // YouTube link a rider cannot do anything with on its own.
    clips: rows('clips', (row) => ({
      trick: trickOf(row),
      video_id: row.getString('video_id'),
      video_url: row.getString('video_id')
        ? 'https://www.youtube.com/watch?v=' + row.getString('video_id')
        : '',
      visibility: row.getString('visibility'),
      at: on(row, 'at'),
    })),
    rider_stickers: rows('rider_stickers', (row) => ({
      sticker: nameOf('stickers', row.getString('sticker')),
      earned_at: on(row, 'earned_at'),
      seen_at: on(row, 'seen_at'),
    })),
    crew_members: rows('crew_members', (row) => ({
      crew: nameOf('crews', row.getString('crew')),
      role: row.getString('role'),
      joined: on(row, 'joined'),
    })),
    challenge_log: rows('challenge_log', (row) => ({
      challenge: nameOf('challenges', row.getString('challenge'), 'title'),
      created: on(row, 'created'),
    })),
    event_attendance: rows('event_attendance', (row) => ({
      event: nameOf('events', row.getString('event')),
      created: on(row, 'created'),
    })),
    subscriptions: rows('subscriptions', (row) => ({
      plan: nameOf('plans', row.getString('plan')),
      status: row.getString('status'),
      source: row.getString('source'),
      payer_kind: row.getString('payer_kind'),
      period_end: on(row, 'period_end'),
      created: on(row, 'created'),
    })),
    // The guardian's address is on this record and belongs in the rider's
    // download: a rider is entitled to know who was asked about them. The token
    // hashes are not — they are credentials, not data about anybody.
    guardian_consents: rows('guardian_consents', (row) => ({
      guardian_email: row.getString('guardian_email'),
      method: row.getString('method'),
      requested: on(row, 'requested'),
      granted: on(row, 'granted'),
      revoked: on(row, 'revoked'),
    })),
    // Reports the rider *filed*. Reports filed **about** them are deliberately
    // absent: a subject access request is not a way to find out who reported
    // you, and handing that over would make the reporting route unusable by the
    // child it exists for (plan §6.1).
    reports_filed: lib
      .findAll(app, 'reports', 'reporter = {:user}', { user: rider.id })
      .map((row) => ({
        subject_type: row.getString('subject_type'),
        reason: row.getString('reason'),
        detail: row.getString('detail'),
        status: row.getString('status'),
        outcome: row.getString('outcome'),
        created: on(row, 'created'),
      })),
  };
}

module.exports = {
  OWN_COLLECTIONS,
  RETAINED_COLLECTIONS,
  anonymiseAccount,
  exportFor,
  pseudonymFor,
};
