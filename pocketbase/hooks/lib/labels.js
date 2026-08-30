/**
 * The words a rider's data export is written in.
 *
 * **Why this file exists.** A subject access request is answered with a file a
 * person opens and reads, and until 2026-08-30 ours answered it in database
 * codes: `"trick": "mew7o75ag0ig9jy"` six times over, `"stage": "most"`,
 * `"plan": "ssgrm0if423zle0"`. Every fact the rider is entitled to was in there
 * and none of it was legible. GDPR Art. 15 asks for an *intelligible* form and
 * Art. 12 for plain language; a download whose owner cannot tell which trick
 * they landed does not meet either, and the audience here is children.
 *
 * **It touches nothing outside the language** — no `$app`, no PocketBase
 * globals, no `Intl`, no `Date`. That is deliberate and load-bearing:
 * `tests/export-labels.test.ts` loads this file in Node the same way
 * `video-link-parser.test.ts` loads `lib/video.js`, and runs every map below
 * against the `packages/core` data it mirrors. Give this file a PocketBase
 * dependency and that load throws, which is the intended alarm — the maps would
 * no longer be provably the same words the app shows.
 *
 * The mirrors and their sources:
 * - `STAGE_LABELS`   ← `packages/core/src/data/stages.ts`
 * - `SPORT_LABELS`   ← `packages/core/src/data/sports.ts`
 * - `STANCE_LABELS`, `LEVEL_LABELS`, `GOAL_LABELS`, `PRIVACY_LABELS`
 *                    ← `packages/core/src/data/profile.ts`
 *
 * `AGE_BAND_LABELS` and `CONSENT_LABELS` have no core counterpart — the app
 * never shows either value as a word — so they are written here and pinned by
 * the schema's own select options rather than by a mirror test.
 */

/** `packages/core/src/data/stages.ts`. */
const STAGE_LABELS = {
  want: 'Want to learn',
  trying: 'Learning',
  some: 'Sometimes',
  most: 'Most times',
  every: 'Every time',
};

/** `packages/core/src/data/sports.ts`. */
const SPORT_LABELS = {
  scooter: 'Scooter',
  skate: 'Skateboard',
  bmx: 'BMX',
};

/** `packages/core/src/data/profile.ts`. */
const STANCE_LABELS = {
  regular: 'Regular',
  goofy: 'Goofy',
  switch: 'Both',
};

/** `packages/core/src/data/profile.ts`. */
const LEVEL_LABELS = {
  new: 'Just started',
  some: 'Got a few tricks',
  solid: 'Park regular',
  send: 'Sending it',
};

/** `packages/core/src/data/profile.ts`. */
const GOAL_LABELS = {
  first: 'Land my first trick',
  whip: 'Get a tailwhip',
  kickflip: 'Land a kickflip',
  street: 'Ride street properly',
  flip: 'Go upside down',
  bowl: 'Drop in and ride bowls',
  all: 'Tick off the whole list',
};

/** `packages/core/src/data/profile.ts`. */
const PRIVACY_LABELS = {
  public: 'Public',
  members: 'Riders only',
  private: 'Private',
};

/** The `users.age_band` select, spelled out. No core counterpart. */
const AGE_BAND_LABELS = {
  under_13: 'Under 13',
  '13_15': '13 to 15',
  '16_17': '16 or 17',
  adult: '18 or over',
};

/** The `users.consent_state` select, spelled out. No core counterpart. */
const CONSENT_LABELS = {
  not_required: 'Not required',
  pending: 'Waiting for a guardian',
  granted: 'Granted by a guardian',
  revoked: 'Withdrawn by a guardian',
};

/**
 * The word for a stored code, or the code itself.
 *
 * **The fallback is the point.** A select option added later — a fourth sport, a
 * sixth stage — has no entry here, and the rider still has to get the fact. An
 * unmapped value comes back as it was stored rather than as an empty string,
 * so the worst this file can do to an export is leave one value looking the way
 * the whole export used to.
 */
function labelFor(map, value) {
  const key = String(value == null ? '' : value);
  if (!key) return '';
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : key;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * `2026-08-18 16:31:37.983Z` becomes `18 Aug 2026, 16:31 UTC`.
 *
 * Parsed with a regex rather than with `Date`, because this file may not reach
 * for a runtime object it cannot promise goja and Node agree on, and because
 * PocketBase's stored layout is a fixed hybrid — a space where ISO-8601 wants a
 * `T` — that no parser reads the same way twice.
 *
 * **The zone is named, not converted.** Every timestamp PocketBase stores is
 * UTC; rendering one in the rider's own timezone would be friendlier and would
 * also be this function quietly inventing a fact about when something happened.
 * Saying `UTC` is honest and costs the reader three characters. An empty or
 * unrecognised value comes back empty, which is what an unset date already was.
 */
function readableDate(raw) {
  const stamp = String(raw == null ? '' : raw);
  const parts = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(stamp);
  if (!parts) return '';
  const month = MONTHS[Number(parts[2]) - 1];
  if (!month) return '';
  return (
    Number(parts[3]) + ' ' + month + ' ' + parts[1] + ', ' + parts[4] + ':' + parts[5] + ' UTC'
  );
}

module.exports = {
  AGE_BAND_LABELS,
  CONSENT_LABELS,
  GOAL_LABELS,
  LEVEL_LABELS,
  PRIVACY_LABELS,
  SPORT_LABELS,
  STAGE_LABELS,
  STANCE_LABELS,
  labelFor,
  readableDate,
};
