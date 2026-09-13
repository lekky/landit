/**
 * The nightly tutorial liveness check — deciding half (#463).
 *
 * A curated tutorial belongs to somebody else and can stop working at any time
 * without anybody here doing anything: deleted, made private, or embedding
 * turned off by the uploader. Nothing in the product noticed, so the panel kept
 * rendering a working-looking play button and a rider pressed it and got
 * YouTube's error inside the frame. **A trick page with a dead frame is worse
 * than one with no frame** — which is the state every uncurated trick is
 * already in, and it reads fine.
 *
 * **What this file is not.** No HTTP, no PocketBase, no clock. It takes ids and
 * whatever YouTube said about them and returns what should change; the script
 * (`../scripts/video-check.mts`) does the fetching and the writing. That split
 * is what lets the interesting cases — an id YouTube omitted, a staff member's
 * own hide, a video that came back — be tested without a network or a key.
 *
 * **Why the API, having spent T35 avoiding it.** `videos.list` takes 50 ids per
 * call at one quota unit each, so the whole library is six calls and six units
 * against a free 10,000 a day. The owner took that trade knowingly on
 * 2026-09-13 (in chat), reversing T35's "no external dependency in v1" for this
 * one job. It runs on a schedule, server-side, and never during a page render:
 * no rider's browser ever talks to Google because of it.
 */

/** The most ids `videos.list` accepts in one call, and therefore one quota unit's worth. */
export const VIDEO_CHECK_BATCH = 50;

/** Why a tutorial was switched off, in the words the staff portal shows. */
export type VideoDeadReason = 'deleted or private' | 'embedding turned off';

/** What the check made of one id. */
export type VideoVerdict =
  { readonly ok: true } | { readonly ok: false; readonly reason: VideoDeadReason };

/**
 * The subset of a `videos.list` item this cares about.
 *
 * Deliberately loose: the response is somebody else's JSON and this must not
 * throw on a field that moved. Anything unrecognised is treated as "no opinion",
 * which resolves to alive — see {@link verdictsFor} for why that direction.
 */
export interface YouTubeVideoItem {
  readonly id?: unknown;
  readonly status?: { readonly embeddable?: unknown } | null;
}

/** Split ids into calls of at most {@link VIDEO_CHECK_BATCH}. */
export function videoCheckBatches(ids: readonly string[]): string[][] {
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += VIDEO_CHECK_BATCH) {
    batches.push(ids.slice(i, i + VIDEO_CHECK_BATCH));
  }
  return batches;
}

/**
 * What YouTube's answer means for each id that was asked about.
 *
 * **An id missing from the response is dead.** `videos.list` returns nothing at
 * all for a video that has been deleted or made private — there is no error and
 * no tombstone, just a shorter list — so absence is the signal, and it is the
 * single most important line here.
 *
 * **A malformed item counts as alive.** If the response shape changes under us,
 * the failure mode is that nothing gets switched off, rather than the whole
 * catalogue getting switched off at 3am by a parser that stopped understanding
 * the answer. Silence is the safe direction for an unattended job.
 */
export function verdictsFor(
  asked: readonly string[],
  items: readonly YouTubeVideoItem[],
): Map<string, VideoVerdict> {
  const seen = new Map<string, YouTubeVideoItem>();
  for (const item of items) {
    if (typeof item?.id === 'string') seen.set(item.id, item);
  }

  const verdicts = new Map<string, VideoVerdict>();
  for (const id of asked) {
    const item = seen.get(id);

    if (!item) {
      verdicts.set(id, { ok: false, reason: 'deleted or private' });
      continue;
    }

    // Only an explicit `false` counts. A missing `status` means the call did not
    // ask for that part, or the shape moved — neither is evidence against the
    // video, and acting on it would hide a working tutorial.
    if (item.status && item.status.embeddable === false) {
      verdicts.set(id, { ok: false, reason: 'embedding turned off' });
      continue;
    }

    verdicts.set(id, { ok: true });
  }

  return verdicts;
}

/** A trick row as the check reads it. */
export interface VideoCheckRow {
  readonly id: string;
  readonly slug: string;
  readonly videoId: string;
  readonly hidden: boolean;
  /** Set only by a previous run of this job. Empty when a staff member hid it. */
  readonly offReason: string;
}

/** What to write back for one trick, or `null` when nothing needs to change. */
export interface VideoCheckChange {
  readonly id: string;
  readonly slug: string;
  readonly hidden: boolean;
  readonly offReason: string;
  /** Human-readable, for the run's summary line. */
  readonly note: string;
}

/**
 * What one row should become, given the verdict on its video.
 *
 * Three rules, and the third is the one worth reading twice:
 *
 * 1. **Dead and showing → switch off**, recording why, so a staff member can
 *    tell YouTube's doing from a colleague's.
 * 2. **Alive and showing → nothing changes** but the checked stamp, which the
 *    caller writes for every row regardless.
 * 3. **Alive and hidden → put it back _only if this job hid it_.** A staff
 *    member's hide is a decision, and a job that overturned it every night
 *    would be a bug that looks like a haunting. `offReason` is the marker:
 *    the job always writes one, the portal never does, and un-hiding through
 *    the portal clears it in the tricks hook.
 */
export function videoCheckChange(
  row: VideoCheckRow,
  verdict: VideoVerdict,
): VideoCheckChange | null {
  if (!verdict.ok) {
    if (row.hidden && row.offReason === verdict.reason) return null;
    return {
      id: row.id,
      slug: row.slug,
      hidden: true,
      offReason: verdict.reason,
      note: `${row.slug}: switched off — ${verdict.reason}`,
    };
  }

  if (row.hidden && row.offReason) {
    return {
      id: row.id,
      slug: row.slug,
      hidden: false,
      offReason: '',
      note: `${row.slug}: back on — YouTube is serving it again`,
    };
  }

  return null;
}
