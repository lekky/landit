import { SPOT_FAVOURITE_REFUSALS, SPOT_SUBMISSION_REFUSALS } from '@landit/core';
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

/**
 * The same job for a favourite, against `64_spot_favourites.pb.js`.
 *
 * A separate function rather than a second argument, because the two lists are
 * separate on purpose: passing a submission's refusal through on a favourite
 * would show a rider "8 tags at most." for a heart they tapped, which is worse
 * than the apology it replaced.
 *
 * **Both a 400 and a 429 come through here**, where the submission's version
 * takes only the 400. The favourite hook's ceiling ("You can keep 200 faves")
 * is a 429 and is the one refusal a rider can actually do something about, so
 * hiding it behind "try again" would leave them tapping a heart that will never
 * fill with nothing saying why.
 */
export function spotFavouriteRefusalMessage(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('status' in error)) return null;
  if (error.status !== 400 && error.status !== 429) return null;
  const said = refusalMessage(error);
  return said !== null && SPOT_FAVOURITE_REFUSALS.includes(said) ? said : null;
}
