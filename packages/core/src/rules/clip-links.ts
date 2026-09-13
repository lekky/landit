/**
 * Session clip links — YouTube, Instagram or TikTok (T36, owner's decision D4,
 * Rachid, 2026-09-13, in chat).
 *
 * A session can carry **one link** to a clip the rider already posted somewhere
 * else. Land The Trick still hosts no video (plan §1, §6.6), and it still
 * embeds nothing from Instagram or TikTok: the screens draw a local poster
 * with a platform badge and open the link **at source** on a click (§6.8), so
 * no third party is contacted before a rider asks.
 *
 * What gets stored is `{ platform, id }` and nothing else — **never the pasted
 * string**. Every accepted shape reduces to an id matched by an anchored
 * pattern, and the watch URL is rebuilt from that id by `clipWatchUrl`. So no
 * query string, fragment, tracking parameter or redirect a rider (or an
 * attacker) supplied is ever persisted to be replayed into a browser later.
 * That is guarantee 2's link half, applied to two more hosts.
 *
 * **The YouTube half is `parseYouTubeVideoId`, reused rather than copied.** One
 * difference is deliberate: a *bare* id is refused here. On a trick video the
 * bare id is the stored form and the parser must accept it; on a session clip
 * an eleven-character string could be a YouTube id **or** an Instagram
 * shortcode, and guessing which would be the "close enough" branch these
 * parsers must never grow. A clip always arrives as a link.
 *
 * **Same primitive vocabulary as `video.ts`**: no `URL`, no `URLSearchParams`,
 * no `Intl`, no lookbehind. `pocketbase/hooks/lib/session_rules.js` transcribes
 * this file for PocketBase's goja JSVM (LESSONS §5), and
 * `pocketbase/tests/session-rules.test.ts` runs both copies side by side over
 * `clip-links.cases.ts`.
 */

import { CLIP_PLATFORMS } from '../data/sessions';
import type { ClipLink, ClipPlatformId } from '../types';
import { parseYouTubeVideoId, youtubeWatchUrl, YOUTUBE_ID_PATTERN } from './video';

/** Hosts per platform. Matched whole — never by prefix, suffix or "contains". */
const YOUTUBE_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
] as const;

const INSTAGRAM_HOSTS = ['instagram.com', 'www.instagram.com', 'm.instagram.com'] as const;

/**
 * TikTok's hosts that carry a **video id in the path**.
 *
 * `vm.tiktok.com` and `vt.tiktok.com` are deliberately absent. Those are the
 * share sheet's short links, and the code in them (`/ZMabc123/`) is a redirect
 * token, not a video id: turning one into an id means requesting it from
 * TikTok and following the redirect. That is a server fetch of a rider-supplied
 * URL — a request forgery surface — and it would store whatever TikTok answered
 * rather than something we parsed. So a short link is refused, and
 * `clipLinkProblem` says why in words: open it, and paste the address it lands
 * on.
 */
const TIKTOK_HOSTS = ['tiktok.com', 'www.tiktok.com', 'm.tiktok.com'] as const;

/** The short-link hosts we recognise only to explain the refusal. */
const TIKTOK_SHORT_HOSTS = ['vm.tiktok.com', 'vt.tiktok.com'] as const;

/**
 * An Instagram shortcode. URL-safe base64; eleven characters on public posts
 * and reels, longer on some private ones, so a range rather than a length.
 */
export const INSTAGRAM_ID_PATTERN = /^[A-Za-z0-9_-]{5,40}$/;

/** A TikTok video id: a long decimal number (nineteen digits today). */
export const TIKTOK_ID_PATTERN = /^[0-9]{15,21}$/;

/**
 * `/p/<code>`, `/reel/<code>`, `/reels/<code>`, `/tv/<code>` — and the newer
 * `/<username>/p/<code>` and `/<username>/reel/<code>` the app now shares.
 * One trailing slash allowed, nothing after it.
 */
const INSTAGRAM_PATH =
  /^\/(?:([A-Za-z0-9._]{1,30})\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,40})\/?$/;

/** `/@<user>/video/<id>`, the address bar and the desktop share link. */
const TIKTOK_VIDEO_PATH = /^\/@[A-Za-z0-9._]{1,24}\/video\/([0-9]{15,21})\/?$/;

/** `/v/<id>.html` (the legacy mobile form) and TikTok's own embed pages. */
const TIKTOK_OTHER_PATHS = [
  /^\/v\/([0-9]{15,21})(?:\.html)?\/?$/,
  /^\/embed\/v2\/([0-9]{15,21})\/?$/,
  /^\/embed\/([0-9]{15,21})\/?$/,
];

interface SplitLink {
  readonly host: string;
  readonly path: string;
}

/**
 * The host and path of a pasted link, or `null` when it is not an http(s) link
 * we are prepared to look at.
 *
 * The same steps as `parseYouTubeVideoId`, in the same order: trim, allow only
 * `http`/`https` (or no scheme), refuse a scheme without `//`, refuse
 * credentials in the authority, lower-case the host, drop the query and the
 * fragment. The query is dropped entirely because no accepted Instagram or
 * TikTok shape carries its id there.
 */
function splitLink(raw: unknown): SplitLink | null {
  let text = String(raw == null ? '' : raw).trim();
  if (!text) return null;

  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):\/\//.exec(text);
  if (scheme) {
    const name = scheme[1]!.toLowerCase();
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

function hostIn(host: string, list: readonly string[]): boolean {
  return list.indexOf(host) !== -1;
}

/** The shortcode inside an Instagram post or reel link, or `null`. */
export function parseInstagramId(raw: string): string | null {
  const link = splitLink(raw);
  if (!link || !hostIn(link.host, INSTAGRAM_HOSTS)) return null;
  const found = INSTAGRAM_PATH.exec(link.path);
  if (!found) return null;
  // The username form only exists for posts and reels.
  if (found[1] && found[2] !== 'p' && found[2] !== 'reel') return null;
  const id = found[3]!;
  return INSTAGRAM_ID_PATTERN.test(id) ? id : null;
}

/** The numeric id inside a TikTok video link, or `null`. Short links are refused. */
export function parseTikTokId(raw: string): string | null {
  const link = splitLink(raw);
  if (!link || !hostIn(link.host, TIKTOK_HOSTS)) return null;
  const video = TIKTOK_VIDEO_PATH.exec(link.path);
  if (video) return TIKTOK_ID_PATTERN.test(video[1]!) ? video[1]! : null;
  for (const pattern of TIKTOK_OTHER_PATHS) {
    const found = pattern.exec(link.path);
    if (found) return TIKTOK_ID_PATTERN.test(found[1]!) ? found[1]! : null;
  }
  return null;
}

/**
 * A pasted clip link as `{ platform, id }`, or `null`.
 *
 * `null` for everything that is not a link to one video on one of the three
 * platforms: another host, a TikTok short link, a profile page, a bare id, a
 * `javascript:` URL, an empty box. The caller refuses; this never guesses.
 */
export function parseClipLink(raw: string): ClipLink | null {
  const link = splitLink(raw);
  if (!link) return null;

  if (hostIn(link.host, YOUTUBE_HOSTS)) {
    const id = parseYouTubeVideoId(String(raw));
    return id ? { platform: 'youtube', id } : null;
  }
  if (hostIn(link.host, INSTAGRAM_HOSTS)) {
    const id = parseInstagramId(raw);
    return id ? { platform: 'instagram', id } : null;
  }
  if (hostIn(link.host, TIKTOK_HOSTS)) {
    const id = parseTikTokId(raw);
    return id ? { platform: 'tiktok', id } : null;
  }
  return null;
}

/** The platform a pasted string is a link to — what the live badge shows. */
export function detectClipPlatform(raw: string): ClipPlatformId | null {
  const parsed = parseClipLink(raw);
  return parsed ? parsed.platform : null;
}

/** Why a pasted clip was refused, for the sentence under the box. */
export type ClipLinkProblem = 'shortlink' | 'unsupported';

/** The sentences, written once so the form and any refusal agree. */
export const CLIP_LINK_REFUSALS: Readonly<Record<ClipLinkProblem, string>> = {
  shortlink:
    'That is a TikTok short link. Open it, then copy the address of the video it lands on.',
  unsupported: 'That is not a link to a YouTube, Instagram or TikTok video.',
};

/**
 * `null` when the box is empty or holds a good link; otherwise why not.
 *
 * An empty box is not a problem — the clip is optional.
 */
export function clipLinkProblem(raw: string): ClipLinkProblem | null {
  if (!String(raw == null ? '' : raw).trim()) return null;
  if (parseClipLink(raw)) return null;
  const link = splitLink(raw);
  if (link && hostIn(link.host, TIKTOK_SHORT_HOSTS)) return 'shortlink';
  return 'unsupported';
}

/** Is this a well-formed stored clip — a known platform and an id of its shape? */
export function isClipLink(value: unknown): value is ClipLink {
  if (typeof value !== 'object' || value === null) return false;
  const { platform, id } = value as { platform?: unknown; id?: unknown };
  if (typeof id !== 'string') return false;
  if (platform === 'youtube') return YOUTUBE_ID_PATTERN.test(id);
  if (platform === 'instagram') return INSTAGRAM_ID_PATTERN.test(id);
  if (platform === 'tiktok') return TIKTOK_ID_PATTERN.test(id);
  return false;
}

/**
 * Where the clip lives — the only URL a screen should put on the poster's link.
 *
 * Rebuilt from the id, so it is always one of three fixed shapes. Every one of
 * them parses back to the same `{ platform, id }`, which the tests assert:
 *
 * - YouTube: `https://www.youtube.com/watch?v=<id>`
 * - Instagram: `https://www.instagram.com/p/<code>/` — `/p/` resolves reels too.
 * - TikTok: `https://www.tiktok.com/embed/v2/<id>` — TikTok's own documented
 *   single-video page. The `/@user/video/<id>` form needs a username we
 *   deliberately do not store, and this is the id-only address TikTok
 *   publishes. **Not verified against the live site from this repository**
 *   (no network in the build); if it stops resolving, this line is the fix.
 *
 * Throws on anything that is not a valid clip, because a caller building a URL
 * out of unvalidated text is the bug this function exists to make impossible.
 */
export function clipWatchUrl(clip: ClipLink): string {
  if (!isClipLink(clip)) {
    throw new Error(`not a clip link: ${JSON.stringify(clip)}`);
  }
  if (clip.platform === 'youtube') return youtubeWatchUrl(clip.id);
  if (clip.platform === 'instagram') return `https://www.instagram.com/p/${clip.id}/`;
  return `https://www.tiktok.com/embed/v2/${clip.id}`;
}

/** "YouTube", "Instagram", "TikTok". */
export function clipPlatformLabel(platform: ClipPlatformId): string {
  return CLIP_PLATFORMS.find((p) => p.id === platform)?.label ?? '';
}

/** The badge colour for a platform. */
export function clipPlatformColor(platform: ClipPlatformId): string {
  return CLIP_PLATFORMS.find((p) => p.id === platform)?.color ?? '#2a2620';
}
