'use server';

import { AGE_BANDS, signupOutcome, type AgeBand } from '@landit/core';
import {
  confirmPasswordReset,
  confirmVerification,
  createServerClient,
  requestPasswordReset,
  requestVerification,
  signIn,
  signUp,
} from '@landit/db';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ROUTES, safeReturnTo } from '@/lib/routes';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/session';

/**
 * Signing up, signing in, signing out.
 *
 * All of it runs on the server so the rider's token can go straight into an
 * httpOnly cookie and never near a script (`lib/session.ts`).
 *
 * **What is not here is the point.** No date of birth: the browser computes an
 * age band and discards the date (plan §3, §6.2), so there is no field on this
 * action to receive one and no line of server code that could store it. And no
 * consent decision: `consent_state` is computed by the server from the declared
 * country and band on every write path, so a form that lied — or a client that
 * skipped a step — changes nothing about which side of the gate a rider lands on.
 */

export interface AuthFormState {
  /** Field name to the message under it. `form` is the one above the button. */
  readonly errors?: Readonly<Record<string, string>>;
  /** Shown instead of the form once something has been sent. */
  readonly done?: boolean;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_PASSWORD = 8;

function text(form: FormData, key: string): string {
  return String(form.get(key) ?? '').trim();
}

/** PocketBase's error message, if it left one worth showing a rider. */
function serverMessage(error: unknown, fallback: string): string {
  const response = (error as { response?: { message?: string; data?: Record<string, unknown> } })
    ?.response;
  const message = response?.message;
  if (typeof message === 'string' && message && !/failed to create record/i.test(message)) {
    return message;
  }
  const data = response?.data ?? {};
  for (const value of Object.values(data)) {
    const inner = (value as { message?: string })?.message;
    if (typeof inner === 'string' && inner) return inner;
  }
  return fallback;
}

function isAgeBand(value: string): value is AgeBand {
  return (AGE_BANDS as readonly string[]).includes(value);
}

/* -------------------------------------------------------------- signing up -- */

export async function signUpAction(
  _state: AuthFormState | undefined,
  form: FormData,
): Promise<AuthFormState> {
  const name = text(form, 'name');
  const email = text(form, 'email');
  const password = String(form.get('password') ?? '');
  const country = text(form, 'country');
  const band = text(form, 'age_band');
  const bandNextChangeOn = text(form, 'band_next_change_on');
  const timezone = text(form, 'timezone');

  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = 'Tell us what to call you';
  if (!EMAIL.test(email)) errors.email = "That email doesn't look right";
  if (password.length < MIN_PASSWORD) errors.password = `${MIN_PASSWORD} characters minimum`;
  if (!country) errors.country = 'Pick where you live';
  if (!isAgeBand(band)) errors.dob = 'We need your date of birth';

  if (Object.keys(errors).length) return { errors };

  // The browser has already said so and shown the explanation; this is the
  // server refusing to be talked past. PocketBase refuses it a third time.
  if (isAgeBand(band) && signupOutcome(country, band) === 'declined') {
    return { errors: { dob: 'We cannot open an account for this rider yet.' } };
  }

  const client = createServerClient();
  try {
    await signUp(client, {
      email,
      password,
      name,
      country,
      ageBand: band as AgeBand,
      bandNextChangeOn: bandNextChangeOn || null,
      timezone: timezone || undefined,
    });
  } catch (error) {
    return { errors: { form: serverMessage(error, 'We could not make that account.') } };
  }

  // Deliberately not awaited into the outcome: a confirmation email that fails
  // to send has not stopped an account being made, and nothing in the product
  // waits on `verified`. Telling a rider their sign-up failed because our mailer
  // was down would be a lie about what went wrong.
  try {
    await requestVerification(client, email);
  } catch {
    // The banner on every screen offers to send it again, which is a better
    // recovery than an error here would be.
  }

  try {
    await startSession(email, password);
  } catch {
    // The account exists; only the sign-in that follows it failed. Sending them
    // to sign in by hand is better than an error page over a working account.
    redirect(ROUTES.signIn);
  }
  redirect(ROUTES.onboarding);
}

/* -------------------------------------------------------------- signing in -- */

export async function signInAction(
  _state: AuthFormState | undefined,
  form: FormData,
): Promise<AuthFormState> {
  const email = text(form, 'email');
  const password = String(form.get('password') ?? '');

  if (!email || !password) {
    return { errors: { form: 'Email and password, please' } };
  }

  try {
    await startSession(email, password);
  } catch {
    // Deliberately one message for both halves: saying which was wrong tells an
    // attacker which addresses have accounts.
    return { errors: { form: 'That email and password do not match an account' } };
  }

  // Back to whatever was being asked for, or the dashboard (issue #66). The
  // form's hidden field is a value the browser can edit, so it is validated
  // here as well as where it was written — `safeReturnTo` drops anything that
  // is not a same-site absolute path rather than letting it become an open
  // redirect.
  redirect(safeReturnTo(text(form, 'next')));
}

export async function signOutAction(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect(ROUTES.home);
}

/* ---------------------------------------------------------------- password -- */

export async function requestResetAction(
  _state: AuthFormState | undefined,
  form: FormData,
): Promise<AuthFormState> {
  const email = text(form, 'email');
  if (!EMAIL.test(email)) return { errors: { email: "That email doesn't look right" } };

  try {
    await requestPasswordReset(createServerClient(), email);
  } catch {
    // Swallowed on purpose: an error here would say whether the address has an
    // account. The screen says the same thing either way.
  }
  return { done: true };
}

export async function confirmResetAction(
  _state: AuthFormState | undefined,
  form: FormData,
): Promise<AuthFormState> {
  const token = text(form, 'token');
  const password = String(form.get('password') ?? '');

  if (!token) return { errors: { form: 'That reset link is not complete.' } };
  if (password.length < MIN_PASSWORD) {
    return { errors: { password: `${MIN_PASSWORD} characters minimum` } };
  }

  try {
    await confirmPasswordReset(createServerClient(), { token, password });
  } catch (error) {
    return {
      errors: {
        form: serverMessage(error, 'That link has expired. Ask for a fresh one.'),
      },
    };
  }
  return { done: true };
}

/* ------------------------------------------------------------ verification -- */

/**
 * Send the confirmation email again.
 *
 * Takes the address from the form rather than the session, so it works from the
 * banner (where the rider is signed in) without a second code path — and, like
 * `requestReset`, says the same thing whichever answer it got. An action that
 * reported "no account with that address" would be a way to ask whether one
 * exists.
 */
export async function resendVerificationAction(
  _state: AuthFormState | undefined,
  form: FormData,
): Promise<AuthFormState> {
  const email = text(form, 'email');
  if (!EMAIL.test(email)) return { errors: { form: "That email doesn't look right" } };

  try {
    await requestVerification(createServerClient(), email);
  } catch {
    // Deliberately swallowed, same as the request path: whether an address is
    // registered is not a question this action answers.
  }
  return { done: true };
}

/**
 * Finish confirmation with the token from the email.
 *
 * A POST, not the visit itself — `/verify-email` reads the token from the query
 * and puts it in a form. Mail scanners follow links in an inbox, and a link that
 * acted on GET would be actioned by them rather than by the rider. Same
 * arrangement as the reset page and the guardian-consent links (plan §6.2).
 */
export async function confirmVerificationAction(
  _state: AuthFormState | undefined,
  form: FormData,
): Promise<AuthFormState> {
  const token = text(form, 'token');
  if (!token) return { errors: { form: 'That link is not complete.' } };

  try {
    await confirmVerification(createServerClient(), token);
  } catch (error) {
    return {
      errors: {
        form: serverMessage(error, 'That link has expired. We can send you a fresh one.'),
      },
    };
  }
  return { done: true };
}

/* ----------------------------------------------------------------- session -- */

async function startSession(email: string, password: string): Promise<void> {
  const { token } = await signIn(createServerClient(), { identity: email, password });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
}
