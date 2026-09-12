/**
 * What the sign-up, sign-in, reset and confirmation forms say when the server
 * says no — and, as much the point, what they never say (issue #370).
 *
 * **PocketBase's own words never reach a rider.** They used to: the actions
 * preferred PocketBase's `message`, or failing that the first field's, over the
 * copy written for each form, so a phone showed "VALUE MUST BE UNIQUE." for a
 * taken email (which value? unique how?) and "An error occurred while
 * validating the submitted data." for a dead reset link. Every fallback in
 * `actions.ts` was dead code. PocketBase writes those strings for developers
 * reading an API response, in its own voice and in English only, and a new
 * PocketBase release is free to reword them — so a screen that echoed them was
 * one upgrade away from saying something nobody here ever read.
 *
 * So this reads PocketBase's **codes**, which are its API contract, and never
 * its messages. Each form gets a short list of refusals it recognises, each
 * mapped to copy written here, and everything else lands on that form's own
 * fallback. Nothing in this file reads a `message` property, and the tests hand
 * it hostile ones to prove it.
 *
 * The shapes below are PocketBase 0.39's, observed against a real instance on
 * 2026-09-11 rather than taken from its docs:
 *
 *  - **Sign-up, email taken**: `400`, `data.email.code = 'validation_not_unique'`,
 *    top-level message "Failed to create record.".
 *  - **Sign-up, email malformed**: `400`, `data.email.code = 'validation_is_email'`.
 *  - **Sign-up, password of 72 characters**: `400`,
 *    `data.password.code = 'validation_max_text_constraint'`. From 73 up the
 *    hash itself refuses it and `data` comes back **empty** — which is why
 *    `passwordProblem` checks the length before PocketBase is ever asked.
 *  - **Sign-up, a US under-13 past the client**: `400`, empty `data`, the
 *    consent hook's own sentence as the message. The action refuses it first.
 *  - **Sign-in, wrong password _and_ unknown email**: the same `400`, empty
 *    `data`, "Failed to authenticate." — PocketBase does not say which, and
 *    neither do we.
 *  - **Reset, bogus or used token**: `400`, `data.token.code =
 *    'validation_invalid_token'`.
 *  - **Confirm, bogus token**: `400`, `data.token.code =
 *    'validation_invalid_token_claims'`.
 *
 * **The reasons are also an analytics property** (`auth_refused`, in
 * `analytics.ts`), which is why they are a closed list of strings chosen here:
 * the server picks one, and nothing a rider typed can become one.
 *
 * Pure on purpose, like `analytics.ts`: no React, no Next, no SDK import, so a
 * node test can hold every mapping without a PocketBase or a browser.
 */

/** The four forms that can be refused. The `form` property of `auth_refused`. */
export const AUTH_FORMS = ['signup', 'signin', 'reset', 'verify'] as const;
export type AuthForm = (typeof AUTH_FORMS)[number];

/**
 * Why a form was refused. The `reason` property of `auth_refused`.
 *
 *  - `email_taken` — sign-up, and the address already has an account.
 *  - `bad_credentials` — sign-in, and the email and password do not match an
 *    account. Deliberately one reason for both halves (see `signInRefusal`).
 *  - `dead_link` — a reset or confirmation token PocketBase would not accept:
 *    expired, already used, or never real.
 *  - `invalid` — something the rider can fix in the form itself: a short name,
 *    a malformed email, a password outside the limits.
 *  - `other` — anything not recognised above, including our end being down.
 */
export const AUTH_REFUSAL_REASONS = [
  'email_taken',
  'bad_credentials',
  'dead_link',
  'invalid',
  'other',
] as const;
export type AuthRefusalReason = (typeof AUTH_REFUSAL_REASONS)[number];

/** What an action hands back when it says no. `AuthFormState` extends this shape. */
export interface AuthRefusal {
  readonly refused: AuthRefusalReason;
  /** Field name to the message under it. `form` is the one above the button. */
  readonly errors: Readonly<Record<string, string>>;
}

/** Eight is PocketBase's minimum for the users collection, and ours. */
export const MIN_PASSWORD = 8;

/**
 * The longest password PocketBase will take, in UTF-8 bytes.
 *
 * Observed, not configured: 71 characters are accepted, 72 are refused by the
 * field's text limit, and from 73 the password hash refuses them with no field
 * named at all — so a long passphrase used to earn "We could not make that
 * account." and no idea why. Counted in bytes because the hash counts bytes;
 * an accented letter is two, and a limit in characters would let those through
 * to the refusal that names nothing.
 */
export const MAX_PASSWORD_BYTES = 71;

/**
 * The copy, in one place, so the unit tests and the e2e spec assert the same
 * strings the forms show. Short and plain, in the voice of the lines that were
 * already here.
 */
export const AUTH_COPY = {
  emailTaken: 'That email already has an account.',
  /** The link the sign-up form draws after `emailTaken`, to `/signin`. */
  signInInstead: 'Sign in instead?',
  emailInvalid: 'That email doesn’t look right',
  passwordShort: `${MIN_PASSWORD} characters minimum`,
  passwordLong: `${MAX_PASSWORD_BYTES} characters at most`,
  passwordRefused: 'That password will not work. Try another',
  signUpFailed: 'We could not make that account.',
  badCredentials: 'That email and password do not match an account',
  tryAgain: 'We could not check that just now. Try again in a minute.',
  linkDead: 'That link has expired.',
  /** The way out of a dead reset link, linked to `/forgot-password`. */
  resetAgain: 'Ask for a fresh one',
  /** The way out of a dead confirmation link, linked to the dashboard. */
  verifyAgain: 'Get a fresh one from your dashboard',
} as const;

/** The password's problem, if it has one, in the words shown under the field. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD) return AUTH_COPY.passwordShort;
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return AUTH_COPY.passwordLong;
  }
  return null;
}

/* ------------------------------------------------------------ the mappings -- */

/**
 * The status and the per-field **codes** out of whatever the SDK threw.
 *
 * Typed as `unknown` in, because a server action's `catch` gets anything: the
 * SDK's `ClientResponseError` (`status`, `response.data`), a `TypeError` from a
 * dropped connection, a string. Anything without a numeric status reads as `0`,
 * which is what the SDK itself reports when the server could not be reached.
 */
function readFailure(error: unknown): { status: number; codes: Readonly<Record<string, string>> } {
  const shaped = (error ?? {}) as { status?: unknown; response?: { data?: unknown } };
  const status = typeof shaped.status === 'number' ? shaped.status : 0;
  const data = shaped.response?.data;
  const codes: Record<string, string> = {};
  if (data && typeof data === 'object') {
    for (const [field, value] of Object.entries(data)) {
      const code = (value as { code?: unknown } | null)?.code;
      if (typeof code === 'string') codes[field] = code;
    }
  }
  return { status, codes };
}

/**
 * The server was not there to ask, or asked us to slow down. Not the rider's
 * doing, so no form should blame their input or their link for it: status 0
 * is the SDK's "no response", 429 is PocketBase's rate limit, 5xx is ours.
 */
function unavailable(status: number): boolean {
  return status === 0 || status === 429 || status >= 500;
}

/**
 * Sign-up refused by PocketBase.
 *
 * **Saying an email is taken tells the reader an account exists**, and that is
 * a trade made knowingly rather than missed. Sign-in and the reset request
 * refuse to answer that question (see their actions), but on sign-up the
 * question is already answered: the users collection's create endpoint is
 * public, and it returns `validation_not_unique` to anybody who posts to it,
 * with or without this screen. Hiding it here would protect nothing and would
 * leave a rider who already has an account retyping five fields into a form
 * that can never accept them — which is issue #370.
 */
export function signUpRefusal(error: unknown): AuthRefusal {
  const { codes } = readFailure(error);
  if (codes.email === 'validation_not_unique') {
    return { refused: 'email_taken', errors: { email: AUTH_COPY.emailTaken } };
  }
  if (codes.email) return { refused: 'invalid', errors: { email: AUTH_COPY.emailInvalid } };
  if (codes.password) {
    return { refused: 'invalid', errors: { password: AUTH_COPY.passwordRefused } };
  }
  return { refused: 'other', errors: { form: AUTH_COPY.signUpFailed } };
}

/**
 * Sign-in refused.
 *
 * One message for a wrong password and an unknown email, because PocketBase
 * gives one answer for both and any difference we drew would tell an attacker
 * which addresses have accounts — the reason `signInAction` always had. The one
 * split made is the one that reveals nothing about the address: when the server
 * could not answer at all, "that does not match" would be a lie, and a rider
 * would go and reset a password that was right.
 */
export function signInRefusal(error: unknown): AuthRefusal {
  const { status } = readFailure(error);
  if (unavailable(status)) return { refused: 'other', errors: { form: AUTH_COPY.tryAgain } };
  return { refused: 'bad_credentials', errors: { form: AUTH_COPY.badCredentials } };
}

/**
 * Setting a new password refused.
 *
 * Any refusal that names the token, or names nothing, is the link: expired,
 * already used (a reset changes the password the token was signed against), or
 * never real. The form draws the way to a fresh one beside it. A refusal that
 * names only the password is the rider's to fix and goes under that field —
 * `passwordProblem` should have caught it first, so this is the backstop.
 */
export function resetRefusal(error: unknown): AuthRefusal {
  const { status, codes } = readFailure(error);
  if (unavailable(status)) return { refused: 'other', errors: { form: AUTH_COPY.tryAgain } };
  if (codes.password && !codes.token) {
    return { refused: 'invalid', errors: { password: AUTH_COPY.passwordRefused } };
  }
  return { refused: 'dead_link', errors: { form: AUTH_COPY.linkDead } };
}

/** Confirming an email refused. The only thing in the request is the token. */
export function verifyRefusal(error: unknown): AuthRefusal {
  const { status } = readFailure(error);
  if (unavailable(status)) return { refused: 'other', errors: { form: AUTH_COPY.tryAgain } };
  return { refused: 'dead_link', errors: { form: AUTH_COPY.linkDead } };
}
