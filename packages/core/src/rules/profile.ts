import { CUSTOM_GOAL_ID, CUSTOM_GOAL_MAX_LENGTH, GOALS } from '../data/profile';
import type { Goal, SportId } from '../types';

/** The goals to offer a rider: shared ones, plus the ones for sports they ride. */
export function goalsFor(sports: readonly SportId[], goals: readonly Goal[] = GOALS): Goal[] {
  return goals.filter((g) => !g.sport || sports.includes(g.sport));
}

/**
 * The goal to print on the dashboard. A written goal wins; an empty written
 * goal falls back to a placeholder rather than showing nothing; an unknown id
 * gives null so the caller can hide the row.
 */
export function goalLabel(
  goal: string | null | undefined,
  customGoal?: string | null,
  goals: readonly Goal[] = GOALS,
): string | null {
  if (goal === CUSTOM_GOAL_ID) return (customGoal ?? '').trim() || 'Your own goal';
  return goals.find((g) => g.id === goal)?.label ?? null;
}

/** Is a written goal usable? Non-empty, and inside the dashboard's budget. */
export function isValidCustomGoal(text: string | null | undefined): boolean {
  const trimmed = (text ?? '').trim();
  return trimmed.length > 0 && trimmed.length <= CUSTOM_GOAL_MAX_LENGTH;
}
