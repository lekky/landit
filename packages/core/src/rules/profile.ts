import { AVATARS } from '../data/avatars';
import {
  CUSTOM_GOAL_ID,
  CUSTOM_GOAL_MAX_LENGTH,
  GOALS,
  HANDLE_MAX_LENGTH,
  HANDLE_MIN_LENGTH,
  HANDLE_PATTERN,
  LEVELS,
  RESERVED_HANDLES,
  STANCES,
} from '../data/profile';
import { SPORT_IDS } from '../data/sports';
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

/* ---------------------------------------------------- the profile itself -- */

/**
 * A profile as a rider may set it — the five things both onboarding and the
 * account editor ask for. `stance` and `avatarKey` are the two that may be
 * absent: a rider who does not know which foot leads should not be made to
 * guess, and "my initial" is a legitimate picture.
 */
export interface ProfileChoice {
  readonly sports: readonly string[];
  readonly level: string | null;
  readonly goal: string | null;
  readonly goalCustom?: string | null;
  readonly stance?: string | null;
  readonly avatarKey?: string | null;
}

/**
 * Why a set of profile choices cannot be saved, in the words the rider reads —
 * or `null` when they are fine.
 *
 * One function for two callers on purpose. Onboarding (T6) asked these same
 * five questions and checked them inline; the account editor (T23) asks them
 * again, and a second copy of "pick at least one sport" is the pair that drifts
 * the first time one of the rules moves. The messages are onboarding's,
 * unchanged, so the flow that already shipped still says what it said.
 *
 * Every id is checked against the canonical list rather than merely being
 * non-empty, because both callers take these from a form: a level or a goal the
 * product does not have would otherwise be stored and then render as nothing.
 *
 * This is a message, not a permission. All five fields are written with the
 * rider's own client, so the `users` update rule and the guard hook are what
 * decide the write (plan §3) — a rider past this function still cannot touch
 * `plan`, `role` or their streak.
 */
export function profileChoiceProblem(choice: ProfileChoice): string | null {
  if (!choice.sports.some((sport) => (SPORT_IDS as readonly string[]).includes(sport))) {
    return 'Pick at least one sport.';
  }

  if (!LEVELS.some((level) => level.id === choice.level)) {
    return 'Tell us roughly where you are at.';
  }

  if (choice.goal === CUSTOM_GOAL_ID) {
    if (!isValidCustomGoal(choice.goalCustom)) return 'Write a goal, or pick one of the others.';
  } else if (!GOALS.some((goal) => goal.id === choice.goal)) {
    return 'Pick a goal, or write your own.';
  }

  // Both are optional, so only a *wrong* value is a problem. Absent is a choice.
  if (choice.stance && !STANCES.some((stance) => stance.id === choice.stance)) {
    return 'Pick one of the stances, or leave it blank.';
  }

  if (choice.avatarKey && !AVATARS.some((avatar) => avatar.id === choice.avatarKey)) {
    return 'Pick one of the pictures, or keep your initial.';
  }

  return null;
}
