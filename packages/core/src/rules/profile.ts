import {
  CUSTOM_GOAL_ID,
  CUSTOM_GOAL_MAX_LENGTH,
  GOALS,
  HANDLE_MAX_LENGTH,
  HANDLE_MIN_LENGTH,
  HANDLE_PATTERN,
  RESERVED_HANDLES,
} from '../data/profile';
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

/* ---------------------------------------------------------------- handles -- */

/** Lowercase and trim. What a rider types is not what gets stored. */
export function normaliseHandle(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase();
}

/** Would the server accept this handle? Shape and reserved list, both. */
export function isValidHandle(raw: string | null | undefined): boolean {
  const handle = normaliseHandle(raw);
  return HANDLE_PATTERN.test(handle) && !RESERVED_HANDLES.includes(handle);
}

/**
 * Why a handle was refused, in words a rider can act on — or `null` when it is
 * fine. The hook says the same thing on the server; this one says it before the
 * request leaves.
 */
export function handleProblem(raw: string | null | undefined): string | null {
  const handle = normaliseHandle(raw);
  if (!handle) return 'Pick a handle.';
  if (handle.length < HANDLE_MIN_LENGTH) return `At least ${HANDLE_MIN_LENGTH} characters.`;
  if (handle.length > HANDLE_MAX_LENGTH) return `${HANDLE_MAX_LENGTH} characters at most.`;
  if (!HANDLE_PATTERN.test(handle)) {
    return 'Lowercase letters, numbers and underscores, starting and ending with a letter or number.';
  }
  if (RESERVED_HANDLES.includes(handle)) return 'That one is reserved. Pick another.';
  return null;
}

/**
 * A handle suggested from the name a rider gave.
 *
 * Accents are folded rather than stripped, so "Zoë" suggests `zoe` and not `zo`.
 * A name that leaves nothing usable — punctuation, or a script the pattern does
 * not admit — returns an empty string, and the caller falls back to
 * `handleCandidates`, which always produces something.
 */
export function handleFromName(name: string | null | undefined): string {
  const folded = foldToHandle(name);
  return HANDLE_PATTERN.test(folded) && !RESERVED_HANDLES.includes(folded) ? folded : '';
}

/** Name to bare characters. May be too short, reserved, or empty. */
function foldToHandle(name: string | null | undefined): string {
  return String(name ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, HANDLE_MAX_LENGTH);
}

/**
 * Handles to try, in order, until one is free.
 *
 * Uniqueness is the database's answer, not this function's (`users.handle` has a
 * case-insensitive unique index), so this only has to keep producing plausible
 * candidates: the name, then the name with a number, then a generated one so the
 * list can never run out on a rider whose name yields nothing.
 */
export function handleCandidates(name: string | null | undefined, count = 8): string[] {
  const base = handleFromName(name);
  // A name too short or too reserved to stand on its own still makes a decent
  // stem: "Al" is not a handle, "al2" is.
  const stem = foldToHandle(name) || 'rider';
  const out: string[] = [];

  if (base) out.push(base);
  for (let n = 2; out.length < count; n += 1) {
    const suffix = String(n);
    const trimmed = stem.slice(0, HANDLE_MAX_LENGTH - suffix.length);
    const candidate = `${trimmed}${suffix}`;
    if (HANDLE_PATTERN.test(candidate) && !RESERVED_HANDLES.includes(candidate)) {
      out.push(candidate);
    }
    // A stem so short that no suffix satisfies the pattern would loop forever.
    if (n > count * 4) break;
  }

  return out;
}
