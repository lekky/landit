/// <reference path="../../.pb_data/types.d.ts" />

/**
 * Sessions (T36) — the enforcement. Called from `../66_sessions.pb.js`.
 *
 * Everything here runs on the **model** hooks with **no superuser bypass**,
 * the split `45_video_links.pb.js` argues for: a count (the monthly quota, the
 * clip cap) is not something a rule can express, and a request-layer check is
 * one our own server actions could walk past. So a superuser client is held to
 * a rider's plan exactly as the rider is, which the tests prove.
 *
 * The pure parts — the clip parsers, the visibility normaliser, the month-key
 * bound, the quota decision and the stage promotion — are in
 * `session_rules.js`, where a Node test can run them beside `@landit/core`.
 * This file is the part that needs a database.
 */

/** A plan's `{ cap, unlimited }` from two fields. `null` plan grants nothing. */
function allowanceFrom(plan, capField, unlimitedField) {
  if (!plan) return { cap: 0, unlimited: false };
  const cap = plan.getInt(capField);
  return { cap: cap > 0 ? cap : 0, unlimited: plan.getBool(unlimitedField) };
}

function planSessionAllowance(app, user) {
  const lib = require(`${__hooks}/lib/landit.js`);
  return allowanceFrom(lib.planFor(app, user), 'session_month_cap', 'sessions_unlimited');
}

function planSessionClipAllowance(app, user) {
  const lib = require(`${__hooks}/lib/landit.js`);
  return allowanceFrom(lib.planFor(app, user), 'session_clip_cap', 'session_clips_unlimited');
}

/** Are these two riders in at least one crew together? */
function sharesCrew(app, a, b) {
  const lib = require(`${__hooks}/lib/landit.js`);
  const mine = lib.findAll(app, 'crew_members', 'user = {:user}', { user: a });
  for (let i = 0; i < mine.length; i += 1) {
    const together = lib.findAll(app, 'crew_members', 'crew = {:crew} && user = {:user}', {
      crew: mine[i].getString('crew'),
      user: b,
    });
    if (together.length) return true;
  }
  return false;
}

function countWhere(app, collection, filter, params) {
  const lib = require(`${__hooks}/lib/landit.js`);
  return lib.findAll(app, collection, filter, params).length;
}

/** A relation list as a plain JS array of strings. */
function idsOf(record, field) {
  const raw = record.getStringSlice(field) || [];
  const out = [];
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] && out.indexOf(raw[i]) === -1) out.push(raw[i]);
  }
  return out;
}

/**
 * Every rule a session write has to meet. Returns `{ grace, monthKey }` so the
 * create hook knows whether to spend the grace.
 *
 * In order, each a refusal no collection rule can make:
 *
 * 1. **Frozen fields.** `user`, `month_key` and `grace` never move after create.
 * 2. **The shape** — a start time that has happened, one of the four
 *    durations, a sport, a feel, a weather or none, text that fits.
 * 3. **Visibility normalised, never trusted** (D2): anything unrecognised is
 *    written as `private`.
 * 4. **Where**: the spot exists and is live, or is the rider's own submission —
 *    the favourites rule, and the same sentence for "hidden" and "never
 *    there". An event, if attached, is live. Checked when they change, so a
 *    spot staff later retire does not stop a rider rewording their notes.
 * 5. **Rode with** (D3): each newly tagged id is a rider who is not held
 *    behind the consent gate, not suspended, not the rider, and **in a crew
 *    with them**. A consent-limited rider cannot tag anybody — tagging reaches
 *    another rider (guarantee 4).
 * 6. **The month key** is one some timezone is in right now, or it is replaced
 *    with the UTC month (see `plausibleMonthKeys` in core for why that bound is
 *    enough).
 * 7. **The clip** (D4, D5): parsed and overwritten with `{ platform, id }`, and
 *    a clip being *added* is counted against the plan's session clip allowance.
 * 8. **The quota** (D6), on create only: under the cap, or on the grace, or
 *    refused. The ride was already saved before this request was made — that
 *    is `logSession` in `@landit/db` — so a refusal here costs the notes and
 *    never the streak.
 */
function enforceSession(app, record, isCreate) {
  const rules = require(`${__hooks}/lib/session_rules.js`);
  const video = require(`${__hooks}/lib/video.js`);
  const lib = require(`${__hooks}/lib/landit.js`);
  const R = rules.SESSION_REFUSALS;
  const before = isCreate ? null : record.original();

  // 1. Frozen.
  if (before) {
    if (before.getString('user') !== record.getString('user')) {
      throw new ForbiddenError('A session cannot be moved to another rider.');
    }
    record.set('month_key', before.getString('month_key'));
    record.set('grace', before.getBool('grace'));
  }

  const userId = record.getString('user');
  if (!userId) throw new BadRequestError('A session needs a rider.');
  let user;
  try {
    user = app.findRecordById('users', userId);
  } catch {
    throw new BadRequestError('A session needs a rider.');
  }

  const changed = (field) => !before || record.getString(field) !== before.getString(field);

  // 2. Shape.
  const started = record.getDateTime('started_at');
  if (started.isZero()) throw new BadRequestError(R.startedAt);
  if (changed('started_at')) {
    const limit = new DateTime().unix() + rules.SESSION_FUTURE_TOLERANCE_MINUTES * 60;
    if (started.unix() > limit) throw new BadRequestError(R.future);
  }
  if (rules.SESSION_DURATION_MINUTES.indexOf(record.getInt('duration_minutes')) === -1) {
    throw new BadRequestError(R.durationMinutes);
  }
  if (lib.SPORTS.indexOf(record.getString('sport')) === -1) throw new BadRequestError(R.sport);
  if (rules.SESSION_FEEL_IDS.indexOf(record.getString('feel')) === -1) {
    throw new BadRequestError(R.feel);
  }
  const weather = record.getString('weather');
  if (weather && rules.SESSION_WEATHER_IDS.indexOf(weather) === -1) {
    throw new BadRequestError(R.weather);
  }
  if (record.getString('aim').length > rules.SESSION_LIMITS.aimMax) {
    throw new BadRequestError(R.aim);
  }
  if (record.getString('notes').length > rules.SESSION_LIMITS.notesMax) {
    throw new BadRequestError(R.notes);
  }

  // 3. Visibility.
  record.set('visibility', rules.normaliseSessionVisibility(record.getString('visibility')));

  // 4. Where.
  if (changed('spot')) {
    const spotId = record.getString('spot');
    if (!spotId) throw new BadRequestError(R.spotId);
    let spot;
    try {
      spot = app.findRecordById('spots', spotId);
    } catch {
      throw new BadRequestError(R.spotHidden);
    }
    if (spot.getString('status') !== 'live' && spot.getString('submitted_by') !== userId) {
      throw new BadRequestError(R.spotHidden);
    }
  }
  if (changed('event') && record.getString('event')) {
    let event;
    try {
      event = app.findRecordById('events', record.getString('event'));
    } catch {
      throw new BadRequestError(R.eventHidden);
    }
    if (!event.getBool('is_live')) throw new BadRequestError(R.eventHidden);
  }

  // 5. Rode with.
  const tagged = idsOf(record, 'rode_with');
  record.set('rode_with', tagged);
  if (tagged.length > rules.SESSION_LIMITS.crewMax) throw new BadRequestError(R.crewIds);
  const already = before ? idsOf(before, 'rode_with') : [];
  for (let i = 0; i < tagged.length; i += 1) {
    const mateId = tagged[i];
    if (already.indexOf(mateId) !== -1) continue;
    if (mateId === userId || lib.isConsentLimited(user)) throw new BadRequestError(R.crewNotMate);
    let mate;
    try {
      mate = app.findRecordById('users', mateId);
    } catch {
      throw new BadRequestError(R.crewNotMate);
    }
    if (
      lib.isConsentLimited(mate) ||
      mate.getBool('suspended') ||
      !sharesCrew(app, userId, mateId)
    ) {
      throw new BadRequestError(R.crewNotMate);
    }
  }

  // 6. Month key (create only; frozen above on update).
  let monthKey = record.getString('month_key');
  if (!before) {
    const plausible = rules.plausibleMonthKeys(Date.now());
    if (plausible.indexOf(monthKey) === -1) {
      monthKey = new Date().toISOString().slice(0, 7);
    }
    record.set('month_key', monthKey);
  }

  // 7. Clip.
  const raw = record.getString('clip_id');
  const unchanged =
    before &&
    raw === before.getString('clip_id') &&
    record.getString('clip_platform') === before.getString('clip_platform');
  if (!unchanged) {
    if (!raw.trim()) {
      record.set('clip_id', '');
      record.set('clip_platform', '');
    } else {
      const parsed = rules.parseClipLink(raw, video.parseYouTubeVideoId);
      if (!parsed) {
        const problem = rules.clipLinkProblem(raw, video.parseYouTubeVideoId);
        throw new BadRequestError(problem === 'shortlink' ? R.clipShortlink : R.clipUnsupported);
      }
      record.set('clip_id', parsed.id);
      record.set('clip_platform', parsed.platform);

      // Only *adding* a clip spends the allowance; swapping one does not.
      if (!before || !before.getString('clip_id')) {
        const allowance = planSessionClipAllowance(app, user);
        if (!allowance.unlimited) {
          const held = countWhere(
            app,
            'sessions',
            "user = {:user} && clip_id != '' && id != {:id}",
            {
              user: userId,
              id: record.id || '',
            },
          );
          if (!rules.canAddSessionClip(allowance, held)) {
            throw new ForbiddenError(allowance.cap === 0 ? R.clipNotOnPlan : R.clipCap);
          }
        }
      }
    }
  }

  // 8. Quota.
  if (before) return { grace: false, monthKey: monthKey };

  const allowance = planSessionAllowance(app, user);
  const wantsGrace = record.getBool('grace');
  record.set('grace', false);
  if (allowance.unlimited) return { grace: false, monthKey: monthKey };

  const used = countWhere(app, 'sessions', 'user = {:user} && month_key = {:month}', {
    user: userId,
    month: monthKey,
  });
  const graceUsed = countWhere(app, 'session_grace', 'user = {:user}', { user: userId }) > 0;
  const decision = rules.sessionCreateDecision(allowance, used, graceUsed, wantsGrace);
  if (decision === 'refuse') {
    throw new ForbiddenError(wantsGrace && graceUsed ? R.graceUsed : R.quotaFull);
  }
  if (decision === 'grace') record.set('grace', true);
  return { grace: decision === 'grace', monthKey: monthKey };
}

/**
 * A trick entry on a session: whose it is, whether the plan allows the trick,
 * and the one-way stage promotion.
 *
 * - `user` is **copied from the session**, never taken from the body.
 * - `session` and `trick` never move after create.
 * - The paywall is `enforcePaywall`, reused: a Rookie rider cannot log a paid
 *   trick into a session any more than into `trick_log` (guarantee 3).
 * - `stage_from` and `stage_to` are the server's. Whatever a body sends is
 *   overwritten — with nothing on create, and with the stored values on update.
 * - **Promotion happens once**: on create when `landed`, or on the update that
 *   flips `landed` on, and never when the entry has already promoted. It writes
 *   `trick_progress` then `trick_log` — the order and shape of `setTrickStage`
 *   in `@landit/db` — through `app.save`, so the paywall and the sticker award
 *   hooks run on it as on any other stage change. Nothing on update or delete
 *   ever writes a lower stage back: unticking, removing the entry and deleting
 *   the session all leave the trick where the landing put it.
 */
function enforceSessionTrick(app, record, isCreate) {
  const rules = require(`${__hooks}/lib/session_rules.js`);
  const lib = require(`${__hooks}/lib/landit.js`);
  const before = isCreate ? null : record.original();

  const sessionId = record.getString('session');
  if (!sessionId) throw new BadRequestError('A trick entry needs a session.');
  let session;
  try {
    session = app.findRecordById('sessions', sessionId);
  } catch {
    throw new BadRequestError('A trick entry needs a session.');
  }

  if (before) {
    if (before.getString('session') !== sessionId) {
      throw new ForbiddenError('A trick entry cannot be moved to another session.');
    }
    if (before.getString('trick') !== record.getString('trick')) {
      throw new ForbiddenError('A trick entry cannot be moved to another trick.');
    }
  }

  const userId = session.getString('user');
  record.set('user', userId);
  const trickId = record.getString('trick');
  if (!trickId) throw new BadRequestError('A trick entry needs a trick.');

  lib.enforcePaywall(app, record);

  if (!before) {
    const entries = lib.findAll(app, 'session_tricks', 'session = {:session}', {
      session: sessionId,
    });
    if (entries.length >= rules.SESSION_LIMITS.tricksMax) {
      throw new BadRequestError(rules.SESSION_REFUSALS.tricks);
    }
    for (let i = 0; i < entries.length; i += 1) {
      if (entries[i].getString('trick') === trickId) {
        throw new BadRequestError('That trick is already on this session.');
      }
    }
  }

  // Server-owned stage fields.
  record.set('stage_from', before ? before.getString('stage_from') : '');
  record.set('stage_to', before ? before.getString('stage_to') : '');

  const flippedOn = record.getBool('landed') && (!before || !before.getBool('landed'));
  if (!flippedOn) return;

  let progress = null;
  try {
    progress = app.findFirstRecordByFilter('trick_progress', 'user = {:user} && trick = {:trick}', {
      user: userId,
      trick: trickId,
    });
  } catch {
    progress = null;
  }
  const current = progress ? progress.getString('stage') : null;
  const move = rules.sessionStagePromotion({
    landed: true,
    alreadyPromoted: before ? before.getString('stage_to') !== '' : false,
    current: current || null,
  });
  if (!move) return;

  if (!progress) {
    progress = new Record(app.findCollectionByNameOrId('trick_progress'));
    progress.set('user', userId);
    progress.set('trick', trickId);
  }
  progress.set('stage', move.stageTo);
  app.save(progress);

  const log = new Record(app.findCollectionByNameOrId('trick_log'));
  log.set('user', userId);
  log.set('trick', trickId);
  log.set('stage', move.stageTo);
  // The landing happened during the session, so that is its date.
  log.set('at', session.getString('started_at'));
  app.save(log);

  record.set('stage_from', move.stageFrom || '');
  record.set('stage_to', move.stageTo);
}

/**
 * What another rider is sent (D3): **only the "rode with" riders whose own
 * profile they could open**, and none of the owner's quota bookkeeping.
 *
 * Runs on every record PocketBase returns — list, view, expand, realtime — so
 * no screen has to remember to filter. Each tagged id is checked with
 * `canAccessRecord` against the **live** `users` view rule, so this can never
 * disagree with what that rider's profile says.
 */
function enrichSession(e) {
  const info = e.requestInfo;
  if (!info) return;
  if (info.hasSuperuserAuth()) return;

  const record = e.record;
  const viewer = info.auth;
  if (viewer && viewer.id === record.getString('user')) return;

  record.hide('month_key', 'grace');

  const tagged = idsOf(record, 'rode_with');
  if (!tagged.length) return;

  const rule = e.app.findCollectionByNameOrId('users').viewRule;
  const kept = [];
  for (let i = 0; i < tagged.length; i += 1) {
    let mate;
    try {
      mate = e.app.findRecordById('users', tagged[i]);
    } catch {
      continue;
    }
    let visible = false;
    try {
      visible = rule !== null && rule !== undefined && e.app.canAccessRecord(mate, info, rule);
    } catch {
      visible = false;
    }
    if (visible) kept.push(tagged[i]);
  }
  record.set('rode_with', kept);
}

module.exports = {
  enforceSession,
  enforceSessionTrick,
  enrichSession,
  planSessionAllowance,
  planSessionClipAllowance,
  sharesCrew,
};
