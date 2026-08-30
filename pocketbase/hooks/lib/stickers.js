/// <reference path="../../.pb_data/types.d.ts" />

/**
 * Sticker evaluation, server side.
 *
 * Plan §3: "Clients cannot create `rider_stickers` at all — otherwise stickers
 * are forgeable." So the rules live here and the award hook is the only writer.
 * The threshold `n` is read from the sticker record so staff can tune it; the
 * *rule* is code, deliberately (§3, `stickers`).
 *
 * A sticker with `sport` set is judged against that sport's stats alone; a
 * sticker with no sport is judged against the rider's combined stats.
 */

const LANDED_STAGES = ['some', 'most', 'every'];

/**
 * Everything the rules below can ask about a rider, computed fresh from the
 * database — never from anything the client sent.
 */
function computeStats(app, userId) {
  const lib = require(`${__hooks}/lib/landit.js`);

  const tricks = {};
  for (const t of lib.findAll(app, 'tricks', 'id != ""', {})) tricks[t.id] = t;

  const progress = lib.findAll(app, 'trick_progress', 'user = {:user}', { user: userId });

  const base = () => ({
    landed: 0,
    mastered: 0,
    hardLanded: 0,
    hardMastered: 0,
    bySlug: {},
    catCount: { flat: 0, street: 0, park: 0, hybrid: 0, air: 0 },
    catTotal: { flat: 0, street: 0, park: 0, hybrid: 0, air: 0 },
  });

  const all = base();
  // Discovered from the library rather than listed here. A literal pair
  // (`{ scooter, skate }`) is the two-sport assumption plan §3 forbids, and it
  // was here until T10: every BMX-scoped sticker would have been skipped
  // silently, because `stats[sport]` came back undefined.
  const perSport = {};
  const scopeFor = (sport) => {
    if (!sport) return null;
    perSport[sport] ??= base();
    return perSport[sport];
  };

  for (const id of Object.keys(tricks)) {
    const t = tricks[id];
    if (!t.getBool('is_live')) continue;
    const sport = t.getString('sport');
    const cat = t.getString('cat');
    all.catTotal[cat] = (all.catTotal[cat] || 0) + 1;
    const scope = scopeFor(sport);
    if (scope) scope.catTotal[cat] = (scope.catTotal[cat] || 0) + 1;
  }

  const landedSports = {};
  for (const p of progress) {
    const trick = tricks[p.getString('trick')];
    if (!trick) continue;
    const stage = p.getString('stage');
    const slug = trick.getString('slug');
    const sport = trick.getString('sport');
    const cat = trick.getString('cat');

    const scope = scopeFor(sport);

    all.bySlug[slug] = stage;
    if (scope) scope.bySlug[slug] = stage;

    if (stage === 'every') {
      all.mastered += 1;
      if (scope) scope.mastered += 1;
      if (trick.getInt('diff') >= 5) {
        all.hardMastered += 1;
        if (scope) scope.hardMastered += 1;
      }
    }

    if (LANDED_STAGES.indexOf(stage) === -1) continue;

    landedSports[sport] = true;
    all.landed += 1;
    all.catCount[cat] = (all.catCount[cat] || 0) + 1;
    if (trick.getInt('diff') >= 5) all.hardLanded += 1;

    if (scope) {
      scope.landed += 1;
      scope.catCount[cat] = (scope.catCount[cat] || 0) + 1;
      if (trick.getInt('diff') >= 5) scope.hardLanded += 1;
    }
  }

  const catDone = (scope) => {
    const done = {};
    for (const cat of Object.keys(scope.catTotal)) {
      done[cat] = scope.catTotal[cat] > 0 && scope.catCount[cat] >= scope.catTotal[cat];
    }
    return done;
  };
  all.catDone = catDone(all);
  for (const sport of Object.keys(perSport)) perSport[sport].catDone = catDone(perSport[sport]);

  const user = app.findRecordById('users', userId);

  /*
   * Award-era cross-sport maxima (T24). The single-sport kinds ask "has any
   * ONE sport reached the bar", which no single scope can answer, so the
   * maxima ride on the shared block and reach every scope.
   */
  const sportScopes = Object.keys(perSport).map((sport) => perSport[sport]);
  let maxSportLanded = 0;
  let maxSportCatsLanded = 0;
  const maxSportCatCount = { flat: 0, street: 0, park: 0, hybrid: 0, air: 0 };
  for (const scope of sportScopes) {
    if (scope.landed > maxSportLanded) maxSportLanded = scope.landed;
    let cats = 0;
    for (const cat of Object.keys(maxSportCatCount)) {
      if (scope.catCount[cat] > maxSportCatCount[cat]) maxSportCatCount[cat] = scope.catCount[cat];
      if (scope.catCount[cat] > 0) cats += 1;
    }
    if (cats > maxSportCatsLanded) maxSportCatsLanded = cats;
  }

  const created = user.getString('created');
  const createdMs = Date.parse(created);
  const plan = user.getString('plan');

  const shared = {
    streak: user.getInt('streak'),
    clips: lib.findAll(app, 'clips', 'user = {:user}', { user: userId }).length,
    crew: lib.findAll(app, 'crew_members', 'user = {:user}', { user: userId }).length > 0,
    // "Two or more", not "scooter and skate". `bothSports` in `@landit/core`
    // changed meaning in T21 when BMX arrived; this copy did not, so a rider on
    // scooter and BMX was shown the sticker by the client and refused it by the
    // server. Same fix, same reason (LESSONS §4).
    bothSports: Object.keys(landedSports).length >= 2,
    challenges: countFinishedChallenges(app, userId),

    /* --- award-era stats (T24), computed fresh like everything above --- */
    sportsLanded: Object.keys(landedSports).length,
    maxSportLanded,
    maxSportCatCount,
    maxSportCatsLanded,
    spotsApproved: lib.findAll(app, 'spots', "submitted_by = {:user} && status = 'live'", {
      user: userId,
    }).length,
    // "I'm going" records intent, never verified attendance — the award copy
    // says so too.
    eventsGoing: lib.findAll(app, 'event_attendance', 'user = {:user}', { user: userId }).length,
    crewOwnedSize: largestOwnedCrew(app, userId),
    profileComplete:
      user.getString('avatar_key') !== '' &&
      user.getString('level') !== '' &&
      user.getString('stance') !== '' &&
      (user.getString('goal') !== '' || user.getString('goal_custom') !== '') &&
      user.get('sports') !== null &&
      String(user.get('sports')) !== '',
    accountAgeDays: isNaN(createdMs) ? 0 : Math.floor((Date.now() - createdMs) / 86400000),
    // The launch window is historical fact: one month from 2026-08-17 live.
    // Mirrors FOUNDER_JOINED_BY in @landit/core.
    isFounder: created !== '' && created.slice(0, 10) <= '2026-09-17',
    planPaid: plan === 'shredder' || plan === 'legend',
    stageDropped: hasEverDroppedStage(app, userId),
  };

  const merge = (scope) => Object.assign({}, scope, shared);

  const out = { all: merge(all) };
  for (const sport of Object.keys(perSport)) out[sport] = merge(perSport[sport]);
  return out;
}

/** A challenge is "finished" when the rider logged it at least `goal` times. */
function countFinishedChallenges(app, userId) {
  const lib = require(`${__hooks}/lib/landit.js`);
  const counts = {};
  for (const row of lib.findAll(app, 'challenge_log', 'user = {:user}', { user: userId })) {
    const id = row.getString('challenge');
    counts[id] = (counts[id] || 0) + 1;
  }
  let finished = 0;
  for (const id of Object.keys(counts)) {
    try {
      const challenge = app.findRecordById('challenges', id);
      const goal = challenge.getInt('goal') || 1;
      if (counts[id] >= goal) finished += 1;
    } catch {
      // challenge deleted; ignore
    }
  }
  return finished;
}

/** Members in the largest crew this rider owns. */
function largestOwnedCrew(app, userId) {
  const lib = require(`${__hooks}/lib/landit.js`);
  let largest = 0;
  for (const crew of lib.findAll(app, 'crews', 'owner = {:user}', { user: userId })) {
    const members = lib.findAll(app, 'crew_members', 'crew = {:crew}', { crew: crew.id }).length;
    if (members > largest) largest = members;
  }
  return largest;
}

/**
 * Has this rider ever moved a trick DOWN a stage? Read from `trick_log`, the
 * append-only history, per trick in time order — the honesty the five stages
 * ask for, and the one thing `keeping-it-real` celebrates.
 */
function hasEverDroppedStage(app, userId) {
  const lib = require(`${__hooks}/lib/landit.js`);
  const RANK = { want: 0, trying: 1, some: 2, most: 3, every: 4 };
  const byTrick = {};
  for (const row of lib.findAll(app, 'trick_log', 'user = {:user}', { user: userId })) {
    const trick = row.getString('trick');
    byTrick[trick] ??= [];
    byTrick[trick].push({
      at: row.getString('at') || row.getString('created'),
      stage: row.getString('stage'),
    });
  }
  for (const trick of Object.keys(byTrick)) {
    const entries = byTrick[trick].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    for (let i = 1; i < entries.length; i++) {
      if (RANK[entries[i].stage] < RANK[entries[i - 1].stage]) return true;
    }
  }
  return false;
}

const landed = (stats, slug) => LANDED_STAGES.indexOf(stats.bySlug[slug]) !== -1;
const anyLanded = (stats, slugs) => slugs.some((slug) => landed(stats, slug));
const countLanded = (stats, slugs) => slugs.filter((slug) => landed(stats, slug)).length;

/** Skate's `street` category minus `sk-gap`, "Stair Set" — see issue #79. */
const LEDGE_AND_RAIL = [
  'sk-50-50',
  'sk-boardslide',
  'sk-noseslide',
  'sk-5-0',
  'sk-nosegrind',
  'sk-crooked',
  'sk-tailslide',
];

/**
 * `(stats, n) => boolean`, keyed by sticker slug. A sticker whose slug is not
 * here is never awarded — new stickers arrive with their rule, not without it.
 */
const RULES = {
  /*
   * T24 reshaped this map. The first block is the renamed-record bridge: the
   * award migration renames twelve legacy slugs onto their award equivalents,
   * and until the seed writes each record's `kind`, these slug-keyed rules are
   * what keeps those records awarding through the gap. Post-seed the `kind`
   * takes precedence (see `awardStickers`) and these are belt and braces.
   */
  'first-land': (s) => s.landed >= 1,
  'first-clip': (s) => s.clips >= 1,
  'rolling-deep': (s, n) => s.landed >= (n || 10),
  // Weeks, not days: the streak counts qualifying weeks (plan §1, issue #10).
  'hot-streak': (s, n) => s.streak >= (n || 4),
  'all-season': (s, n) => s.streak >= (n || 12),
  'first-challenge': (s) => s.challenges >= 1,
  'crewed-up': (s) => s.crew,
  'on-lock': (s, n) => s.mastered >= (n || 1),
  tailwhip: (s) => landed(s, 'tailwhip'),
  'bunny-hop': (s) => landed(s, 'bunny-hop'),
  'sk-kickflip': (s) => landed(s, 'sk-kickflip'),
  'sk-axle-stall': (s) => landed(s, 'sk-axle-stall'),
  'sk-tre-flip': (s) => landed(s, 'sk-tre-flip'),
  'sk-ollie': (s) => landed(s, 'sk-ollie'),
  // A count, never `catDone` — "every trick in the category" un-earns itself
  // when staff add one (issue #78).
  'flat-out': (s, n) => s.catCount.flat >= (n || 7),

  /*
   * The retired legacy stickers. Every record is `is_live: false` after the
   * seed, so none of these evaluates — kept because a rule that exists and a
   * record that is retired are independent locks. `upside` and `grind-time`
   * comments below are the record of why two of them read the way they do.
   */
  'five-deep': (s, n) => s.landed >= (n || 5),
  gnarly: (s, n) => s.hardLanded >= (n || 1),
  'both-feet': (s) => s.bothSports,
  'street-cred': (s, n) => s.catCount.street >= (n || 3),
  'park-rat': (s, n) => s.catCount.park >= (n || 3),
  'grind-time': (s) => anyLanded(s, ['50-50', 'feeble', 'smith', 'icepick']),
  // `upside` is retired (issue #77) and has no entry here on purpose: a slug
  // with no rule is never awarded, so the server cannot badge a backflip even
  // if the record is switched live again.
  'flat-track': (s, n) => s.catCount.flat >= (n || 10),
  'ledge-rat': (s, n) => countLanded(s, LEDGE_AND_RAIL) >= (n || 4),
  'bowl-rider': (s, n) => s.catCount.park >= (n || 3),
};

/**
 * The award-era rules (T24), one per record `kind` — the shape is code, the
 * parameters (`n`, `trick`, `cat`) come off the record. Mirrors `KIND_RULES`
 * in `@landit/core`; every kind is monotonic in the rider's own riding
 * (issue #78). `comeback` is transition-based — a fact about two writes, not
 * about current stats — so its rule here is never-true and `90_awards` in
 * `30_stickers.pb.js` grants it at the moment of the ride via
 * `awardSpecific`.
 *
 * A record with `n` unset falls back to the kind's shipped bar below, exactly
 * as the legacy rules' `(n || 5)` always has; kinds with no entry fall back to
 * Infinity, so clearing `n` on one of those locks the sticker rather than
 * awarding a milestone nobody reached.
 */
const KIND_DEFAULT_N = {
  'landed-count': 1,
  'mastered-count': 1,
  'hard-mastered': 1,
  challenges: 1,
  clips: 1,
  'spots-approved': 1,
  'events-going': 1,
  'account-age': 365,
};

const KIND_RULES = {
  trick: (s, p) => !!p.trick && landed(s, p.trick),
  'landed-count': (s, p) => s.landed >= bar('landed-count', p),
  'sport-landed-count': (s, p) => (s.maxSportLanded || 0) >= bar('sport-landed-count', p),
  'mastered-count': (s, p) => s.mastered >= bar('mastered-count', p),
  'hard-mastered': (s, p) => (s.hardMastered || 0) >= bar('hard-mastered', p),
  'sport-cat-count': (s, p) =>
    !!p.cat && ((s.maxSportCatCount || {})[p.cat] || 0) >= bar('sport-cat-count', p),
  streak: (s, p) => s.streak >= bar('streak', p),
  challenges: (s, p) => s.challenges >= bar('challenges', p),
  clips: (s, p) => s.clips >= bar('clips', p),
  'spots-approved': (s, p) => (s.spotsApproved || 0) >= bar('spots-approved', p),
  'events-going': (s, p) => (s.eventsGoing || 0) >= bar('events-going', p),
  crew: (s) => s.crew,
  'crew-owned': (s, p) => (s.crewOwnedSize || 0) >= bar('crew-owned', p),
  'sports-landed': (s, p) => (s.sportsLanded || 0) >= bar('sports-landed', p),
  'sport-cats-landed': (s, p) => (s.maxSportCatsLanded || 0) >= bar('sport-cats-landed', p),
  'profile-complete': (s) => s.profileComplete === true,
  'account-age': (s, p) => (s.accountAgeDays || 0) >= bar('account-age', p),
  founder: (s) => s.isFounder === true,
  'stage-drop': (s) => s.stageDropped === true,
  comeback: () => false,
  supporter: (s) => s.planPaid === true,
};

function bar(kind, params) {
  if (params.n) return params.n;
  return KIND_DEFAULT_N[kind] !== undefined ? KIND_DEFAULT_N[kind] : Infinity;
}

/**
 * Award every sticker the rider has newly earned. Idempotent: an existing
 * `rider_stickers` row is left alone, so a sticker is announced once and never
 * re-announced (`seen_at` is the rider's, not ours).
 *
 * Returns the slugs awarded on this pass.
 */
function awardStickers(app, userId) {
  const lib = require(`${__hooks}/lib/landit.js`);

  let stickers;
  try {
    stickers = lib.findAll(app, 'stickers', 'is_live = true', {});
  } catch {
    return [];
  }
  if (!stickers.length) return [];

  const held = {};
  for (const row of lib.findAll(app, 'rider_stickers', 'user = {:user}', { user: userId })) {
    held[row.getString('sticker')] = true;
  }

  const stats = computeStats(app, userId);
  const collection = app.findCollectionByNameOrId('rider_stickers');
  const awarded = [];

  for (const sticker of stickers) {
    if (held[sticker.id]) continue;

    const slug = sticker.getString('slug');

    // Kind first, deliberately: a record's `kind` is the award-era wiring the
    // seed writes, and it outranks the slug-keyed bridge rules so a migrated
    // record can change meaning by data alone. Same precedence as
    // `resolveStickerRule` in @landit/core.
    const kind = sticker.getString('kind');
    const kindRule = kind ? KIND_RULES[kind] : undefined;

    const sport = sticker.getString('sport');
    const scope = sport ? stats[sport] : stats.all;
    if (!scope) continue;

    let earned = false;
    try {
      if (kindRule) {
        earned = !!kindRule(scope, {
          n: sticker.getInt('n'),
          trick: sticker.getString('trick'),
          cat: sticker.getString('cat'),
        });
      } else if (RULES[slug]) {
        earned = !!RULES[slug](scope, sticker.getInt('n'));
      }
    } catch {
      earned = false;
    }
    if (!earned) continue;

    const row = new Record(collection);
    row.set('user', userId);
    row.set('sticker', sticker.id);
    row.set('earned_at', new DateTime().string());
    app.save(row);
    awarded.push(slug);
  }

  return awarded;
}

/**
 * Award one sticker by slug, if it is live and not already held. The path for
 * transition-based awards (`comeback`), whose condition is a fact about two
 * writes that no stats recomputation can see. Idempotent, like the pass above.
 */
function awardSpecific(app, userId, slug) {
  const lib = require(`${__hooks}/lib/landit.js`);

  let sticker;
  try {
    sticker = app.findFirstRecordByFilter('stickers', 'slug = {:slug} && is_live = true', { slug });
  } catch {
    return false;
  }

  const held = lib.findAll(app, 'rider_stickers', 'user = {:user} && sticker = {:sticker}', {
    user: userId,
    sticker: sticker.id,
  });
  if (held.length) return false;

  const collection = app.findCollectionByNameOrId('rider_stickers');
  const row = new Record(collection);
  row.set('user', userId);
  row.set('sticker', sticker.id);
  row.set('earned_at', new DateTime().string());
  app.save(row);
  return true;
}

module.exports = { RULES, KIND_RULES, awardStickers, awardSpecific, computeStats };
