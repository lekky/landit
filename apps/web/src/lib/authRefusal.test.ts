import { describe, expect, it } from 'vitest';

import {
  AUTH_COPY,
  AUTH_REFUSAL_REASONS,
  MAX_PASSWORD_BYTES,
  passwordProblem,
  resetRefusal,
  signInRefusal,
  signUpRefusal,
  verifyRefusal,
  type AuthRefusal,
} from './authRefusal';

/**
 * The refusal mapping for the auth forms (issue #370).
 *
 * Every fixture below is the shape a real PocketBase 0.39 returned on
 * 2026-09-11 — the SDK's `ClientResponseError` carries it as `status` and
 * `response` — so a test here is a claim about the wire, not about a guess at
 * it. The `message` values are PocketBase's own, kept in so the "never shown"
 * assertions have the real strings to look for.
 */

function pocketbase(status: number, body: { message?: string; data?: unknown }) {
  return { status, response: { status, ...body }, message: body.message ?? '' };
}

const TAKEN = pocketbase(400, {
  message: 'Failed to create record.',
  data: { email: { code: 'validation_not_unique', message: 'Value must be unique.' } },
});
const BAD_EMAIL = pocketbase(400, {
  message: 'Failed to create record.',
  data: { email: { code: 'validation_is_email', message: 'Must be a valid email address.' } },
});
const LONG_PASSWORD = pocketbase(400, {
  message: 'Failed to create record.',
  data: {
    password: {
      code: 'validation_max_text_constraint',
      message: 'Must be less than 72 character(s).',
    },
  },
});
const NAMELESS = pocketbase(400, { message: 'Failed to create record.', data: {} });
const DECLINED = pocketbase(400, {
  message: 'We cannot open an account for a rider under 13 in the United States yet.',
  data: {},
});
const WRONG_PASSWORD = pocketbase(400, { message: 'Failed to authenticate.', data: {} });
const DEAD_RESET = pocketbase(400, {
  message: 'An error occurred while validating the submitted data.',
  data: { token: { code: 'validation_invalid_token', message: 'Invalid or expired token.' } },
});
const DEAD_VERIFY = pocketbase(400, {
  message: 'An error occurred while validating the submitted data.',
  data: {
    token: { code: 'validation_invalid_token_claims', message: 'Missing email token claim.' },
  },
});
/** What the SDK throws when nothing answered at all. */
const UNREACHABLE = { status: 0, response: {}, message: 'Something went wrong.' };
const RATE_LIMITED = pocketbase(429, { message: 'Too Many Requests.', data: {} });
const BROKEN = pocketbase(500, { message: 'Something went wrong while processing your request.' });

const POCKETBASE_WORDS = [
  /failed to/i,
  /must be/i,
  /unique/i,
  /validating/i,
  /token/i,
  /under 13/i,
  /too many/i,
  /processing/i,
];

/** Every string a refusal would put on screen. */
function shown(refusal: AuthRefusal): string {
  return Object.values(refusal.errors).join(' | ');
}

describe('sign-up', () => {
  it('says a taken email is taken, under the email field', () => {
    expect(signUpRefusal(TAKEN)).toEqual({
      refused: 'email_taken',
      errors: { email: AUTH_COPY.emailTaken },
    });
  });

  it('puts a malformed email under the email field', () => {
    expect(signUpRefusal(BAD_EMAIL)).toEqual({
      refused: 'invalid',
      errors: { email: AUTH_COPY.emailInvalid },
    });
  });

  it('puts a refused password under the password field', () => {
    expect(signUpRefusal(LONG_PASSWORD)).toEqual({
      refused: 'invalid',
      errors: { password: AUTH_COPY.passwordRefused },
    });
  });

  it('falls back to its own line for anything it does not recognise', () => {
    for (const error of [
      NAMELESS,
      DECLINED,
      UNREACHABLE,
      BROKEN,
      undefined,
      'boom',
      new Error('x'),
    ]) {
      expect(signUpRefusal(error)).toEqual({
        refused: 'other',
        errors: { form: AUTH_COPY.signUpFailed },
      });
    }
  });
});

describe('sign-in', () => {
  it('gives a wrong password one line that does not say which half was wrong', () => {
    expect(signInRefusal(WRONG_PASSWORD)).toEqual({
      refused: 'bad_credentials',
      errors: { form: AUTH_COPY.badCredentials },
    });
    // The line itself must not lean either way.
    expect(AUTH_COPY.badCredentials).toMatch(/email and password/i);
    expect(AUTH_COPY.badCredentials).not.toMatch(/no account|not registered|wrong password/i);
  });

  it('does not blame the rider when the server could not answer', () => {
    for (const error of [UNREACHABLE, RATE_LIMITED, BROKEN, new TypeError('fetch failed')]) {
      expect(signInRefusal(error)).toEqual({
        refused: 'other',
        errors: { form: AUTH_COPY.tryAgain },
      });
    }
  });
});

describe('the emailed links', () => {
  it('says a dead reset link has expired', () => {
    expect(resetRefusal(DEAD_RESET)).toEqual({
      refused: 'dead_link',
      errors: { form: AUTH_COPY.linkDead },
    });
    // PocketBase sometimes names nothing; the link is still the likely culprit.
    expect(resetRefusal(NAMELESS).refused).toBe('dead_link');
  });

  it('puts a refused new password under its field, not on the link', () => {
    expect(resetRefusal(LONG_PASSWORD)).toEqual({
      refused: 'invalid',
      errors: { password: AUTH_COPY.passwordRefused },
    });
  });

  it('says a dead confirmation link has expired', () => {
    expect(verifyRefusal(DEAD_VERIFY)).toEqual({
      refused: 'dead_link',
      errors: { form: AUTH_COPY.linkDead },
    });
  });

  it('does not call a link dead when the server could not answer', () => {
    for (const error of [UNREACHABLE, RATE_LIMITED, BROKEN]) {
      expect(resetRefusal(error).refused).toBe('other');
      expect(verifyRefusal(error).refused).toBe('other');
    }
  });
});

describe("PocketBase's own words", () => {
  const every = [
    TAKEN,
    BAD_EMAIL,
    LONG_PASSWORD,
    NAMELESS,
    DECLINED,
    WRONG_PASSWORD,
    DEAD_RESET,
    DEAD_VERIFY,
    UNREACHABLE,
    RATE_LIMITED,
    BROKEN,
  ];

  it('never reach the screen, from any form', () => {
    for (const error of every) {
      for (const map of [signUpRefusal, signInRefusal, resetRefusal, verifyRefusal]) {
        const text = shown(map(error));
        for (const word of POCKETBASE_WORDS) expect(text).not.toMatch(word);
      }
    }
  });

  it('are not read even when they are the only thing that differs', () => {
    // A message planted where an older version of this code looked first. If
    // anything here read `message`, this string would come out the other side.
    const planted = {
      status: 400,
      response: {
        message: 'PLANTED-TOP',
        data: { email: { code: 'validation_not_unique', message: 'PLANTED-FIELD' } },
      },
      message: 'PLANTED-ERROR',
    };
    for (const map of [signUpRefusal, signInRefusal, resetRefusal, verifyRefusal]) {
      expect(shown(map(planted))).not.toMatch(/PLANTED/);
    }
  });
});

describe('the reasons', () => {
  it('are all reachable, so the analytics property has no dead values', () => {
    const produced = new Set([
      signUpRefusal(TAKEN).refused,
      signUpRefusal(BAD_EMAIL).refused,
      signUpRefusal(NAMELESS).refused,
      signInRefusal(WRONG_PASSWORD).refused,
      resetRefusal(DEAD_RESET).refused,
      verifyRefusal(DEAD_VERIFY).refused,
    ]);
    expect([...produced].sort()).toEqual([...AUTH_REFUSAL_REASONS].sort());
  });

  it('are fixed strings in one naming shape, like the event names they travel with', () => {
    for (const reason of AUTH_REFUSAL_REASONS) expect(reason).toMatch(/^[a-z]+(_[a-z]+)*$/);
  });
});

describe('passwordProblem', () => {
  it('holds the minimum', () => {
    expect(passwordProblem('')).toBe(AUTH_COPY.passwordShort);
    expect(passwordProblem('1234567')).toBe(AUTH_COPY.passwordShort);
    expect(passwordProblem('12345678')).toBeNull();
  });

  it('holds the maximum PocketBase will actually take', () => {
    expect(passwordProblem('x'.repeat(MAX_PASSWORD_BYTES))).toBeNull();
    // 72 is refused by PocketBase's field limit; 73 by the hash, naming nothing.
    expect(passwordProblem('x'.repeat(MAX_PASSWORD_BYTES + 1))).toBe(AUTH_COPY.passwordLong);
    expect(passwordProblem('x'.repeat(100))).toBe(AUTH_COPY.passwordLong);
  });

  it('counts bytes, because the hash does', () => {
    // 36 accented letters: 36 characters, 72 bytes.
    expect(passwordProblem('é'.repeat(36))).toBe(AUTH_COPY.passwordLong);
    expect(passwordProblem('é'.repeat(35))).toBeNull();
  });
});
