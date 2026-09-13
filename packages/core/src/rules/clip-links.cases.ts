/**
 * The session clip parser's case table (T36, D4), in one place because **two
 * implementations have to agree on it** — `clip-links.ts` here, and
 * `pocketbase/hooks/lib/session_rules.js` in the hook.
 *
 * - `clip-links.test.ts` runs the TypeScript one over it.
 * - `pocketbase/tests/session-rules.test.ts` loads the hook copy and runs it over
 *   the same rows, asserting both match `expected` and each other.
 *
 * Not exported from the package: a fixture, not API. Same arrangement as
 * `video.cases.ts`, for the same reason.
 */

import type { ClipLink } from '../types';

export interface ClipLinkCase {
  readonly input: string;
  /** `{ platform, id }`, or `null` when the link must be refused. */
  readonly expected: ClipLink | null;
  readonly why: string;
}

const YT = 'dQw4w9WgXcQ';
const IG = 'C8xYz_1-AbC';
const TT = '7234567890123456789';

export const CLIP_LINK_CASES: readonly ClipLinkCase[] = [
  // ---------------------------------------------------------------- YouTube --
  {
    input: `https://www.youtube.com/watch?v=${YT}&t=42s`,
    expected: { platform: 'youtube', id: YT },
    why: 'the desktop link, with a timestamp dropped',
  },
  {
    input: `https://youtu.be/${YT}?si=tracking`,
    expected: { platform: 'youtube', id: YT },
    why: 'the share-sheet short link, tracking parameter dropped',
  },
  {
    input: `https://www.youtube.com/shorts/${YT}`,
    expected: { platform: 'youtube', id: YT },
    why: 'a Short',
  },
  {
    input: `youtube.com/watch?v=${YT}`,
    expected: { platform: 'youtube', id: YT },
    why: 'no scheme',
  },
  {
    input: YT,
    expected: null,
    why: 'a bare id is refused on a clip: it could be YouTube or Instagram, and we never guess',
  },
  {
    input: `https://www.youtube.com/watch?v=${YT}x`,
    expected: null,
    why: 'a YouTube id of the wrong length',
  },

  // -------------------------------------------------------------- Instagram --
  {
    input: `https://www.instagram.com/reel/${IG}/?igsh=MTc4MmM1YmI2Ng==`,
    expected: { platform: 'instagram', id: IG },
    why: 'a reel from the share sheet, tracking parameter dropped',
  },
  {
    input: `https://www.instagram.com/p/${IG}/`,
    expected: { platform: 'instagram', id: IG },
    why: 'a post',
  },
  {
    input: `https://instagram.com/reels/${IG}`,
    expected: { platform: 'instagram', id: IG },
    why: 'the plural reels path, no www, no trailing slash',
  },
  {
    input: `https://www.instagram.com/tv/${IG}/`,
    expected: { platform: 'instagram', id: IG },
    why: 'the old IGTV path',
  },
  {
    input: `https://www.instagram.com/some.rider_99/reel/${IG}/`,
    expected: { platform: 'instagram', id: IG },
    why: 'the username-first form the app now shares',
  },
  {
    input: `https://m.instagram.com/p/${IG}`,
    expected: { platform: 'instagram', id: IG },
    why: 'the mobile host',
  },
  {
    input: 'https://www.instagram.com/some.rider_99/',
    expected: null,
    why: 'a profile, not a clip',
  },
  {
    input: `https://www.instagram.com/some.rider_99/tv/${IG}/`,
    expected: null,
    why: 'the username form only exists for posts and reels',
  },
  {
    input: `https://www.instagram.com/p/${IG}/embed/`,
    expected: null,
    why: 'nothing after the code — an extra segment is not a shape we know',
  },
  {
    input: 'https://www.instagram.com/p/abc/',
    expected: null,
    why: 'a shortcode too short to be one',
  },
  {
    input: `https://instagram.com.evil.example/p/${IG}/`,
    expected: null,
    why: 'a lookalike host with Instagram as a prefix',
  },
  {
    input: `https://evilinstagram.com/p/${IG}/`,
    expected: null,
    why: 'a lookalike host with Instagram as a suffix',
  },

  // ----------------------------------------------------------------- TikTok --
  {
    input: `https://www.tiktok.com/@some.rider/video/${TT}?is_from_webapp=1&sender_device=pc`,
    expected: { platform: 'tiktok', id: TT },
    why: 'the desktop link, tracking parameters dropped',
  },
  {
    input: `https://m.tiktok.com/v/${TT}.html`,
    expected: { platform: 'tiktok', id: TT },
    why: 'the legacy mobile form',
  },
  {
    input: `https://www.tiktok.com/embed/v2/${TT}`,
    expected: { platform: 'tiktok', id: TT },
    why: 'the embed page, which is also the stored watch URL and must round-trip',
  },
  {
    input: `tiktok.com/@rider/video/${TT}/`,
    expected: { platform: 'tiktok', id: TT },
    why: 'no scheme, no www, trailing slash',
  },
  {
    input: 'https://vm.tiktok.com/ZMabc1234/',
    expected: null,
    why: 'a short link: its code is a redirect, and resolving it would mean fetching a rider URL',
  },
  {
    input: 'https://vt.tiktok.com/ZSabc1234/',
    expected: null,
    why: 'the other short-link host',
  },
  {
    input: `https://www.tiktok.com/@rider/photo/${TT}`,
    expected: null,
    why: 'a photo post, not a video',
  },
  {
    input: 'https://www.tiktok.com/@rider/video/12345',
    expected: null,
    why: 'an id far too short to be a TikTok video',
  },
  {
    input: 'https://www.tiktok.com/@rider',
    expected: null,
    why: 'a profile, not a clip',
  },

  // -------------------------------------------------------------- hostile --
  {
    input: `javascript:alert(1)//www.tiktok.com/@a/video/${TT}`,
    expected: null,
    why: 'a javascript: URL never reaches the host test',
  },
  {
    input: `ftp://www.instagram.com/p/${IG}/`,
    expected: null,
    why: 'only http and https',
  },
  {
    input: `https://www.tiktok.com@evil.example/@a/video/${TT}`,
    expected: null,
    why: 'credentials in the authority make a hostile host read as a friendly one',
  },
  {
    input: `https://www.instagram.com:8443/p/${IG}/`,
    expected: null,
    why: 'a port is not part of any allowed host',
  },
  {
    input: `HTTPS://WWW.INSTAGRAM.COM/p/${IG}/`,
    expected: { platform: 'instagram', id: IG },
    why: 'scheme and host are case-insensitive; the code is not lower-cased',
  },
  { input: '', expected: null, why: 'an empty box' },
  { input: '   ', expected: null, why: 'whitespace only' },
];
