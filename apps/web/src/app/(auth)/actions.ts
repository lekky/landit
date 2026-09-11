'use server';

import { AGE_BANDS, signupOutcome, type AgeBand } from '@landit/core';
import {
  confirmPasswordReset,
  confirmVerification,
  createServerClient,
  requestGuardianConsent,
  requestPasswordReset,
  requestVerification,
  signIn,
  signUp,
} from '@landit/db';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  AUTH_COPY,
  passwordProblem,
  resetRefusal,
  signInRefusal,
  signUpRefusal,
  verifyRefusal,
  type AuthRefusalReason,
} from '@/lib/authRefusal';
import { ROUTES, safeReturnTo } from '@/lib/routes';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/session';
import { SIGNUP_EMAIL_COOKIE } from '@/lib/signupHandoff';

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
 *
 * **And no PocketBase text.** When PocketBase refuses, what the rider reads is
 * copy from `lib/authRefusal.ts`, chosen from PocketBase's error *codes* —
 * never its messages, which used to reach the screen as "VALUE MUST BE UNIQUE."
 * (issue #370). That file has the shapes, observed, and the reasoning.
 */

export interface AuthFormState {
  /** Field name to the message under it. `form` is the one above the button. */
  readonly errors?: Readonly<Record<string, string>>;
  /** Shown instead of the form once something has been sent. */
  readonly done?: boolean;
  /**
   * Why the answer was no, from a fixed list. The form reads it for the two
   * refusals it draws a way out of — a taken email, a dead link — and sends it
   * as `auth_refused`'s `reason`. Never PocketBase's words and never anything
   * the rider typed.
   */
  readonly refused?: AuthRefusalReason;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function text(form: FormData, key: string): string {
  return String(form.get(key) ?? '').trim();
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
  const guardianEmail = text(form, 'guardian_email').toLowerCase();

  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = 'Tell us what to call you';
  if (!EMAIL.test(email)) errors.email = AUTH_COPY.emailInvalid;
  const passwordError = passwordProblem(password);
  if (passwordError) errors.password = passwordError;
  if (!country) errors.country = 'Pick where you live';
  if (!isAgeBand(band)) errors.dob = 'We need your date of birth';
  // Optional by decision (issue #182, owner in chat 2026-08-18) — a rider who
  // does not know the address still gets an account. Wrong is different from
  // absent, though, and a typo here is a parent who never hears from us.
  if (guardianEmail && !EMAIL.test(guardianEmail)) {
    errors.guardian_email = AUTH_COPY.emailInvalid;
  }

  if (Object.keys(errors).length) return { errors, refused: 'invalid' };

  // The browser has already said so and shown the explanation; this is the
  // server refusing to be talked past. PocketBase refuses it a third time.
  // `invalid` rather than a reason of its own: an analytics count of declined
  // sign-ups would be a count of American under-13s, which is a fact about
  // children's ages this product has no business sending anywhere.
  if (isAgeBand(band) && signupOutcome(country, band) === 'declined') {
    return { errors: { dob: 'We cannot open an account for this rider yet.' }, refused: 'invalid' };
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
    return signUpRefusal(error);
  }

  // The account exists, so the landing page's hand-over has done its job and the
  // address it parked is no longer needed (`app/landingActions.ts`). Its
  // ten-minute expiry is the backstop; this is the ordinary path.
  (await cookies()).delete(SIGNUP_EMAIL_COOKIE);

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

  let token = '';
  try {
    token = await startSession(email, password);
  } catch {
    // The account exists; only the sign-in that follows it failed. Sending them
    // to sign in by hand is better than an error page over a working account.
    redirect(ROUTES.signIn);
  }

  /**
   * Ask the grown-up, if the rider gave us one.
   *
   * **After the session, not before**: the consent route requires the rider's
   * own token (`$apis.requireAuth('users')`), which is the same rule that stops
   * anyone else asking on their behalf.
   *
   * Only when the gate actually applies. A rider who is not gated and typed an
   * address anyway has not asked us to email a stranger, and we do not.
   *
   * Best-effort, like the confirmation email above it: a request that fails to
   * send has not stopped the account being made, and the panel on `/account`
   * is still there to send it again. Failing sign-up here would tell a child
   * their account did not work because *our* mailer did not.
   */
  if (guardianEmail && signupOutcome(country, band as AgeBand) === 'consent_required') {
    try {
      await requestGuardianConsent(createServerClient({ token }), guardianEmail);
    } catch {
      // Swallowed on purpose — see above.
    }
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
    return { errors: { form: 'Email and password, please' }, refused: 'invalid' };
  }

  try {
    await startSession(email, password);
  } catch (error) {
    // Deliberately one message for both halves: saying which was wrong tells an
    // attacker which addresses have accounts. `signInRefusal` keeps that, and
    // splits off only "the server did not answer", which says nothing about
    // the address.
    return signInRefusal(error);
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

  if (!token) return { errors: { form: 'That reset link is not complete.' }, refused: 'dead_link' };
  const passwordError = passwordProblem(password);
  if (passwordError) return { errors: { password: passwordError }, refused: 'invalid' };

  try {
    await confirmPasswordReset(createServerClient(), { token, password });
  } catch (error) {
    return resetRefusal(error);
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
  if (!token) return { errors: { form: 'That link is not complete.' }, refused: 'dead_link' };

  try {
    await confirmVerification(createServerClient(), token);
  } catch (error) {
    return verifyRefusal(error);
  }
  return { done: true };
}

/* ----------------------------------------------------------------- session -- */

async function startSession(email: string, password: string): Promise<string> {
  const { token } = await signIn(createServerClient(), { identity: email, password });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
  return token;
}
