import { SPOT_SUBMISSION_REFUSALS } from '@landit/core';
import { refusalMessage } from '@landit/db';

/**
 * The sentence to show a rider whose spot the server refused with a 400, or
 * `null` when the generic "try again" is the honest answer.
 *
 * A 400 on a spot create has two possible authors, and from here they look the
 * same. `pocketbase/hooks/62_spots.pb.js` writes its refusals for a rider — "8
 * tags at most." — and hiding one behind "try again" leaves the rider pressing
 * a button that will refuse them for ever, which is exactly what issue #369
 * was: every spot with two tags refused, and the form saying nothing useful.
 * PocketBase writes the other kind, for a developer: "Failed to create
 * record.", or "Something went wrong while processing your request." when a
 * hook threw something it did not mean to. That wording must never reach a
 * fourteen year old.
 *
 * So the message is passed through only when it is one of the hook's own
 * sentences, matched exactly against `SPOT_SUBMISSION_REFUSALS` in
 * `@landit/core`. Anything else returns `null`, including a new sentence the
 * list has not heard of yet — falling back to the apology is the safe way to
 * be wrong, and `pocketbase/tests/spot-submission.test.ts` checks the list
 * against what the server really says.
 *
 * It lives in `src/lib` rather than in the action so it can be tested: the
 * action is a server action, and this app unit-tests `src/lib` only
 * (`vitest.config.ts`).
 */
export function spotSubmissionRefusal(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('status' in error)) return null;
  if (error.status !== 400) return null;
  const said = refusalMessage(error);
  return said !== null && SPOT_SUBMISSION_REFUSALS.includes(said) ? said : null;
}
