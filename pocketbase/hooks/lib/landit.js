/// <reference path="../../.pb_data/types.d.ts" />

/**
 * Land It — server-side rules, the enforcement copy.
 *
 * `packages/core` is where the game rules are *defined* for the client; this is
 * where they are *enforced* (plan §3). The two are deliberately separate
 * implementations: a hook that imported the client's copy would be trusting the
 * same code the client can be made to lie about, and PocketBase's JSVM cannot
 * import the TypeScript package anyway. When a rule changes, both change.
 *
 * Every handler in `../*.pb.js` is serialised into its own isolated VM, so this
 * module is `require()`d *inside* each handler — never at file scope.
 */

const FREE_MAX_DIFF = 2;
const LANDED_STAGES = ['some', 'most', 'every'];
const SPORTS = ['scooter', 'skate', 'bmx'];
const CATEGORIES = ['flat', 'street', 'park', 'hybrid', 'air'];

/**
 * Handles appear in URLs and on share cards, so these can never belong to a
 * rider. Kept deliberately blunt: a name that could be read as Land It talking
 * to you, or as a route, is out.
 */
const RESERVED_HANDLES = [
  'about',
  'admin',
  'administrator',
  'api',
  'auth',
  'challenge',
  'challenges',
  'clip',
  'clips',
  'contact',
  'cookies',
  'crew',
  'crews',
  'event',
  'events',
  'help',
  'landit',
  'land-it',
  'legal',
  'login',
  'logout',
  'me',
  'mod',
  'moderator',
  'new',
  'null',
  'official',
  'plans',
  'pocketbase',
  'privacy',
  'profile',
  'report',
  'reports',
  'root',
  'safeguarding',
  'security',
  'settings',
  'signin',
  'signup',
  'spot',
  'spots',
  'staff',
  'sticker',
  'stickers',
  'superuser',
  'support',
  'system',
  'team',
  'terms',
  'trick',
  'tricks',
  'undefined',
  'you',
];

const HANDLE_PATTERN = /^[a-z0-9][a-z0-9_]{0,18}[a-z0-9]$/;

// Fields on `users` no client may set or change at any privacy level. Each has
// a default applied on create and is frozen thereafter except to a superuser or
// to server code that bypasses the request layer.
const USER_PROTECTED_DEFAULTS = {
  role: 'rider',
  plan: 'rookie',
  consent_state: 'not_required',
  suspended: false,
};

// Set once at sign-up (the browser computes the band, §6.2) and then immutable
// from the client — a rider who could edit their own band could walk out of the
// consent gate.
const USER_AGE_FIELDS = ['age_band', 'band_next_change_on', 'age_declared_at', 'country'];

/**
 * The weekly streak, in full. Server-owned: no client may write any of it.
 *
 * `streak` feeds two sticker rules, so while a rider could PATCH it they could
 * PATCH themselves an achievement — in a product whose plan says achievements
 * are never for sale (issue #8). The other four are the rest of the tuple
 * `logWeeklyRide` reads and writes; leaving any one of them client-writable
 * would let a rider rewrite the week the count belongs to and bank the same
 * week twice, which forges `streak` by a longer route.
 *
 * "I rode today" therefore cannot be a PATCH from the browser. It is a server
 * route that runs the rule and writes the result (T8). This list is what makes
 * that the only door.
 *
 * Owner-authorised additive-only exception (lekky, 2026-08-16) — see plan §7.
 */
const USER_STREAK_FIELDS = [
  'streak',
  'last_ride',
  'week_start',
  'rides_this_week',
  'last_qualifying_week',
];

// Zero-value defaults pinned on create, so a sign-up cannot arrive with a
// streak already on it.
const USER_STREAK_DEFAULTS = {
  streak: 0,
  last_ride: '',
  week_start: '',
  rides_this_week: 0,
  last_qualifying_week: '',
};

const CONSENT_LIMITED = ['pending', 'revoked'];

// ---------------------------------------------------------------- helpers --

function isConsentLimited(userRecord) {
  return CONSENT_LIMITED.indexOf(userRecord.getString('consent_state')) !== -1;
}

/** Is this trick behind the paywall? The handoff's nullable `free`, in full. */
function isTrickFree(trickRecord) {
  const override = trickRecord.getString('free_override');
  if (override === 'free') return true;
  if (override === 'paid') return false;
  return trickRecord.getInt('diff') <= FREE_MAX_DIFF;
}

/**
 * The rider's plan record. Fails *closed*: an unknown plan slug, or a `plans`
 * collection that has not been seeded yet, resolves to no entitlement at all
 * rather than to everything.
 */
function planFor(app, userRecord) {
  const slug = userRecord.getString('plan') || 'rookie';
  try {
    return app.findFirstRecordByFilter('plans', 'slug = {:slug}', { slug: slug });
  } catch {
    return null;
  }
}

function planUnlocksPaidTricks(app, userRecord) {
  const plan = planFor(app, userRecord);
  return !!plan && plan.getBool('unlocks_paid_tricks');
}

function clipCapBytes(app, userRecord) {
  const plan = planFor(app, userRecord);
  return plan ? plan.getInt('clip_cap_bytes') : 0;
}

function planIncludesInsights(app, userRecord) {
  const plan = planFor(app, userRecord);
  return !!plan && plan.getBool('includes_insights');
}

/**
 * Legend flair — the cosmetic tag beside a rider's name (plan §2.4, T11).
 *
 * Read from the plan record like every other entitlement, so staff can move the
 * perk without a deploy and nothing compares a plan id to the string `legend`.
 * It is also what lets the crew board show flair *without* the board payload
 * carrying a rider's plan: this resolves to a boolean on the server and the
 * plan itself never crosses to another rider.
 */
function planIncludesFlair(app, userRecord) {
  const plan = planFor(app, userRecord);
  return !!plan && plan.getBool('includes_flair');
}

function findAll(app, collection, filter, params) {
  return app.findRecordsByFilter(collection, filter, '', 0, 0, params || {});
}

// ----------------------------------------------------------- users guard --

function normaliseHandle(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase();
}

function assertHandleAllowed(handle) {
  if (!handle) return;
  if (!HANDLE_PATTERN.test(handle)) {
    throw new BadRequestError(
      'That handle will not work. Use 2–20 characters: lowercase letters, numbers and underscores, starting and ending with a letter or number.',
    );
  }
  if (RESERVED_HANDLES.indexOf(handle) !== -1) {
    throw new BadRequestError('That handle is reserved. Pick another one.');
  }
}

/**
 * Everything a client is not allowed to decide about its own account.
 *
 * `role` is the staff gate, `plan` is the paywall, `consent_state` is the
 * guardian gate and `suspended` is moderation — all four are worth forging, so
 * none of them is writable through the API by the account they describe. The
 * superuser dashboard (ours alone, not a rider login) is the only way in, which
 * is exactly what plan §3 asks for.
 *
 * The weekly streak (`USER_STREAK_FIELDS`) joined them on 2026-08-16: it feeds
 * two sticker rules, so a writable streak is a forgeable achievement (issue #8).
 */
function guardUserWrite(e, isCreate) {
  const record = e.record;
  const superuser = e.hasSuperuserAuth();

  // Safeguarding: a rider's email address is never published, and the rider is
  // not offered the choice. Plan §3, "email stays a hidden field".
  record.set('emailVisibility', false);

  const handle = normaliseHandle(record.getString('handle'));
  assertHandleAllowed(handle);
  record.set('handle', handle);

  if (isCreate) {
    // AADC standard 7 (plan §6.4): new profiles default to private.
    if (!record.getString('privacy')) record.set('privacy', 'private');

    if (!superuser) {
      for (const field of Object.keys(USER_PROTECTED_DEFAULTS)) {
        record.set(field, USER_PROTECTED_DEFAULTS[field]);
      }
      for (const field of Object.keys(USER_STREAK_DEFAULTS)) {
        record.set(field, USER_STREAK_DEFAULTS[field]);
      }
    }
    return;
  }

  if (superuser) return;

  const original = record.original();
  const frozen = Object.keys(USER_PROTECTED_DEFAULTS)
    .concat(USER_AGE_FIELDS)
    .concat(USER_STREAK_FIELDS);
  for (const field of frozen) {
    if (String(record.get(field)) !== String(original.get(field))) {
      throw new ForbiddenError(`"${field}" is not something an account can change about itself.`);
    }
  }
}

// ------------------------------------------------------------- insights --

/**
 * The progress insights opt-in (T9).
 *
 * Two rules, and they come from two different places:
 *
 * 1. **Off by default, decided by the server.** The insights panel is profiling
 *    under the Children's code (plan §6.4, standard 12), so a sign-up cannot
 *    arrive with it already on however the request was shaped. Same treatment
 *    `USER_PROTECTED_DEFAULTS` gives the four fields worth forging — for a
 *    different reason, since nobody gains by switching their own profiling on,
 *    but the standard is about the *default* and a default a client can set is
 *    not one.
 * 2. **Switching it on needs the entitlement.** Insights are Legend's
 *    (plan §2.4), resolved from the plan record rather than a plan id in the
 *    code, and read on the server rather than claimed by the client. Switching
 *    it *off* is always allowed: withdrawing consent can never be gated, and a
 *    rider who drops off Legend must still be able to turn profiling off.
 *
 * Request-layer with a superuser bypass, like the rest of the account guard:
 * staff moving a rider's plan and tidying the flag is a legitimate path, and
 * the flag is not a refusal a rider could gain anything by defeating — the
 * panel itself is drawn from the entitlement, server-side, every time.
 */
function guardInsightsOptIn(e, isCreate) {
  if (e.hasSuperuserAuth()) return;

  const record = e.record;

  if (isCreate) {
    record.set('insights_opt_in', false);
    return;
  }

  const before = record.original().getBool('insights_opt_in');
  const after = record.getBool('insights_opt_in');
  if (before === after || !after) return;

  if (!planIncludesInsights(e.app, record)) {
    throw new ForbiddenError('Progress insights are part of the Legend plan.');
  }
}

// -------------------------------------------------------------- paywall --

/**
 * Guarantee 3. Runs at the model layer, not the request layer, so it holds on
 * every write path into `trick_progress` — including one made with a superuser
 * token. There is no legitimate way for a rookie-plan rider to hold progress on
 * a paid trick, so there is no bypass.
 */
function enforcePaywall(app, record) {
  const trickId = record.getString('trick');
  const userId = record.getString('user');
  if (!trickId || !userId) return;

  const trick = app.findRecordById('tricks', trickId);
  if (isTrickFree(trick)) return;

  const user = app.findRecordById('users', userId);
  if (planUnlocksPaidTricks(app, user)) return;

  throw new ForbiddenError(
    `"${trick.getString('name')}" is a paid trick. Upgrade the plan to track it.`,
  );
}

// ------------------------------------------------------------- prereqs ---

/** Prerequisites never cross sports (handoff data model, plan §3). */
function enforcePrereqSameSport(app, record) {
  const trickId = record.getString('trick');
  const prereqId = record.getString('prereq');

  if (trickId === prereqId) {
    throw new BadRequestError('A trick cannot be its own prerequisite.');
  }

  const trick = app.findRecordById('tricks', trickId);
  const prereq = app.findRecordById('tricks', prereqId);
  if (trick.getString('sport') !== prereq.getString('sport')) {
    throw new BadRequestError(
      `Prerequisites never cross sports: "${prereq.getString('name')}" is ${prereq.getString('sport')}, "${trick.getString('name')}" is ${trick.getString('sport')}.`,
    );
  }
}

// ---------------------------------------------------------- challenges ---

/**
 * One live challenge per sport (plan §3). SQLite has no exclusion constraint,
 * so this hook *is* the constraint and therefore runs at the model layer, on
 * every write path.
 */
function enforceNoChallengeOverlap(app, record) {
  const sport = record.getString('sport');
  const starts = record.getDateTime('starts').string();
  const ends = record.getDateTime('ends').string();

  if (ends < starts) {
    throw new BadRequestError('A challenge cannot end before it starts.');
  }

  const clashes = findAll(
    app,
    'challenges',
    'sport = {:sport} && id != {:id} && starts <= {:ends} && ends >= {:starts}',
    { sport: sport, id: record.id, starts: starts, ends: ends },
  );

  if (clashes.length) {
    throw new BadRequestError(
      `That week overlaps "${clashes[0].getString('title')}". One live challenge per sport.`,
    );
  }
}

/** `YYYY-MM-DD`, `n` days from the one given. Pure arithmetic — no ICU needed. */
function shiftDay(day, n) {
  const ms =
    Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) +
    n * 86400000;
  const at = new Date(ms);
  const pad = (v) => (v < 10 ? '0' + v : String(v));
  return at.getUTCFullYear() + '-' + pad(at.getUTCMonth() + 1) + '-' + pad(at.getUTCDate());
}

/**
 * Is this challenge inside its running window, as far as the server can tell?
 *
 * Two things this deliberately does, both fixed in T12:
 *
 * **It compares calendar days, not instants.** `starts` and `ends` are stored
 * as dates, so PocketBase hands them back at midnight — comparing a full
 * timestamp against `ends` made a challenge unloggable for the whole of its
 * last day, which is the day a rider is most likely to be finishing it. Both
 * ends of the range are inclusive days, exactly as `challengeState` in
 * `@landit/core` reads them.
 *
 * **It allows a day either side.** The rider's calendar day is what decides
 * (plan §1, §3), and the JSVM cannot compute one: `Intl` is absent here and
 * `toLocaleString` accepts a `timeZone` and ignores it (LESSONS §5), so a
 * rider-local boundary is not something this file can honestly work out. A day
 * of tolerance covers every offset from UTC-12 to UTC+14, so a rider whose
 * Sunday night runs past UTC midnight is not refused a write their own screen
 * is still offering. The gate's job is to stop a client logging into *last
 * week*, and a day either side still does that — the precise boundary is the
 * client's, computed in the rider's own zone.
 */
function challengeIsLive(challenge, nowIso) {
  const today = String(nowIso).slice(0, 10);
  const from = shiftDay(challenge.getDateTime('starts').string().slice(0, 10), -1);
  const to = shiftDay(challenge.getDateTime('ends').string().slice(0, 10), 1);
  return from <= today && today <= to;
}

// --------------------------------------------------------------- clips ---

/**
 * Guarantee 2's write half and the §6.6 cap. Free riders cannot save clips at
 * all; paid riders are held to the cap on their *plan record*, so staff can
 * tune it without a deploy.
 */
function enforceClipCap(app, record) {
  const userId = record.getString('user');
  if (!userId) return;
  const user = app.findRecordById('users', userId);

  if (isConsentLimited(user)) {
    throw new ForbiddenError(
      'This account is waiting on a guardian’s approval and cannot save clips.',
    );
  }

  const cap = clipCapBytes(app, user);
  if (cap <= 0) {
    throw new ForbiddenError('Saving clips is part of the paid plans.');
  }

  const size = record.getInt('size');
  let used = 0;
  for (const clip of findAll(app, 'clips', 'user = {:user}', { user: userId })) {
    if (clip.id !== record.id) used += clip.getInt('size');
  }

  if (used + size > cap) {
    throw new ForbiddenError(
      `That would take this account past its ${Math.round(cap / 1073741824)}GB clip vault.`,
    );
  }
}

// ------------------------------------------------------- subscriptions ---

/**
 * Who may hold a subscription (T15; plan §6.2, and §3 guarantee 4).
 *
 * Three refusals, in the order they are worth making, all at the **model
 * layer** so they hold on every write path — the Stripe webhook's superuser
 * client included. The webhook is server code we wrote, which is exactly why it
 * is not trusted here: a webhook is a URL a stranger can POST to, and the only
 * thing standing between a forged event and a granted plan is what this
 * function refuses.
 *
 *  1. **Consent.** §3 guarantee 4 lists "hold a subscription" among the things
 *     a `pending` or `revoked` account cannot do. Nothing about paying changes
 *     that; if anything, taking a child's money while their guardian has not
 *     answered is the worst version of it. `60_ownership.pb.js` already refuses
 *     this on **create** and has since T2 — this is deliberately a second copy,
 *     because it also runs on **update**, and consent can be revoked after a
 *     subscription exists. Without the update half, a revoked rider's dormant
 *     row could be patched back to `active`.
 *  2. **The payer is an adult.** §6.2 requires the payer to confirm they are 18
 *     or over. A confirmation collected in a form and never checked again is a
 *     client-side rule, so it is stored on the record and re-read here.
 *  3. **A child does not buy their own subscription.** For a rider under 16 the
 *     upgrade routes to their guardian, so a subscription for that rider that
 *     records the *rider* as the payer did not come down the route the plan
 *     describes, whatever the checkout screen believed.
 *
 * The age band is read from the rider's record, never from the subscription:
 * `age_band` is set once at sign-up and frozen from the client
 * (`USER_AGE_FIELDS`), which is what makes it worth basing a refusal on.
 *
 * Deliberately **no superuser bypass**, on the same reasoning as
 * `enforcePaywall`: there is no legitimate way for any of these three to be
 * false, so there is nothing for a bypass to enable except a mistake.
 */
function enforceSubscriptionEligibility(app, record) {
  // Every constant lives inside the function: this module is `require()`d from
  // inside a handler that runs in its own isolated VM (see the file header).
  const GUARDIAN_ONLY_BANDS = ['under_13', '13_15'];

  const userId = record.getString('user');
  if (!userId) return;
  const user = app.findRecordById('users', userId);

  if (isConsentLimited(user)) {
    throw new ForbiddenError(
      'This account is waiting on a guardian’s approval and cannot hold a subscription.',
    );
  }

  if (!record.getBool('payer_adult_confirmed')) {
    throw new ForbiddenError('Whoever pays has to confirm they are 18 or over.');
  }

  // A missing band reads as under 16, the over-protecting direction — the same
  // fail-safe the consent table takes. `packages/core`'s `requiresGuardianPayer`
  // is the client-side copy of this line; when one changes, both change.
  const band = user.getString('age_band');
  const guardianOnly = !band || GUARDIAN_ONLY_BANDS.indexOf(band) !== -1;

  if (guardianOnly && record.getString('payer_kind') !== 'guardian') {
    throw new ForbiddenError(
      'A rider under 16 is upgraded by their parent or carer, not in the app.',
    );
  }
}

/**
 * Resolve `users.plan` from **our own** `subscriptions` rows (plan §2.4).
 *
 * The entitlement is never "what Stripe last said". Stripe is one of three
 * eventual sources — Apple and Google arrive with native apps — so the record
 * in this database is the answer and the webhook only files evidence for it.
 * Running the resolution here rather than in the webhook means a staff edit in
 * the superuser dashboard, a refund, an expiry written by a cron, and a Stripe
 * event all reach the rider's plan by the same path.
 *
 * `active` and `trialing` entitle; everything else, `past_due` included, falls
 * back to `rookie`. Plans are single-rider (§2.4), so "the most recent
 * entitling row" is the whole of the arbitration — no ranking of tiers, which
 * would be a fourth place a plan id could get compared to a string.
 *
 * Fails **closed**: a subscription pointing at a plan record that no longer
 * exists leaves the rider on `rookie` rather than on whatever it used to grant.
 */
function resolvePlanFromSubscriptions(app, userId) {
  const ENTITLING = ['active', 'trialing'];
  const FREE_PLAN = 'rookie';

  if (!userId) return;

  let user;
  try {
    user = app.findRecordById('users', userId);
  } catch {
    return; // The rider went away; the cascade delete has already tidied up.
  }

  const rows = findAll(app, 'subscriptions', 'user = {:user}', { user: userId });

  let best = null;
  for (const row of rows) {
    if (ENTITLING.indexOf(row.getString('status')) === -1) continue;
    if (!best || row.getDateTime('created').string() > best.getDateTime('created').string()) {
      best = row;
    }
  }

  let slug = FREE_PLAN;
  if (best) {
    try {
      slug = app.findRecordById('plans', best.getString('plan')).getString('slug') || FREE_PLAN;
    } catch {
      slug = FREE_PLAN;
    }
  }

  if (user.getString('plan') === slug) return;

  const before = user.getString('plan');
  user.set('plan', slug);
  app.save(user);

  writeAudit(app, {
    actorKind: 'system',
    action: 'plan_resolved',
    entity: 'users',
    entityId: userId,
    before: { plan: before },
    after: { plan: slug },
  });
}

// --------------------------------------------------------------- audit ---

function writeAudit(app, entry) {
  const collection = app.findCollectionByNameOrId('audit_log');
  const row = new Record(collection);
  row.set('actor', entry.actor || '');
  row.set('actor_kind', entry.actorKind || 'system');
  row.set('actor_label', entry.actorLabel || '');
  row.set('action', entry.action);
  row.set('entity', entry.entity);
  row.set('entity_id', entry.entityId || '');
  row.set('before', entry.before === undefined ? null : entry.before);
  row.set('after', entry.after === undefined ? null : entry.after);
  app.save(row);
  return row;
}

/** Who is making this request, in terms `audit_log` can store. */
function actorOf(e) {
  const auth = e.auth;
  if (!auth) return { actor: '', actorKind: 'guest', actorLabel: '' };
  if (auth.collection().name === '_superusers') {
    return { actor: '', actorKind: 'superuser', actorLabel: auth.getString('email') };
  }
  return {
    actor: auth.id,
    actorKind: auth.getString('role') === 'staff' ? 'staff' : 'rider',
    actorLabel: auth.getString('handle'),
  };
}

module.exports = {
  FREE_MAX_DIFF,
  LANDED_STAGES,
  SPORTS,
  CATEGORIES,
  RESERVED_HANDLES,
  HANDLE_PATTERN,
  CONSENT_LIMITED,
  USER_STREAK_FIELDS,
  actorOf,
  assertHandleAllowed,
  challengeIsLive,
  clipCapBytes,
  enforceClipCap,
  enforceNoChallengeOverlap,
  enforcePaywall,
  enforcePrereqSameSport,
  enforceSubscriptionEligibility,
  findAll,
  guardInsightsOptIn,
  guardUserWrite,
  isConsentLimited,
  isTrickFree,
  normaliseHandle,
  planFor,
  planIncludesFlair,
  planIncludesInsights,
  planUnlocksPaidTricks,
  resolvePlanFromSubscriptions,
  writeAudit,
};
