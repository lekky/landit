/// <reference path="../../.pb_data/types.d.ts" />

/**
 * The guardian-consent rules, server side (plan §6.2, §6.3).
 *
 * This is the enforcement copy of `packages/core/src/rules/consent.ts`. The two
 * are separate implementations on purpose — a hook that imported the client's
 * copy would be trusting code the client can be made to lie about, and the JSVM
 * cannot import the TypeScript package anyway (`lib/landit.js` says the same).
 * **When one changes, both change.** `pocketbase/tests/consent-flow.test.ts`
 * exercises this copy over HTTP at the thresholds that differ — UK 13, EEA 16,
 * US declined — so a divergence in any of the three shows up as a red test
 * rather than as a child on the wrong side of the gate.
 *
 * The decision is made from the stored **age band**, never from a date of birth:
 * the browser computes the band and discards the date, so the server has never
 * seen one and cannot be made to want one. A threshold of 14 or 15 therefore
 * rounds up to 16 — the `13_15` band cannot resolve it, and rounding up is the
 * direction that over-protects rather than under-protects.
 *
 * Days are `YYYY-MM-DD` in UTC. A band boundary is a birthday, and a birthday is
 * not worth a timezone: the worst case is a rider moving band a few hours early
 * or late, against a rule whose granularity is three years.
 */

const DEFAULT_CONSENT_AGE = 13;
const EEA_CONSENT_AGE = 16;

// The EU 27 plus Iceland, Liechtenstein and Norway. Not the UK: it left, and its
// threshold is 13.
const EEA_COUNTRIES = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IS',
  'IT',
  'LI',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'NO',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
  'ES',
];

// Deliberately empty until counsel supplies cited values (plan §6.3). The table
// only ever lowers, so empty is the fail-safe state, not an unfinished one.
const EEA_LOWERED_CONSENT_AGES = {};

// COPPA wants verifiable parental consent, which is not an approval email. We
// decline instead of pretending otherwise (plan §6.3).
const UNDER_13_DECLINED_COUNTRIES = ['US'];

const AGE_BANDS = ['under_13', '13_15', '16_17', 'adult'];
const BAND_ENDS_AT = { under_13: 13, '13_15': 16, '16_17': 18, adult: null };
const NEXT_BAND = { under_13: '13_15', '13_15': '16_17', '16_17': 'adult', adult: null };

/** How long an approval link lives. The revocation link never expires (§6.2). */
const APPROVAL_WINDOW_DAYS = 7;

function countryOf(country) {
  return String(country || '')
    .trim()
    .toUpperCase()
    .slice(0, 2);
}

function consentAge(country) {
  const code = countryOf(country);
  const entry = EEA_LOWERED_CONSENT_AGES[code];
  if (entry !== undefined) return Math.min(entry, EEA_CONSENT_AGE);
  return EEA_COUNTRIES.indexOf(code) !== -1 ? EEA_CONSENT_AGE : DEFAULT_CONSENT_AGE;
}

function isAgeBand(band) {
  return AGE_BANDS.indexOf(String(band || '')) !== -1;
}

function consentRequired(country, band) {
  const threshold = consentAge(country);
  if (band === 'under_13') return threshold > 12;
  if (band === '13_15') return threshold > 13;
  if (band === '16_17') return threshold > 16;
  return false;
}

/** Is this sign-up refused outright rather than routed to a guardian? */
function signupDeclined(country, band) {
  return band === 'under_13' && UNDER_13_DECLINED_COUNTRIES.indexOf(countryOf(country)) !== -1;
}

/** The state a fresh account starts in. Never `granted`: only a guardian grants. */
function initialConsentState(country, band) {
  return consentRequired(country, band) ? 'pending' : 'not_required';
}

// ------------------------------------------------------------------ days --

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` out of whatever a date field hands back. Empty when unset. */
function dayOf(value) {
  const text = String(value == null ? '' : value);
  return text.length >= 10 ? text.slice(0, 10) : '';
}

/**
 * `day` plus `years`. A 29 February date rolls to 1 March in a common year,
 * which is the direction that never lets a rider out of the gate early.
 */
function addYears(day, years) {
  const year = Number(day.slice(0, 4)) + years;
  const month = Number(day.slice(5, 7));
  const date = Number(day.slice(8, 10));
  return new Date(Date.UTC(year, month - 1, date)).toISOString().slice(0, 10);
}

/**
 * Move a rider on if their boundary has passed — "consent lapses on the 13th
 * birthday without anyone doing anything" (§6.2).
 *
 * Needs no date of birth: boundaries are three years apart (13 → 16) then two
 * (16 → 18), so the next is arithmetic on the last. Loops, because an account
 * can come back several boundaries late.
 */
function advanceBand(band, nextChangeOn, on) {
  let current = isAgeBand(band) ? band : '';
  let next = dayOf(nextChangeOn);
  const day = on || today();

  if (!current || !next) return { band: current, bandNextChangeOn: next, changed: false };

  let changed = false;
  while (next && next <= day) {
    const following = NEXT_BAND[current];
    if (!following) {
      next = '';
      break;
    }
    const leaving = BAND_ENDS_AT[current];
    const ending = BAND_ENDS_AT[following];
    current = following;
    next = ending === null || leaving === null ? '' : addYears(next, ending - leaving);
    changed = true;
  }

  return { band: current, bandNextChangeOn: next, changed: changed };
}

// ----------------------------------------------------------------- tokens --

/**
 * A link token and the hash we keep.
 *
 * Only the hash is stored, and the field is `hidden`, so a token that reaches a
 * guardian's inbox exists nowhere else — a database read cannot mint one and
 * neither can a rider reading their own consent record.
 */
function mintToken() {
  const token = $security.randomString(43);
  return { token: token, hash: $security.sha256(token) };
}

function hashToken(token) {
  return $security.sha256(String(token || ''));
}

/** When an approval link minted now runs out. */
function approvalExpiry() {
  const at = new Date(Date.now() + APPROVAL_WINDOW_DAYS * 86400000);
  // PocketBase stores dates as `YYYY-MM-DD HH:MM:SS.sssZ`.
  return at.toISOString().replace('T', ' ');
}

module.exports = {
  AGE_BANDS,
  APPROVAL_WINDOW_DAYS,
  DEFAULT_CONSENT_AGE,
  EEA_CONSENT_AGE,
  EEA_COUNTRIES,
  EEA_LOWERED_CONSENT_AGES,
  UNDER_13_DECLINED_COUNTRIES,
  addYears,
  advanceBand,
  approvalExpiry,
  consentAge,
  consentRequired,
  countryOf,
  dayOf,
  hashToken,
  initialConsentState,
  isAgeBand,
  mintToken,
  signupDeclined,
  today,
};
