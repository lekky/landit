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
  'first-land': (s) => s.landed >= 1,
  'five-deep': (s, n) => s.landed >= (n || 5),
  'ten-deep': (s, n) => s.landed >= (n || 10),
  // Weeks, not days: the streak counts qualifying weeks (plan §1, issue #10).
  'week-one': (s, n) => s.streak >= (n || 4),
  'month-on': (s, n) => s.streak >= (n || 12),
  'first-clip': (s) => s.clips >= 1,
  challenger: (s) => s.challenges >= 1,
  'crew-up': (s) => s.crew,
  gnarly: (s, n) => s.hardLanded >= (n || 1),
  'every-time': (s, n) => s.mastered >= (n || 3),
  'both-feet': (s) => s.bothSports,

  'hop-master': (s) => s.bySlug['bunny-hop'] === 'every',
  'whip-club': (s) => landed(s, 'tailwhip'),
  // A count, never `catDone` — "every trick in the category" un-earns itself
  // when staff add one (issue #78).
  'flat-out': (s, n) => s.catCount.flat >= (n || 7),
  'street-cred': (s, n) => s.catCount.street >= (n || 3),
  'park-rat': (s, n) => s.catCount.park >= (n || 3),
  'grind-time': (s) => anyLanded(s, ['50-50', 'feeble', 'smith', 'icepick']),
  // `upside` is retired (issue #77) and has no entry here on purpose: a slug
  // with no rule is never awarded, so the server cannot badge a backflip even
  // if the record is switched live again.

  'ollie-up': (s) => s.bySlug['sk-ollie'] === 'every',
  'flip-club': (s) => landed(s, 'sk-kickflip'),
  'flat-track': (s, n) => s.catCount.flat >= (n || 10),
  'ledge-rat': (s, n) => countLanded(s, LEDGE_AND_RAIL) >= (n || 4),
  'bowl-rider': (s, n) => s.catCount.park >= (n || 3),
  'coping-time': (s) => landed(s, 'sk-axle-stall'),
  'tre-deep': (s) => landed(s, 'sk-tre-flip'),
};

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
    const rule = RULES[slug];
    if (!rule) continue;

    const sport = sticker.getString('sport');
    const scope = sport ? stats[sport] : stats.all;
    if (!scope) continue;

    let earned = false;
    try {
      earned = !!rule(scope, sticker.getInt('n'));
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

module.exports = { RULES, awardStickers, computeStats };
