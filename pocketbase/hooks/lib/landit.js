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
  writeAudit,
};
