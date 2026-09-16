'use server';

import { isLandedStage, type SportId, type StageId } from '@landit/core';
import { listTrickProgress, listTricks } from '@landit/db';

import { currentRider } from '@/lib/session';

/**
 * What the LOG sheet's trick picker needs, fetched when the sheet opens.
 *
 * **Why an action rather than data passed down through the shell.** The picker
 * is two taps inside a sheet that most page views never open, and the shell
 * wraps every signed-in screen: loading a rider's whole trick progress on every
 * page render, for a list nobody has asked to see, would put a read on the
 * dashboard, the library, every trick page and every spot page to pay for a
 * sheet. So it is fetched on open, once, and held for as long as the sheet is.
 *
 * **It reads with the rider's own client**, so PocketBase's API rules are the
 * gate exactly as they are everywhere else — a rider gets their own
 * `trick_progress` rows and nobody else's, and `tricks` is listable to anyone.
 * Nothing here is a superuser read and nothing here writes.
 */

/** One row of the picker. Catalogue facts only — a slug, a name, a stage. */
export interface PickerTrick {
  readonly slug: string;
  readonly name: string;
  /** The rider's stage on it, when they have set one. */
  readonly stage?: StageId;
}

export interface TrickPicker {
  /** The three most recently worked-on tricks on this sport, newest first. */
  readonly recent: readonly PickerTrick[];
  /** The whole library for this sport, for the search field to filter. */
  readonly all: readonly PickerTrick[];
}

const EMPTY: TrickPicker = { recent: [], all: [] };

/**
 * The picker's rows for one sport.
 *
 * `limitToLanded` is "Add a clip link"'s: a clip goes onto a trick the rider has
 * landed, so offering the rest would be offering a dead end.
 */
export async function trickPickerAction(
  sport: SportId,
  limitToLanded = false,
): Promise<TrickPicker> {
  const session = await currentRider();
  if (!session) return EMPTY;

  const [tricks, progress] = await Promise.all([
    listTricks(session.client, { sport }),
    listTrickProgress(session.client, session.rider.id),
  ]);

  const byRecord = new Map(tricks.map((trick) => [trick.id, trick]));
  const stageByRecord = new Map(progress.map((row) => [row.trick, row.stage]));

  const row = (recordId: string, name: string, slug: string): PickerTrick => {
    const stage = stageByRecord.get(recordId);
    return { slug, name, ...(stage ? { stage } : {}) };
  };

  const keep = (trick: PickerTrick) => !limitToLanded || isLandedStage(trick.stage as StageId);

  const all = tricks.map((trick) => row(trick.id, trick.name, trick.slug)).filter(keep);

  /*
   * Newest first, by the progress row's own `updated`.
   *
   * PocketBase stamps every write, so "most recently worked on" is a fact the
   * database already holds and nothing new is stored to answer this. `want` is
   * left out: a trick on a wish list has not been worked on, and the three
   * slots are for the tricks a rider is actually in the middle of. A rider with
   * no progress at all gets an empty list and the search field, which is the
   * right first screen for somebody who has never logged anything.
   */
  const recent = [...progress]
    .filter((progressRow) => progressRow.stage !== 'want')
    .sort((a, b) => (a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : 0))
    .map((progressRow) => {
      const record = byRecord.get(progressRow.trick);
      return record ? row(record.id, record.name, record.slug) : null;
    })
    .filter((trick): trick is PickerTrick => trick !== null)
    .filter(keep)
    .slice(0, 3);

  return { recent, all };
}
