import { SUGGESTION_DETAIL_MAX, SUGGESTION_REFUSALS } from '@landit/core';
import { describe, expect, it } from 'vitest';

import { suggestionRefusal } from './suggestRefusal';

/**
 * Which refusals a rider sending us an idea gets to read.
 *
 * The errors have the shape of the PocketBase SDK's `ClientResponseError`: a
 * numeric `status` and the server's JSON body on `response`. That the hook
 * really sends these sentences is proven over HTTP in
 * `pocketbase/tests/suggestions.test.ts`; this file proves what the web app does
 * with them.
 */

const refusal = (status: number, message: string) => ({
  status,
  response: { status, message, data: {} },
});

describe('suggestionRefusal', () => {
  it('keeps the message the live form showed on 2026-09-13 away from the rider', () => {
    expect(suggestionRefusal(refusal(404, 'Missing or invalid collection context.'))).toBeNull();
    expect(suggestionRefusal(refusal(404, 'Missing collection context.'))).toBeNull();
  });

  it('passes every one of the hook’s own sentences through, word for word', () => {
    expect(SUGGESTION_REFUSALS).toContain(`Keep it under ${SUGGESTION_DETAIL_MAX} characters.`);
    for (const sentence of SUGGESTION_REFUSALS) {
      expect(suggestionRefusal(refusal(400, sentence))).toBe(sentence);
      expect(suggestionRefusal(refusal(429, sentence))).toBe(sentence);
    }
  });

  it('keeps PocketBase’s own 400s away from the rider', () => {
    expect(suggestionRefusal(refusal(400, 'Failed to create record.'))).toBeNull();
    expect(
      suggestionRefusal(refusal(400, 'Something went wrong while processing your request.')),
    ).toBeNull();
  });

  it('matches exactly, so a sentence nobody listed falls back to the apology', () => {
    expect(suggestionRefusal(refusal(400, 'Pick what this is about'))).toBeNull();
    expect(
      suggestionRefusal(refusal(400, 'Pick what this is about. Also: stack trace')),
    ).toBeNull();
  });

  it('answers for a 400 or a 429 only', () => {
    expect(suggestionRefusal(refusal(403, 'Pick what this is about.'))).toBeNull();
    expect(suggestionRefusal(refusal(500, 'Pick what this is about.'))).toBeNull();
  });

  it('returns null for anything that is not a server refusal at all', () => {
    expect(suggestionRefusal(new Error('Pick what this is about.'))).toBeNull();
    expect(suggestionRefusal({ status: 400 })).toBeNull();
    expect(suggestionRefusal('Pick what this is about.')).toBeNull();
    expect(suggestionRefusal(null)).toBeNull();
    expect(suggestionRefusal(undefined)).toBeNull();
  });
});
