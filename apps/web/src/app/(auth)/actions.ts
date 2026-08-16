'use server';

import { AGE_BANDS, signupOutcome, type AgeBand } from '@landit/core';
import {
  confirmPasswordReset,
  createServerClient,
  requestPasswordReset,
  signIn,
  signUp,
} from '@landit/db';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ROUTES } from '@/lib/routes';
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

  redirect(ROUTES.account);
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

/* ----------------------------------------------------------------- session -- */

async function startSession(email: string, password: string): Promise<void> {
  const { token } = await signIn(createServerClient(), { identity: email, password });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
}
