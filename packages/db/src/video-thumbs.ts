/**
 * The tutorial preview frames — deciding half.
 *
 * A rider used to meet a hard-shadowed ink panel where the tutorial's first
 * frame should be. The obvious fix is YouTube's own thumbnail and it is the one
 * thing that must not happen: `i.ytimg.com` is a Google host, and asking it for
 * an image on page load is exactly the request `VideoEmbed`'s click-to-play
 * gate exists to prevent (plan §6.8 — no consent banner, deliberately, and
 * `e2e/video-links.spec.ts` fails on any Google request before the press).
 *
 * So the image is fetched **once, server-side**, into `tricks.video_thumb`, and
 * served to riders by our own PocketBase. The rule is unchanged; only where the
 * bytes come from moved.
 *
 * No HTTP and no PocketBase in this file — the script
 * (`../scripts/video-thumbs.mts`) does both. What is here is which URL to ask
 * for, what counts as an acceptable answer, and which rows still need one, all
 * testable without a network.
 */

/** The most bytes a thumbnail may be, matching the column's own ceiling. */
export const THUMB_MAX_BYTES = 524288;

/** What the column will store. Anything else is refused rather than saved. */
export const THUMB_TYPES = ['image/jpeg', 'image/webp'] as const;

/**
 * Where a video's preview frame lives on YouTube's image host.
 *
 * **`mqdefault` (320×180), not `hqdefault` or `maxresdefault`.** The poster is
 * a 16:9 panel a few hundred pixels wide, so a larger file would be scaled down
 * for nothing; and `maxresdefault` does not exist for every video, which would
 * make "no thumbnail" mean two different things. `mqdefault` is always there
 * for a video that is served at all, at around 15KB.
 *
 * **Only ever called from a script.** A caller on a render path would be the
 * page-load request to Google this whole file exists to avoid.
 */
export function youtubeThumbSource(videoId: string): string {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    throw new Error(`not a YouTube video id: ${videoId}`);
  }
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

/** A trick row as the fetcher reads it. */
export interface ThumbRow {
  readonly id: string;
  readonly slug: string;
  readonly videoId: string;
  /** The stored filename, empty when nothing has been fetched. */
  readonly thumb: string;
}

/**
 * Does this row still need a thumbnail fetched?
 *
 * **A row with a video and no thumbnail**, including a hidden one: staff
 * un-hide videos, and a preview that only appeared some runs later would be a
 * second thing to wait for. A row whose video was swapped in the portal reads
 * as needing one too, because the importer and the portal both clear
 * `video_thumb` when the id changes — that clearing is what makes "has a file"
 * a safe test rather than one that serves the previous video's frame.
 */
export function needsThumb(row: ThumbRow): boolean {
  return Boolean(row.videoId) && !row.thumb;
}

/** Why a fetched image was refused, or `null` when it may be stored. */
export function thumbProblem(response: {
  readonly ok: boolean;
  readonly status: number;
  readonly contentType: string | null;
  readonly bytes: number;
}): string | null {
  if (!response.ok) return `YouTube answered ${response.status}`;

  // The type is checked because the column enforces it anyway: a mismatch is a
  // write that fails at 3am rather than a fetch that reported honestly here.
  const type = (response.contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (!(THUMB_TYPES as readonly string[]).includes(type)) {
    return `not an image we store (${type || 'no content-type'})`;
  }

  if (response.bytes <= 0) return 'empty response';
  if (response.bytes > THUMB_MAX_BYTES) return `too large (${response.bytes} bytes)`;

  return null;
}
