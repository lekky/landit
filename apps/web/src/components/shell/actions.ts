'use server';

import { isLandedStage, suggestedNextTricks, type SportId, type StageId } from '@landit/core';
import { listTrickPrereqs, listTrickProgress, listTricks, tricksFromRecords } from '@landit/db';

import { currentRider } from '@/lib/session';
import { lockedForPlan, planIdOf } from '@/lib/trickLock';

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

/**
 * What the sport sheet and menu put beside each sport (§3.1, review S9).
 *
 * Two counts, and neither is anything a rider typed: how many of that sport's
 * tricks they have landed, and how many they are in the middle of. It is the
 * one thing that makes the switch a decision rather than a list — a rider with
 * 34 scooter tricks and 2 skate ones can see which library they are actually
 * in.
 *
 * Fetched **on open, once**, the way the trick picker below already does it,
 * for the reason that function's own comment gives: the chip is in the top bar
 * of every screen, so a count computed on every page render would put a read on
 * the dashboard, the library and every trick page to pay for a panel most page
 * views never open.
 */
export interface SportCount {
  readonly landed: number;
  readonly learning: number;
}

/** Landed and learning per sport, for the sports this rider tracks. */
export async function sportCountsAction(): Promise<Readonly<Record<string, SportCount>>> {
  const session = await currentRider();
  if (!session) return {};

  const [tricks, progress] = await Promise.all([
    listTricks(session.client),
    listTrickProgress(session.client, session.rider.id),
  ]);

  const sportOf = new Map(tricks.map((trick) => [trick.id, trick.sport]));
  const counts: Record<string, { landed: number; learning: number }> = {};

  /*
   * Every sport this rider tracks starts at zero.
   *
   * Without it a sport they have logged nothing in is missing from the answer,
   * and the panel cannot tell "none yet" from "still loading" — so a rider with
   * one sport going would see a count on that row and a blank on the others,
   * which reads as the blank ones being broken. Absence now means one thing:
   * the read has not landed.
   */
  for (const sport of (session.rider.sports ?? []) as readonly string[]) {
    counts[sport] = { landed: 0, learning: 0 };
  }

  for (const row of progress) {
    const sport = sportOf.get(row.trick);
    if (!sport) continue;
    const tally = (counts[sport] ??= { landed: 0, learning: 0 });
    if (isLandedStage(row.stage)) tally.landed += 1;
    else if (row.stage === 'trying') tally.learning += 1;
  }

  return counts;
}

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
  /**
   * Four tricks to begin on, for a rider with nothing in progress (§3.5).
   *
   * Empty for everybody else, and empty for "Add a clip link" — a rider who has
   * landed nothing has nowhere to put a clip, and the row says so already.
   */
  readonly startHere: readonly PickerTrick[];
}

const EMPTY: TrickPicker = { recent: [], all: [], startHere: [] };

/** How many starter tricks the picker offers, matching Home's "Start here". */
const START_HERE = 4;

/**
 * The picker's rows for one sport.
 *
 * `limitToLanded` is "Add a clip link"'s: a clip goes onto a trick the rider has
 * landed, so offering the rest would be offering a dead end.
 *
 * **A trick behind this rider's paywall is not offered at all.** The picker used
 * to list every live trick in the sport, unmarked, and a Rookie who picked one
 * arrived at `LockedTrick` — a page with no stage ladder on it, so the tap that
 * was going to log a trick could not. The session form's own picker has always
 * left locked tricks out (`components/sessions/form/load.ts`), and
 * `lib/trickLock.ts` is now the one rule both ask. Nothing about enforcement
 * changes: the `trick_progress` hook is still where the paywall binds (plan §3,
 * guarantee 3). This is about not offering a rider a door that is shut.
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

  const plan = session.rider.plan;
  const byRecord = new Map(tricks.map((trick) => [trick.id, trick]));
  const stageByRecord = new Map(progress.map((row) => [row.trick, row.stage]));

  // The catalogue shape the paywall rule reads, keyed by slug as `@landit/core`
  // keys everything. Prereqs are not needed for the lock and are fetched below
  // only where they are.
  const ruleBySlug = new Map(tricksFromRecords(tricks).map((trick) => [trick.id, trick]));
  const offered = (slug: string): boolean => {
    const rule = ruleBySlug.get(slug);
    return rule ? !lockedForPlan(rule, plan) : false;
  };

  const row = (recordId: string, name: string, slug: string): PickerTrick => {
    const stage = stageByRecord.get(recordId);
    return { slug, name, ...(stage ? { stage } : {}) };
  };

  const keep = (trick: PickerTrick) =>
    offered(trick.slug) && (!limitToLanded || isLandedStage(trick.stage as StageId));

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

  /*
   * "Start here", for a rider with nothing on the go.
   *
   * On a rider's first day "Log a trick" was a search box and the line "Search
   * for the one you rode." — addressed to somebody who has ridden nothing the
   * product knows about, on the screen the whole bottom bar points at. So the
   * recents' slot carries four tricks to begin on instead: the same four Home's
   * own "Start here" offers for this sport (`suggestedNextTricks`, the one
   * definition of "you could begin on this"), so the two screens cannot suggest
   * different first tricks.
   *
   * The prereq read is made **only** in this branch: a rider with something in
   * progress never sees the list, and a picker that fetched it anyway would
   * charge every opening for a first-day screen.
   */
  let startHere: readonly PickerTrick[] = [];
  if (!limitToLanded && recent.length === 0) {
    const prereqs = await listTrickPrereqs(session.client);
    const byId: Record<string, StageId> = {};
    for (const progressRow of progress) {
      const record = byRecord.get(progressRow.trick);
      if (record) byId[record.slug] = progressRow.stage as StageId;
    }
    startHere = suggestedNextTricks(byId, planIdOf(plan), sport, tricksFromRecords(tricks, prereqs))
      // Easiest first, then by name. Plain `<` rather than `localeCompare`,
      // the call Home's own list makes for the same reason (LESSONS §3a).
      .sort((a, b) => a.diff - b.diff || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      .slice(0, START_HERE)
      .map((trick) => ({ slug: trick.id, name: trick.name }));
  }

  return { recent, all, startHere };
}
