import type { Client } from './clients';
import { records } from './collections';
import type { SuggestionsRecord, SuggestionsTopic } from './generated/collections';

/**
 * Sending us an idea.
 *
 * A file of its own for the reason the package header gives about layers, and
 * the same reason `account.ts` is one: a call that every screen does not import
 * should not live in the file every screen does (LESSONS §1).
 *
 * **This package holds no rules.** Nothing below decides who may suggest
 * anything or what a suggestion may say — `pocketbase/hooks/97_suggestions.pb.js`
 * decides both, on the server, and `pocketbase/tests/suggestions.test.ts` proves
 * it over HTTP. This is the call, with its shape named.
 */

export interface SuggestionInput {
  /** One of the five `@landit/core` topic ids. */
  readonly topic: SuggestionsTopic;
  readonly detail: string;
}

/**
 * File a suggestion. **Signed in only** — unlike `fileReport`, which has to work
 * signed out because the Online Safety Act says so (owner decision,
 * 2026-09-12, in chat). `suggestions.createRule` requires a session and the
 * hook checks again, so an anonymous client gets a 400 here rather than a row.
 *
 * `rider`, `status` and `note` are not sent: the hook pins all three, and a
 * client that sent them would simply have them overwritten.
 */
export async function fileSuggestion(
  client: Client,
  input: SuggestionInput,
): Promise<SuggestionsRecord> {
  return records(client, 'suggestions').create({
    topic: input.topic,
    detail: input.detail,
  });
}
