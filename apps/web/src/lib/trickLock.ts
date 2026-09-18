import { PLAN, isTrickFree, isTrickLocked, type PlanId, type Trick } from '@landit/core';

/**
 * A `users.plan` is a free-text slug; `@landit/core`'s rules take a `PlanId`.
 * A slug the catalogue does not know unlocks nothing — which is how the
 * `trick_progress` hook reads it — so it falls back to the free tier rather
 * than to whatever the first plan happens to be.
 */
export function planIdOf(plan: string | undefined | null): PlanId {
  return PLAN[plan as PlanId] ? (plan as PlanId) : 'rookie';
}

/**
 * Is this trick behind the paywall for a rider whose plan is whatever string
 * their record happens to hold?
 *
 * It lives here because two pickers ask the same question about the same rider:
 * the session form's trick list (`components/sessions/form/load.ts`) and the LOG
 * sheet's trick picker (`components/shell/actions.ts`). The rule was written out
 * in the first and missing from the second, so a Rookie searching "whip" in the
 * sheet was offered twelve paid tricks and landed on a page with no stage ladder
 * on it. One rule, one place.
 *
 * It is a convenience over `@landit/core`'s definition, never a second
 * definition: enforcement is still the hook's (plan §3, guarantee 3).
 */
export function lockedForPlan(trick: Trick, plan: string | undefined | null): boolean {
  return PLAN[plan as PlanId] ? isTrickLocked(trick, plan as PlanId) : !isTrickFree(trick);
}
