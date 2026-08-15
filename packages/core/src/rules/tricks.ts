import { LANDED_STAGES } from '../data/stages';
import { TRICKS } from '../data/tricks';
import { PLAN } from '../data/plans';
import type { CategoryId, PlanId, SportId, StageId, Trick } from '../types';

/**
 * The free/paid cut-off. A trick with no `free` override is free at this
 * difficulty or below — currently the Rookie and Easy tiers.
 *
 * Staff move an individual trick across the line with the `free` field rather
 * than by moving this number; changing it re-tiers the whole library at once.
 */
export const FREE_MAX_DIFF = 2;

/**
 * Every function here takes an optional trick list. It defaults to the
 * canonical library, which is what the client wants; a PocketBase hook passes
 * the live rows instead, so staff edits take effect without a deploy.
 */
type TrickList = readonly Trick[];

/** Is this stage one that counts as landed? `some`, `most` or `every`. */
export function isLandedStage(stage: StageId | null | undefined): boolean {
  return stage != null && (LANDED_STAGES as readonly string[]).includes(stage);
}

/** Is this trick landed, given the rider's stage map? */
export function isTrickLanded(byId: Readonly<Record<string, StageId>>, trickId: string): boolean {
  return isLandedStage(byId[trickId]);
}

/** Look a trick up by id. Returns `undefined` rather than throwing. */
export function trickById(id: string, tricks: TrickList = TRICKS): Trick | undefined {
  return tricks.find((t) => t.id === id);
}

/** Which sport a trick belongs to, or `undefined` if the id is unknown. */
export function sportOf(id: string, tricks: TrickList = TRICKS): SportId | undefined {
  return trickById(id, tricks)?.sport;
}

/**
 * The tricks in scope. Pass `null` or nothing for everything the rider could
 * possibly track.
 */
export function tricksFor(sport?: SportId | null, tricks: TrickList = TRICKS): Trick[] {
  return sport ? tricks.filter((t) => t.sport === sport) : [...tricks];
}

/** Tricks in one category, optionally narrowed to a sport. */
export function tricksInCategory(
  cat: CategoryId,
  sport?: SportId | null,
  tricks: TrickList = TRICKS,
): Trick[] {
  return tricksFor(sport, tricks).filter((t) => t.cat === cat);
}

/**
 * Is this trick on the free tier?
 *
 * The `free` field is a staff override and wins either way — it can pull a hard
 * trick into the free tier or push an easy one out of it. With no override, a
 * trick is free at `diff <= FREE_MAX_DIFF`.
 */
export function isTrickFree(trick: Trick): boolean {
  return trick.free === undefined ? trick.diff <= FREE_MAX_DIFF : trick.free;
}

/** Does this plan unlock the paid tiers? Read from the plan record, not hard-coded. */
export function planUnlocksPaidTricks(plan: PlanId): boolean {
  return PLAN[plan].unlocksPaidTricks;
}

/**
 * Is this trick behind the paywall for a rider on this plan?
 *
 * Locked tricks stay visible throughout — a rider is always told what they are
 * missing, never shown a shorter library. Enforcement is server-side: this
 * function is the definition, and the `trick_progress` create hook is where it
 * binds (plan §3, guarantee 3). A client-side check alone is a suggestion.
 */
export function isTrickLocked(trick: Trick, plan: PlanId): boolean {
  return !planUnlocksPaidTricks(plan) && !isTrickFree(trick);
}

/** Every trick a rider on this plan may open, track or film. */
export function openTricks(plan: PlanId, tricks: TrickList = TRICKS): Trick[] {
  return tricks.filter((t) => !isTrickLocked(t, plan));
}

/**
 * The prerequisites this rider has not landed yet. Empty means the trick is
 * unlocked.
 */
export function missingPrereqs(trick: Trick, byId: Readonly<Record<string, StageId>>): string[] {
  return trick.pre.filter((p) => !isTrickLanded(byId, p));
}

/**
 * Is this trick unlocked? True when **every** entry in `pre` is landed — and
 * trivially true for a trick with no prerequisites.
 *
 * This is separate from the paywall: a trick can be unlocked and still locked
 * behind a plan, and the skill tree draws those two states differently.
 */
export function isTrickUnlocked(trick: Trick, byId: Readonly<Record<string, StageId>>): boolean {
  return missingPrereqs(trick, byId).length === 0;
}

/**
 * Tricks this rider could start on now: not yet landed, every prerequisite
 * landed, and not behind their paywall. Feeds "Start here" and the Legend
 * next-trick suggestions.
 */
export function suggestedNextTricks(
  byId: Readonly<Record<string, StageId>>,
  plan: PlanId,
  sport?: SportId | null,
  tricks: TrickList = TRICKS,
): Trick[] {
  return tricksFor(sport, tricks).filter(
    (t) =>
      t.isLive && !isTrickLanded(byId, t.id) && isTrickUnlocked(t, byId) && !isTrickLocked(t, plan),
  );
}
