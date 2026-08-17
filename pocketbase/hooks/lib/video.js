/**
 * The YouTube-link parser, server side. Guarantee 2's first half (plan §3).
 *
 * **This file is a transcription of `packages/core/src/rules/video.ts`, and it
 * has one job the TypeScript copy cannot do: be the boundary.** The client
 * parses for the rider's benefit — so the box says "that is not a YouTube link"
 * while they are still looking at it — but `45_video_links.pb.js` parses again
 * on every write path and stores what *this* function returns. Nothing that has
 * not been through here reaches the database.
 *
 * **Why the two copies cannot drift.** This module deliberately touches nothing
 * outside the language: no `$app`, no `require`, no PocketBase globals, no
 * `URL`, no `URLSearchParams`, no `Intl`, no regex lookbehind. That is what lets
 * `pocketbase/tests/video-link-parser.test.ts` load it in **Node** with
 * `createRequire` and run it against `@landit/core`'s copy over the shared case
 * table in `packages/core/src/rules/video.cases.ts`, asserting the two return
 * identical values for every row. A drift test that compared the two files as
 * text would pass on two implementations that share a constant and behave
 * differently; this one compares behaviour, which is the property that matters.
 *
 * The abstinence list is also a correctness requirement in its own right. `Intl`
 * is simply absent from goja, and `Date.prototype.toLocaleString` accepts a
 * `timeZone` and silently ignores it (LESSONS §5) — a runtime that answers a
 * question it cannot answer is worse than one that throws. Assume the same of
 * `URL` here rather than finding out in production: string work behaves the same
 * in both engines, and it is not as if the grammar is hard.
 *
 * **What this file must never grow.** A second host. An "if it looks close
 * enough" branch. A fallback that extracts eleven legal characters from
 * somewhere in the middle of arbitrary text. Every one of those turns "we embed
 * YouTube" into "we embed whatever a rider can talk this function into", and the
 * only reason there is no moderation duty over rider video here is that the
 * answer is always a YouTube id or a refusal.
 */

/** Exactly eleven characters of URL-safe base64, anchored at both ends. */
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/** Matched whole, never by prefix or suffix — see the host cases in the table. */
const YOUTUBE_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
];

function idFromPath(host, path, query) {
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    return path.slice(1);
  }

  if (path === '/watch') {
    const found = /(?:^|&)v=([^&]*)/.exec(query);
    return found ? found[1] : null;
  }

  if (path.indexOf('/shorts/') === 0) return path.slice('/shorts/'.length);
  if (path.indexOf('/embed/') === 0) return path.slice('/embed/'.length);

  return null;
}

/**
 * The 11-character id inside a pasted YouTube link, or `null`.
 *
 * Keep this byte-for-byte equivalent in behaviour to
 * `packages/core/src/rules/video.ts#parseYouTubeVideoId`. If you change one,
 * change both and add a row to the shared case table; the test that loads both
 * will tell you immediately if you did not.
 */
function parseYouTubeVideoId(raw) {
  let text = String(raw === null || raw === undefined ? '' : raw).trim();
  if (!text) return null;

  // The bare id, which is also the stored form. First, so the update path — which
  // re-parses a value this function wrote — is the identity.
  if (YOUTUBE_ID_PATTERN.test(text)) return text;

  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):\/\//.exec(text);
  if (scheme) {
    const name = scheme[1].toLowerCase();
    if (name !== 'http' && name !== 'https') return null;
    text = text.slice(scheme[0].length);
  } else if (text.indexOf(':') !== -1 && text.indexOf(':') < text.indexOf('/')) {
    // A scheme without `//`: `javascript:`, `data:`, `mailto:`.
    return null;
  }

  const authorityEnd = text.search(/[/?#]/);
  const authority = authorityEnd === -1 ? text : text.slice(0, authorityEnd);
  // `https://www.youtube.com@evil.example/...` — refused, never unpicked.
  if (authority.indexOf('@') !== -1) return null;

  const rest = authorityEnd === -1 ? '' : text.slice(authorityEnd);
  const host = authority.toLowerCase();
  if (YOUTUBE_HOSTS.indexOf(host) === -1) return null;

  const hashAt = rest.indexOf('#');
  const beforeHash = hashAt === -1 ? rest : rest.slice(0, hashAt);
  const queryAt = beforeHash.indexOf('?');
  const path = queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt);
  const query = queryAt === -1 ? '' : beforeHash.slice(queryAt + 1);

  const candidate = idFromPath(host, path || '/', query);
  if (candidate === null || candidate === undefined) return null;
  return YOUTUBE_ID_PATTERN.test(candidate) ? candidate : null;
}

/**
 * Anything that is not exactly `members` is `private`.
 *
 * The fail-closed direction, and the same direction the `clips` view rule is
 * written in: it tests *for* `members` rather than testing for "not private", so
 * an empty, misspelt or unrecognised value is the most private state.
 */
function normaliseVideoVisibility(raw) {
  return raw === 'members' ? 'members' : 'private';
}

module.exports = {
  YOUTUBE_ID_PATTERN,
  normaliseVideoVisibility,
  parseYouTubeVideoId,
};
