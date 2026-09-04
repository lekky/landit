'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ROUTES } from '@/lib/routes';
import { SIGNUP_EMAIL_COOKIE, SIGNUP_EMAIL_MAX_AGE } from '@/lib/signupHandoff';

/**
 * The hero's email field, and the one thing it does: carry an address to the
 * sign-up form so a visitor does not type it twice.
 *
 * It cannot create an account on its own — sign-up needs a name, a password, a
 * country and an age band besides (`(auth)/actions.ts`) — so this is a
 * shortcut, not a second sign-up path. That matters for the safeguarding
 * position as much as for the code: there is exactly one way to make an
 * account, and it is the one with the consent gate on it.
 *
 * The address travels in a short-lived httpOnly cookie rather than the URL;
 * `lib/signupHandoff.ts` carries the reasoning and the two constants.
 *
 * No validation beyond a shape check. The field is `type="email"` so the
 * browser has already had its say, and a visitor who defeats that lands on
 * sign-up with an empty box rather than an error about a form they have not
 * reached yet — the address is a convenience, and the real validation is
 * `signUpAction`'s. Redirecting either way is deliberate: the button says
 * "Get started", and it always starts.
 */

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** RFC 5321's ceiling. A longer string is not an address that was mistyped. */
const MAX_EMAIL = 254;

export async function startSignUpAction(form: FormData): Promise<void> {
  const email = String(form.get('email') ?? '').trim();

  if (EMAIL.test(email) && email.length <= MAX_EMAIL) {
    (await cookies()).set(SIGNUP_EMAIL_COOKIE, email, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SIGNUP_EMAIL_MAX_AGE,
    });
  }

  redirect(ROUTES.signUp);
}
