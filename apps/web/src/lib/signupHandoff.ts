/**
 * The cookie the landing page's hero field uses to hand an address to sign-up.
 *
 * A module of its own because `app/landingActions.ts` carries `'use server'`,
 * and every export from such a file has to be an async function — a plain
 * constant beside the action does not compile. Three places need this name:
 * the action that sets it, the sign-up page that reads it, and `signUpAction`
 * which deletes it once it has been used.
 *
 * **Why a cookie and not a query string** (owner, 2026-09-04, in chat): the
 * address belongs to someone who is very often a child, and `?email=` would
 * put it in their browser history, in the referrer of anything the sign-up
 * page loads, and in any log that records paths. `stripQuery` keeps query
 * strings out of PostHog and Sentry, but those are the two places we control.
 */
export const SIGNUP_EMAIL_COOKIE = 'ltt_signup_email';

/**
 * Long enough to walk to the next page, short enough not to be a record.
 *
 * `signUpAction` deletes the cookie on the ordinary path; this is what covers
 * the visitor who types an address, lands on sign-up and closes the tab.
 */
export const SIGNUP_EMAIL_MAX_AGE = 60 * 10;
