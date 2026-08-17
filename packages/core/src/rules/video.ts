/**
 * Video links — the parser, the visibility model and the per-plan allowance.
 *
 * Land It does not host video (plan §1, §6.6). A rider pastes a **YouTube
 * link** and the app embeds it. Three rules live here, all pure, because all
 * three are enforced somewhere this package cannot reach:
 *
 * 1. **`parseYouTubeVideoId` — what a link is allowed to be.** Enforced in
 *    `pocketbase/hooks/45_video_links.pb.js`, which parses on every write path
 *    and overwrites the stored value with the 11-character id. The client calls
 *    the same function so a rider is told "that is not a YouTube link" while
 *    they are still looking at the box, but the hook is the boundary.
 * 2. **The visibility model** — `private | members`, defaulting to `private`.
 *    There is deliberately **no `public`** (plan §3 guarantee 2, owner's
 *    decision 2026-08-17). Enforced by the `clips` view rule.
 * 3. **The allowance** — how many links a plan buys. Enforced in the same hook,
 *    at the model layer, so a superuser client cannot exceed it either.
 *
 * **No `URL`, no `URLSearchParams`, no `Intl`, no lookbehind.** The parser is
 * plain string and regex work on purpose: `pocketbase/hooks/lib/video.js` is a
 * transcription of this file that runs in PocketBase's goja JSVM, where the
 * first three are absent or (worse) present and wrong (LESSONS §5). Keeping
 * both copies to the same primitive vocabulary is what lets
 * `pocketbase/tests/video-link-parser.test.ts` load them side by side and prove
 * they agree, rather than comparing two files as text.
 */

import type { Plan, VideoLinkAllowance, VideoVisibilityId } from '../types';

/**
 * A YouTube video id: exactly eleven characters of URL-safe base64.
 *
 * This is the whole of what gets stored. Anchored at both ends, so nothing
 * before or after the id survives into the database — no query string, no
 * fragment, no redirect target, no second URL smuggled in behind the first.
 */
export const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/** Hosts a link may name. Anything else is refused, including a bare `youtube` lookalike. */
const YOUTUBE_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
] as const;

/**
 * The three link shapes riders actually paste, plus the id on its own.
 *
 * `/watch?v=`, `youtu.be/` and `/shorts/` are what the share sheet and the
 * address bar produce. The bare id is accepted because it is what we *store*:
 * the hook re-parses `video_id` on update, and a value it wrote itself has to
 * come back out unchanged or the visibility edit would refuse its own row.
 */
function idFromPath(host: string, path: string, query: string): string | null {
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    // youtu.be/<id> — the id is the whole path.
    return path.slice(1);
  }

  if (path === '/watch') {
    // /watch?v=<id>, with the parameter anywhere in the query string.
    const found = /(?:^|&)v=([^&]*)/.exec(query);
    return found ? found[1]! : null;
  }

  if (path.indexOf('/shorts/') === 0) return path.slice('/shorts/'.length);

  // /embed/<id> on either host, so a rider who copied an embed URL out of a
  // page — or out of one of our own — is not told their own link is invalid.
  if (path.indexOf('/embed/') === 0) return path.slice('/embed/'.length);

  return null;
}

/**
 * The 11-character id inside a pasted YouTube link, or `null`.
 *
 * `null` for everything that is not one — another host, a shortener, a
 * `javascript:` URL, an id of the wrong length, an empty box. The caller's job
 * is to refuse; this function never guesses and never returns a partial match.
 *
 * What it accepts:
 *
 * ```
 * https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s
 * https://youtu.be/dQw4w9WgXcQ?si=abc
 * https://www.youtube.com/shorts/dQw4w9WgXcQ
 * youtube.com/watch?v=dQw4w9WgXcQ          (protocol optional)
 * dQw4w9WgXcQ                              (the id on its own)
 * ```
 */
export function parseYouTubeVideoId(raw: string): string | null {
  let text = String(raw == null ? '' : raw).trim();
  if (!text) return null;

  // A bare id, which is also the stored form. Checked first so an id that
  // happens to look like a host fragment cannot be mangled by the URL parsing.
  if (YOUTUBE_ID_PATTERN.test(text)) return text;

  // Strip the scheme. Only http(s) — a `javascript:` or `data:` URL that
  // happened to contain eleven legal characters must not reach the host test.
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):\/\//.exec(text);
  if (scheme) {
    const name = scheme[1]!.toLowerCase();
    if (name !== 'http' && name !== 'https') return null;
    text = text.slice(scheme[0].length);
  } else if (text.indexOf(':') !== -1 && text.indexOf(':') < text.indexOf('/')) {
    // `javascript:...`, `mailto:...` — a scheme without `//`.
    return null;
  }

  // Credentials in the authority (`user@host`) are a classic way to make a
  // hostile host read as a friendly one. Refused rather than unpicked.
  const authorityEnd = text.search(/[/?#]/);
  const authority = authorityEnd === -1 ? text : text.slice(0, authorityEnd);
  if (authority.indexOf('@') !== -1) return null;

  const rest = authorityEnd === -1 ? '' : text.slice(authorityEnd);
  const host = authority.toLowerCase();
  if (YOUTUBE_HOSTS.indexOf(host as (typeof YOUTUBE_HOSTS)[number]) === -1) return null;

  // Split path / query / fragment by hand. The fragment is dropped entirely: it
  // never reaches a server, so nothing in it can be part of a video's identity.
  const hashAt = rest.indexOf('#');
  const beforeHash = hashAt === -1 ? rest : rest.slice(0, hashAt);
  const queryAt = beforeHash.indexOf('?');
  const path = queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt);
  const query = queryAt === -1 ? '' : beforeHash.slice(queryAt + 1);

  const candidate = idFromPath(host, path || '/', query);
  if (candidate == null) return null;
  return YOUTUBE_ID_PATTERN.test(candidate) ? candidate : null;
}

/**
 * The embed URL for a stored id.
 *
 * **`youtube-nocookie.com`, and only ever behind a click** (plan §6.8). Land It
 * has no consent banner and deliberately keeps it that way given the audience,
 * which it can only do while no third party is contacted without the rider
 * asking. An `<iframe>` rendered on page load contacts Google before anybody
 * has chosen anything, and no amount of `nocookie` in the hostname changes that
 * — so the surface that calls this renders a locally-drawn poster first and
 * mounts the frame on the rider's click. `autoplay=1` is therefore correct
 * rather than pushy: the click already was the play button.
 *
 * Throws on anything that is not an id, because a caller building a URL out of
 * unvalidated text is the bug this function exists to make impossible.
 */
export function youtubeEmbedUrl(videoId: string): string {
  if (!YOUTUBE_ID_PATTERN.test(videoId)) {
    throw new Error(`not a YouTube video id: ${JSON.stringify(videoId)}`);
  }
  return (
    `https://www.youtube-nocookie.com/embed/${videoId}` +
    '?autoplay=1&rel=0&modestbranding=1&playsinline=1'
  );
}

/** Where the video actually lives — for the "watch on YouTube" link out. */
export function youtubeWatchUrl(videoId: string): string {
  if (!YOUTUBE_ID_PATTERN.test(videoId)) {
    throw new Error(`not a YouTube video id: ${JSON.stringify(videoId)}`);
  }
  return `https://www.youtube.com/watch?v=${videoId}`;
}

// ------------------------------------------------------------- visibility --

/**
 * The two states a video link can be in. **There is no `public`.**
 *
 * Profile privacy is three-way (`public | members | private`, §3 guarantee 1)
 * and this deliberately is not. A rider-supplied third-party video reachable
 * without signing in is a moderation surface this product will not take on: the
 * page would be crawlable, shareable and visible to anyone who guessed a
 * handle, over content we do not host and cannot check. Removing the state
 * removes the surface, rather than defending it. Owner's decision (Rachid,
 * 2026-08-17, in chat).
 */
export const VIDEO_VISIBILITIES = [
  {
    id: 'private',
    label: 'Only me',
    help: 'Nobody else can see this, whatever your profile says.',
  },
  {
    id: 'members',
    label: 'Signed-in riders',
    help: 'Riders signed in to Land It — and only if your profile lets them see you.',
  },
] as const satisfies readonly { id: VideoVisibilityId; label: string; help: string }[];

export const VIDEO_VISIBILITY_IDS = VIDEO_VISIBILITIES.map(
  (v) => v.id,
) as readonly VideoVisibilityId[];

/**
 * Private, and this is the value itself rather than "not public".
 *
 * Children's code standard 7 (plan §6.4) says high privacy **by default**, and
 * the same section records that `members` does not clear that bar for a profile.
 * It clears it even less for a video.
 */
export const DEFAULT_VIDEO_VISIBILITY: VideoVisibilityId = 'private';

/**
 * Anything that is not exactly `members` reads as `private`.
 *
 * The fail-closed direction, and it is what makes an unset field safe: a
 * `visibility` that is empty, misspelt, or a value some future migration has
 * not taught this function about is the most private state, never the least.
 * The `clips` view rule is written the same way round — it tests for `members`
 * rather than testing for "not private".
 */
export function normaliseVideoVisibility(raw: string | null | undefined): VideoVisibilityId {
  return raw === 'members' ? 'members' : 'private';
}

// -------------------------------------------------------------- allowance --

/**
 * How many links Shredder buys. **A tunable default, not a deliberated
 * decision** — the same standing as `WEEKLY_RIDE_TARGET` (plan §1).
 *
 * Ten because it is enough that a rider filming their season does not meet the
 * wall (the median rider tracks a handful of tricks at a time), and few enough
 * that the number means something written on a plan card. Moving it is this
 * line, the plan row that records it, and nothing else — the cap is read from
 * the `plans` record at runtime, never compared against a plan id.
 */
export const SHREDDER_VIDEO_LINK_CAP = 10;

/** No links at all, and the value every fail-closed path resolves to. */
export const NO_VIDEO_LINKS: VideoLinkAllowance = { cap: 0, unlimited: false };

/**
 * The allowance a plan record grants — **`null` means none**.
 *
 * A missing plan record fails *closed*, like `planUnlocksPaidTricks` and
 * `planIncludesInsights` before it (plan §2.4): an unseeded `plans` collection
 * or an unknown slug grants nobody anything rather than granting everybody
 * everything.
 *
 * **On the encoding, because `0` had to mean one thing only.** Two fields, a
 * count and a boolean, rather than one number with a sentinel:
 *
 * - `cap: 0` means **none**, unambiguously, because it is read as a count and
 *   nothing else is spelled that way. Rookie is a genuine zero.
 * - `unlimited: true` means the count does not apply. "Unlimited" is not a
 *   number, so writing it as one needs a sentinel — `-1`, or a very large
 *   integer — and every sentinel is a value that some later `count < cap`
 *   compares against literally, on the day nobody remembers it is special.
 *   A boolean says "the cap does not apply" in the type rather than in a
 *   comment.
 * - It is also the fail-closed direction in the database: a `number` field
 *   added to `plans` reads `0` on rows nobody has updated and a `bool` reads
 *   `false`, so a half-migrated or half-seeded database grants **no links**
 *   rather than unlimited ones.
 */
export function videoLinkAllowance(plan: Plan | null | undefined): VideoLinkAllowance {
  if (!plan) return NO_VIDEO_LINKS;
  return {
    cap: Math.max(0, Math.trunc(plan.videoLinkCap || 0)),
    unlimited: plan.videoLinksUnlimited === true,
  };
}

/** Does this allowance permit another link, given how many the rider already has? */
export function canAddVideoLink(allowance: VideoLinkAllowance, currentCount: number): boolean {
  if (allowance.unlimited) return true;
  return currentCount < allowance.cap;
}

/** How many are left, or `null` when the allowance is unlimited. */
export function videoLinksRemaining(
  allowance: VideoLinkAllowance,
  currentCount: number,
): number | null {
  if (allowance.unlimited) return null;
  return Math.max(0, allowance.cap - currentCount);
}

/**
 * The allowance as a phrase for a plan card or a panel.
 *
 * Here rather than in the web app because the plan cards, the trick page and
 * (later) a native app all have to say the same number, and the number comes
 * from a database record none of them should be formatting twice.
 */
export function videoLinkAllowanceLabel(allowance: VideoLinkAllowance): string {
  if (allowance.unlimited) return 'Unlimited video links';
  if (allowance.cap === 0) return 'No video links';
  if (allowance.cap === 1) return '1 video link';
  return `${allowance.cap} video links`;
}
