/**
 * The nightly tutorial check's own history — shaping half.
 *
 * The check switches a dead tutorial off and puts a returned one back. It has
 * always written *why* onto the trick (`video_off_reason`) and printed a
 * summary to whatever ran it; what it never did was keep a record a person
 * could come back to. `video_check_runs` is that record and this file decides
 * what goes in a row.
 *
 * **A row per run, including the nights nothing happened.** A history of
 * changes alone is empty on a healthy night, which makes "nothing was wrong"
 * and "this job stopped running in August" the same picture — and the second is
 * the one worth catching. Writing the boring row is what makes a gap in the
 * dates mean something.
 *
 * No PocketBase and no network here, so every rule below is unit-tested without
 * either; `../scripts/video-check.mts` does the talking.
 */

/** What a run did to one tutorial. */
export type VideoCheckAction = 'off' | 'back';

/** One line of a run's history. Catalogue facts only — no rider ever appears. */
export interface VideoCheckLogEntry {
  readonly slug: string;
  readonly name: string;
  readonly videoId: string;
  readonly action: VideoCheckAction;
  /** Why it was switched off. Empty for a tutorial put back. */
  readonly reason: string;
}

/** A `video_check_runs` row, ready to write. */
export interface VideoCheckRunRow {
  readonly checked: number;
  readonly hidden: number;
  readonly restored: number;
  readonly changes: readonly VideoCheckLogEntry[];
  readonly note: string;
}

/**
 * Turn one change into a history line.
 *
 * The reason is carried only for a switch-off, because that is the direction
 * that needs explaining: a tutorial coming back needs no more account of itself
 * than the fact that it plays again.
 */
export function videoCheckLogEntry(
  change: { readonly slug: string; readonly hidden: boolean; readonly offReason: string },
  trick: { readonly name: string; readonly videoId: string },
): VideoCheckLogEntry {
  return {
    slug: change.slug,
    name: trick.name,
    videoId: trick.videoId,
    action: change.hidden ? 'off' : 'back',
    reason: change.hidden ? change.offReason : '',
  };
}

/**
 * The row a finished run writes.
 *
 * `checked` is every tutorial asked about, not every one changed, so the page
 * can show the size of the catalogue the job is actually covering — a run that
 * checked four tricks when there are two hundred has gone wrong in a way no
 * count of changes would show.
 */
export function videoCheckRunRow(input: {
  readonly checked: number;
  readonly changes: readonly VideoCheckLogEntry[];
  readonly note?: string;
}): VideoCheckRunRow {
  return {
    checked: input.checked,
    hidden: input.changes.filter((entry) => entry.action === 'off').length,
    restored: input.changes.filter((entry) => entry.action === 'back').length,
    changes: input.changes,
    note: input.note ?? '',
  };
}

/**
 * The one-line summary at the head of a history row.
 *
 * "No changes" is a deliberate sentence rather than a blank: the ordinary night
 * is the common case, and a page of empty cells reads as a page of missing data
 * (LESSONS §3a on saying nothing out loud).
 */
export function describeVideoCheckRun(row: {
  readonly hidden: number;
  readonly restored: number;
}): string {
  const parts: string[] = [];
  if (row.hidden > 0) parts.push(`${row.hidden} switched off`);
  if (row.restored > 0) parts.push(`${row.restored} back on`);
  return parts.length ? parts.join(', ') : 'No changes';
}
