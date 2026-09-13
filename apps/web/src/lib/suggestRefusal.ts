import { SUGGESTION_REFUSALS } from '@landit/core';
import { refusalMessage } from '@landit/db';

/**
 * The sentence to show a rider whose idea the server refused, or `null` when
 * the form's own apology is the honest answer.
 *
 * `spotSubmissionRefusal`'s rule, applied to the suggestion box. On 2026-09-13
 * the live `/suggest` form showed riders "Missing or invalid collection
 * context." — PocketBase's 404 for a collection that had not been deployed yet,
 * passed straight through by `refusalMessage`, which shows whatever message a
 * refusal carries. That wording is for a developer.
 *
 * So a message is passed through only when it is a 400 or 429 **and** one of
 * the hook's own sentences, matched exactly against `SUGGESTION_REFUSALS` in
 * `@landit/core`. Everything else — a 404, a 500, PocketBase's "Failed to create
 * record.", a sentence the list has not heard of — returns `null`.
 *
 * In `src/lib` rather than the action so it can be unit-tested
 * (`vitest.config.ts` covers `src/lib` only).
 */
export function suggestionRefusal(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('status' in error)) return null;
  if (error.status !== 400 && error.status !== 429) return null;
  const said = refusalMessage(error);
  return said !== null && SUGGESTION_REFUSALS.includes(said) ? said : null;
}
