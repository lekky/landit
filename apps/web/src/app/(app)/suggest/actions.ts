'use server';

import { isSuggestionTopic, suggestionProblems, type SuggestionTopicId } from '@landit/core';
import { fileSuggestion, isRateLimited, refusalMessage } from '@landit/db';

import { currentRider } from '@/lib/session';

/**
 * Sending us an idea.
 *
 * **Signed in only**, which is the one line that separates this from
 * `report/actions.ts` (owner decision, 2026-09-12, in chat). The reporting
 * route takes an anonymous client because the Online Safety Act requires a
 * route for somebody with no account; a suggestion box has no such duty, and an
 * open one is a spam target with a person at the end of it.
 *
 * **Nothing here is the rule.** `suggestionProblems` is the same check the hook
 * makes, run early so the form can answer without a round trip; the hook checks
 * all of it again, pins `rider`, `status` and `note`, and applies the rate limit
 * this action deliberately does not try to guess at
 * (`pocketbase/hooks/97_suggestions.pb.js`). A 429 is shown as what it is — the
 * server's own sentence — rather than flattened into "something went wrong".
 */

export interface SuggestionFormState {
  readonly error?: string;
  /** Field-level problems, in the order `@landit/core` lists them. */
  readonly problems?: readonly string[];
  /** The reference to quote if they need to come back to us about it. */
  readonly filedAs?: string;
}

export async function fileSuggestionAction(
  _state: SuggestionFormState | undefined,
  form: FormData,
): Promise<SuggestionFormState> {
  const session = await currentRider();
  if (!session) {
    return { error: 'Sign in to send us an idea. It takes a minute and it is free.' };
  }

  const topic = String(form.get('topic') ?? '');
  const detail = String(form.get('detail') ?? '');

  const problems = suggestionProblems({ topic, detail });
  if (problems.length) return { problems };

  // Narrowing, not validation: `suggestionProblems` has already refused
  // anything outside the list. This is what turns that into a type.
  if (!isSuggestionTopic(topic)) return { problems: ['Pick what this is about.'] };

  try {
    const filed = await fileSuggestion(session.client, {
      topic: topic as SuggestionTopicId,
      detail: detail.trim(),
    });
    return { filedAs: filed.id };
  } catch (error) {
    if (isRateLimited(error)) {
      return { error: refusalMessage(error) ?? 'That is a lot of ideas in one go.' };
    }
    return {
      error:
        refusalMessage(error) ??
        'We could not send that just now. Try again in a moment, or email us.',
    };
  }
}
