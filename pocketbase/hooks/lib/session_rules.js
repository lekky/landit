/**
 * Session rules, server side (T36) — the enforcement copy of
 * `packages/core/src/rules/clip-links.ts` and the parts of
 * `packages/core/src/rules/sessions.ts` a hook needs.
 *
 * **Touches nothing outside the language**, like `video.js` and `labels.js`:
 * no `$app`, no `require`, no PocketBase globals, no `URL`, no `Intl`, no
 * lookbehind. That is what lets `pocketbase/tests/session-rules.test.ts` load
 * this file in Node and run it against `@landit/core` over the shared case
 * table, comparing behaviour rather than text. Give it a PocketBase dependency
 * and that load throws — the intended alarm.
 *
 * **The YouTube parser is injected, not copied.** `parseClipLink` takes
 * `parseYouTubeVideoId` as an argument: the hook hands it `lib/video.js`'s, and
 * the test hands it the same file's. A third copy of that parser would be one
 * more thing to drift.
 *
 * What must never grow here: a fourth host, a short-link resolver (a server
 * fetch of a rider-supplied URL), or a branch that pulls "something id-shaped"
 * out of arbitrary text. The answer is always a known platform and an anchored
 * id, or a refusal.
 */

const SESSION_LIMITS = { aimMax: 120, notesMax: 2000, crewMax: 10, tricksMax: 20 };
const SESSION_DURATION_MINUTES = [30, 60, 120, 180];
const SESSION_FEEL_IDS = ['sent', 'good', 'fine', 'rough', 'hurt'];
const SESSION_WEATHER_IDS = ['sun', 'cloud', 'rain', 'wind', 'cold'];
const SESSION_VISIBILITY_IDS = ['public', 'members', 'private'];
const CLIP_PLATFORM_IDS = ['youtube', 'instagram', 'tiktok'];
const SESSION_FUTURE_TOLERANCE_MINUTES = 60;
const MAX_UTC_OFFSET_HOURS = { behind: 12, ahead: 14 };

/** The sentences a rider reads. Identical to core's `SESSION_REFUSALS`; a test holds them. */
const SESSION_REFUSALS = {
  startedAt: 'Pick when you rode.',
  future: 'That time has not happened yet.',
  durationMinutes: 'Pick how long you rode for.',
  sport: 'Pick what you rode.',
  spotId: 'Pick where you rode.',
  spotHidden: 'That spot is not on the map.',
  eventHidden: 'That event is not on the calendar.',
  feel: 'Pick how it felt.',
  weather: 'That is not one of the weather options.',
  aim: 'An aim can be up to 120 characters.',
  notes: 'Notes can be up to 2000 characters.',
  crewIds: 'You can tag up to 10 riders.',
  crewNotMate: 'You can only tag riders who are in a crew with you.',
  tricks: 'A session can hold up to 20 tricks.',
  clipShortlink:
    'That is a TikTok short link. Open it, then copy the address of the video it lands on.',
  clipUnsupported: 'That is not a link to a YouTube, Instagram or TikTok video.',
  clipNotOnPlan: 'Clip links on sessions come with Shredder.',
  clipCap: 'That is all your session clip links. Remove one to add another.',
  quotaFull: 'That is all your sessions this month. Your ride and your streak are already saved.',
  graceUsed:
    'You have already used your one-off save. Your ride and your streak are already saved.',
};

// ------------------------------------------------------------- clip links --

const YOUTUBE_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
];
const INSTAGRAM_HOSTS = ['instagram.com', 'www.instagram.com', 'm.instagram.com'];
// Short links (`vm.`/`vt.tiktok.com`) are refused: their code is a redirect,
// and resolving one is a server fetch of a rider-supplied URL. See core.
const TIKTOK_HOSTS = ['tiktok.com', 'www.tiktok.com', 'm.tiktok.com'];
const TIKTOK_SHORT_HOSTS = ['vm.tiktok.com', 'vt.tiktok.com'];

const INSTAGRAM_ID_PATTERN = /^[A-Za-z0-9_-]{5,40}$/;
const TIKTOK_ID_PATTERN = /^[0-9]{15,21}$/;
const INSTAGRAM_PATH =
  /^\/(?:([A-Za-z0-9._]{1,30})\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,40})\/?$/;
const TIKTOK_VIDEO_PATH = /^\/@[A-Za-z0-9._]{1,24}\/video\/([0-9]{15,21})\/?$/;
const TIKTOK_OTHER_PATHS = [
  /^\/v\/([0-9]{15,21})(?:\.html)?\/?$/,
  /^\/embed\/v2\/([0-9]{15,21})\/?$/,
  /^\/embed\/([0-9]{15,21})\/?$/,
];

function splitLink(raw) {
  let text = String(raw === null || raw === undefined ? '' : raw).trim();
  if (!text) return null;

  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):\/\//.exec(text);
  if (scheme) {
    const name = scheme[1].toLowerCase();
    if (name !== 'http' && name !== 'https') return null;
    text = text.slice(scheme[0].length);
  } else if (text.indexOf(':') !== -1 && text.indexOf(':') < text.indexOf('/')) {
    return null;
  }

  const authorityEnd = text.search(/[/?#]/);
  const authority = authorityEnd === -1 ? text : text.slice(0, authorityEnd);
  if (authority.indexOf('@') !== -1) return null;

  const rest = authorityEnd === -1 ? '' : text.slice(authorityEnd);
  const hashAt = rest.indexOf('#');
  const beforeHash = hashAt === -1 ? rest : rest.slice(0, hashAt);
  const queryAt = beforeHash.indexOf('?');
  const path = queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt);

  return { host: authority.toLowerCase(), path: path || '/' };
}

function parseInstagramId(raw) {
  const link = splitLink(raw);
  if (!link || INSTAGRAM_HOSTS.indexOf(link.host) === -1) return null;
  const found = INSTAGRAM_PATH.exec(link.path);
  if (!found) return null;
  if (found[1] && found[2] !== 'p' && found[2] !== 'reel') return null;
  return INSTAGRAM_ID_PATTERN.test(found[3]) ? found[3] : null;
}

function parseTikTokId(raw) {
  const link = splitLink(raw);
  if (!link || TIKTOK_HOSTS.indexOf(link.host) === -1) return null;
  const video = TIKTOK_VIDEO_PATH.exec(link.path);
  if (video) return TIKTOK_ID_PATTERN.test(video[1]) ? video[1] : null;
  for (let i = 0; i < TIKTOK_OTHER_PATHS.length; i += 1) {
    const found = TIKTOK_OTHER_PATHS[i].exec(link.path);
    if (found) return TIKTOK_ID_PATTERN.test(found[1]) ? found[1] : null;
  }
  return null;
}

/**
 * `{ platform, id }` or `null`. `parseYouTubeVideoId` is `lib/video.js`'s,
 * passed in by the caller.
 */
function parseClipLink(raw, parseYouTubeVideoId) {
  const link = splitLink(raw);
  if (!link) return null;
  if (YOUTUBE_HOSTS.indexOf(link.host) !== -1) {
    const id = parseYouTubeVideoId(String(raw));
    return id ? { platform: 'youtube', id: id } : null;
  }
  if (INSTAGRAM_HOSTS.indexOf(link.host) !== -1) {
    const id = parseInstagramId(raw);
    return id ? { platform: 'instagram', id: id } : null;
  }
  if (TIKTOK_HOSTS.indexOf(link.host) !== -1) {
    const id = parseTikTokId(raw);
    return id ? { platform: 'tiktok', id: id } : null;
  }
  return null;
}

/** `null`, `'shortlink'` or `'unsupported'` — core's `clipLinkProblem`. */
function clipLinkProblem(raw, parseYouTubeVideoId) {
  if (!String(raw === null || raw === undefined ? '' : raw).trim()) return null;
  if (parseClipLink(raw, parseYouTubeVideoId)) return null;
  const link = splitLink(raw);
  if (link && TIKTOK_SHORT_HOSTS.indexOf(link.host) !== -1) return 'shortlink';
  return 'unsupported';
}

// ------------------------------------------------------------- visibility --

/** Exactly `public`, `members` or `private`; anything else is `private`. */
function normaliseSessionVisibility(raw) {
  return raw === 'public' || raw === 'members' ? raw : 'private';
}

// ------------------------------------------------------------------ month --

/** The `YYYY-MM` keys that are "now" in some timezone. Core's `plausibleMonthKeys`. */
function plausibleMonthKeys(nowMs) {
  const keys = [];
  const offsets = [-MAX_UTC_OFFSET_HOURS.behind, 0, MAX_UTC_OFFSET_HOURS.ahead];
  for (let i = 0; i < offsets.length; i += 1) {
    const key = new Date(nowMs + offsets[i] * 3600000).toISOString().slice(0, 7);
    if (keys.indexOf(key) === -1) keys.push(key);
  }
  return keys;
}

// ------------------------------------------------------------------ quota --

/**
 * `'allow'`, `'grace'` or `'refuse'` — core's `sessionCreateDecision` over
 * `sessionQuotaStatus`, flattened to plain arguments.
 */
function sessionCreateDecision(allowance, used, graceUsed, wantsGrace) {
  if (allowance.unlimited) return 'allow';
  if (used < allowance.cap) return 'allow';
  return wantsGrace && !graceUsed ? 'grace' : 'refuse';
}

/** Core's `canAddSessionClip`. */
function canAddSessionClip(allowance, held) {
  return allowance.unlimited || held < allowance.cap;
}

// -------------------------------------------------------------- promotion --

/** Core's `landedStageAfter`. */
function landedStageAfter(current) {
  if (current === 'some') return 'most';
  if (current === 'most') return 'every';
  if (current === 'every') return null;
  return 'some';
}

/** Core's `sessionStagePromotion`. Once, and never an inverse. */
function sessionStagePromotion(input) {
  if (!input.landed || input.alreadyPromoted) return null;
  const stageTo = landedStageAfter(input.current);
  if (!stageTo) return null;
  return { stageFrom: input.current ? input.current : null, stageTo: stageTo };
}

// ---------------------------------------------------------------- preview --

/** What a rider outside the owner-only preview reads if they write a session directly. */
const SESSIONS_PREVIEW_REFUSAL = 'Sessions are not open yet.';

/**
 * The owner-only preview (plan §7, T41): may this rider write a session?
 *
 * `previewId` is `LANDIT_SESSIONS_PREVIEW_ID` from the PocketBase instance.
 * **Empty means open** — the opposite of the web's `LANDIT_OWNER_ID` gate, and
 * on purpose: the integration suite runs one PocketBase with riders it makes,
 * and once sessions are released this must not linger as a second key. So the
 * live instance sets it for as long as the preview lasts.
 */
function sessionsPreviewAllows(userId, previewId) {
  const only = String(previewId === null || previewId === undefined ? '' : previewId).trim();
  return only === '' || String(userId) === only;
}

module.exports = {
  SESSIONS_PREVIEW_REFUSAL,
  sessionsPreviewAllows,
  CLIP_PLATFORM_IDS,
  SESSION_DURATION_MINUTES,
  SESSION_FEEL_IDS,
  SESSION_FUTURE_TOLERANCE_MINUTES,
  SESSION_LIMITS,
  SESSION_REFUSALS,
  SESSION_VISIBILITY_IDS,
  SESSION_WEATHER_IDS,
  MAX_UTC_OFFSET_HOURS,
  canAddSessionClip,
  clipLinkProblem,
  landedStageAfter,
  normaliseSessionVisibility,
  parseClipLink,
  parseInstagramId,
  parseTikTokId,
  plausibleMonthKeys,
  sessionCreateDecision,
  sessionStagePromotion,
};
