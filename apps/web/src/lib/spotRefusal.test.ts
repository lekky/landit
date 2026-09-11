import { SPOT_MAX_TAGS, SPOT_SUBMISSION_REFUSALS } from '@landit/core';
import { describe, expect, it } from 'vitest';

import { spotSubmissionRefusal } from './spotRefusal';

/**
 * Which 400s a rider gets to read (issue #369).
 *
 * The errors below have the shape the PocketBase SDK's `ClientResponseError`
 * gives the submit action: a numeric `status` and the server's JSON body on
 * `response`. That the hook really sends these sentences is proven over HTTP in
 * `pocketbase/tests/spot-submission.test.ts`; this file proves what the web
 * app does with them.
 */

const refusal = (status: number, message: string, data: Record<string, unknown> = {}) => ({
  status,
  response: { status, message, data },
});

describe('spotSubmissionRefusal', () => {
  it('passes the tag cap through, which is the refusal #369 hid', () => {
    expect(spotSubmissionRefusal(refusal(400, `${SPOT_MAX_TAGS} tags at most.`))).toBe(
      '8 tags at most.',
    );
  });

  it('passes every one of the hook’s own sentences through, word for word', () => {
    for (const sentence of SPOT_SUBMISSION_REFUSALS) {
      expect(spotSubmissionRefusal(refusal(400, sentence))).toBe(sentence);
    }
  });

  it('keeps PocketBase’s own wording away from the rider', () => {
    // A schema validation failure: the field errors are for a developer.
    expect(
      spotSubmissionRefusal(
        refusal(400, 'Failed to create record.', {
          tags: { code: 'validation_invalid_json', message: 'Must be a valid json value.' },
        }),
      ),
    ).toBeNull();
    // What a hook that falls over sends — the nameless 400 of LESSONS §3.
    expect(
      spotSubmissionRefusal(refusal(400, 'Something went wrong while processing your request.')),
    ).toBeNull();
  });

  it('matches exactly, so a sentence nobody listed falls back to the apology', () => {
    expect(spotSubmissionRefusal(refusal(400, '8 tags at most'))).toBeNull();
    expect(spotSubmissionRefusal(refusal(400, '8 tags at most. Also: stack trace'))).toBeNull();
  });

  it('answers for a 400 only — a 429 or a 403 is the action’s other branches', () => {
    expect(spotSubmissionRefusal(refusal(429, '8 tags at most.'))).toBeNull();
    expect(spotSubmissionRefusal(refusal(403, 'Give the spot a name.'))).toBeNull();
    expect(spotSubmissionRefusal(refusal(500, 'Give the spot a name.'))).toBeNull();
  });

  it('returns null for anything that is not a server refusal at all', () => {
    expect(spotSubmissionRefusal(new Error('8 tags at most.'))).toBeNull();
    expect(spotSubmissionRefusal({ status: 400 })).toBeNull();
    expect(spotSubmissionRefusal('8 tags at most.')).toBeNull();
    expect(spotSubmissionRefusal(null)).toBeNull();
    expect(spotSubmissionRefusal(undefined)).toBeNull();
  });
});
