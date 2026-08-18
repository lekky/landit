import type { AgeBand } from '@landit/core';

import type { Client } from './clients';
import { records } from './collections';
import type { UsersRecord } from './generated/collections';

/**
 * Signing up, signing in, and the guardian-consent routes (T6).
 *
 * Two things here are not like the rest of `@landit/db`.
 *
 * **Auth records are not ordinary records.** `email`, `password` and
 * `passwordConfirm` are not columns and are not in the generated create type, so
 * sign-up goes through the SDK's auth surface rather than `records()`. Wrapping
 * it here is what keeps every screen off the raw SDK.
 *
 * **The consent routes are not collections.** `guardian_consents` has
 * `createRule: null` and its token fields are hidden, so there is deliberately no
 * client path to writing one: the flow goes through `/api/landit/consent/*`,
 * where the server mints the tokens, stores only their hashes and sends the
 * email (plan §6.2). These functions are the typed shape of those calls, and the
 * decisions behind them live in `pocketbase/hooks/90_consent.pb.js` — nothing
 * here re-decides anything.
 */

/* ------------------------------------------------------------- signing up -- */

/**
 * What the browser may send about a rider's age, and all of it.
 *
 * The date of birth is **not** in this type, and that is the point: it is
 * collected in the browser, turned into a band by `declareAge`, and discarded
 * (plan §3, §6.2). There is no field on this shape to smuggle it into.
 */
export interface AgeDeclarationInput {
  /** ISO-3166 country, `GB` or `GB-SCT`. Selects the consent threshold. */
  readonly country: string;
  readonly ageBand: AgeBand;
  /** The day the rider leaves this band, `YYYY-MM-DD`. Absent for `adult`. */
  readonly bandNextChangeOn?: string | null;
}

export interface SignUpInput extends AgeDeclarationInput {
  readonly email: string;
  readonly password: string;
  readonly name: string;
  /** IANA zone from the browser. Streaks and challenge days are computed in it. */
  readonly timezone?: string;
}

/**
 * Create an account.
 *
 * `consent_state` is not settable here and is not accepted if sent: the server
 * computes it from the country and band on every write path (§3 guarantee 4).
 * A rider below their country's threshold lands at `pending` and stays there
 * until a guardian says otherwise — this call does not decide that and cannot.
 *
 * A US under-13 is refused by the server with a message meant to be read
 * (plan §6.3); the caller shows it rather than a generic failure.
 */
export async function signUp(client: Client, input: SignUpInput): Promise<UsersRecord> {
  return client.collection('users').create<UsersRecord>({
    email: input.email,
    password: input.password,
    passwordConfirm: input.password,
    name: input.name,
    country: input.country,
    age_band: input.ageBand,
    ...(input.bandNextChangeOn ? { band_next_change_on: input.bandNextChangeOn } : {}),
    age_declared_at: new Date().toISOString(),
    ...(input.timezone ? { timezone: input.timezone } : {}),
  });
}

export interface AuthResult {
  readonly token: string;
  readonly rider: UsersRecord;
}

/** Sign in with an email address and a password. */
export async function signIn(
  client: Client,
  input: { identity: string; password: string },
): Promise<AuthResult> {
  const result = await client
    .collection('users')
    .authWithPassword<UsersRecord>(input.identity, input.password);
  return { token: result.token, rider: result.record };
}

/**
 * Re-check a token and get the rider it belongs to.
 *
 * Also where a band transition is noticed: the auth hook advances `age_band` and
 * lets consent lapse on the rider's own birthday, so the record this returns is
 * the current one rather than the one the token was minted against.
 */
export async function refreshAuth(client: Client): Promise<AuthResult> {
  const result = await client.collection('users').authRefresh<UsersRecord>();
  return { token: result.token, rider: result.record };
}

/** Send a password-reset email. Silent about whether the address is registered. */
export async function requestPasswordReset(client: Client, email: string): Promise<void> {
  await client.collection('users').requestPasswordReset(email);
}

/** Finish a reset with the token from the email. */
export async function confirmPasswordReset(
  client: Client,
  input: { token: string; password: string },
): Promise<void> {
  await client
    .collection('users')
    .confirmPasswordReset(input.token, input.password, input.password);
}

/* ----------------------------------------------------------- verification -- */

/**
 * Ask PocketBase to send the confirmation email.
 *
 * **Nothing waits on the answer.** No screen is gated on `users.verified`, no
 * API rule reads it, and sign-in ignores it — a rider who never confirms keeps
 * a whole account. What confirming buys them is the only thing that ever needed
 * it: a password reset goes to the address on the record, so an address with a
 * typo in it is an account nobody can get back into.
 *
 * That is also why this is called and not awaited on the sign-up path. A rider
 * whose confirmation email fails to send has still made an account, and telling
 * them otherwise would be a lie about what went wrong.
 *
 * Silent about whether the address is registered, for the same reason
 * `requestPasswordReset` is.
 */
export async function requestVerification(client: Client, email: string): Promise<void> {
  await client.collection('users').requestVerification(email);
}

/**
 * Finish confirmation with the token from the email.
 *
 * The token is read from the query by `/verify-email` and posted back, rather
 * than being acted on by the visit itself — the same arrangement the reset page
 * and the guardian-consent links use, and for the same reason: a link that acts
 * on GET is actioned by every mail scanner that follows links in an inbox.
 */
export async function confirmVerification(client: Client, token: string): Promise<void> {
  await client.collection('users').confirmVerification(token);
}

/* ------------------------------------------------------------- the handle -- */

/**
 * Give a rider the first handle in `candidates` that is free.
 *
 * Availability cannot be *asked* — the privacy rules mean a rider cannot see
 * another rider's record, so a handle that is taken reads as "no such rider"
 * (that indistinguishability is deliberate: a lookup that answered honestly
 * would be a way to probe for riders). The unique index is the only authority,
 * so this claims one and lets the collision be the answer.
 *
 * Returns the handle that stuck, or `null` when every candidate was taken.
 */
export async function claimHandle(
  client: Client,
  userId: string,
  candidates: readonly string[],
): Promise<string | null> {
  for (const handle of candidates) {
    try {
      const saved = await records(client, 'users').update(userId, { handle });
      return saved.handle;
    } catch (error) {
      if (isUniqueViolation(error)) continue;
      throw error;
    }
  }
  return null;
}

/** Did this write lose to a unique index — a handle somebody already holds? */
export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('status' in error)) return false;
  if (error.status !== 400) return false;
  return /unique|already/i.test(JSON.stringify((error as { response?: unknown }).response ?? {}));
}

/* ---------------------------------------------------------- guardian flow -- */

export interface ConsentRequestResult {
  readonly requested: boolean;
  readonly guardian_email: string;
  /**
   * Whether the email actually went out.
   *
   * `false` is the expected answer until the hosted instance has SMTP
   * credentials (`docs/infrastructure.md`), and the screen says so rather than
   * claiming a parent has been written to.
   */
  readonly emailed: boolean;
}

/** Ask a guardian. The rider is never handed the token this mints. */
export async function requestGuardianConsent(
  client: Client,
  guardianEmail: string,
): Promise<ConsentRequestResult> {
  return client.send('/api/landit/consent/request', {
    method: 'POST',
    body: { guardian_email: guardianEmail },
  });
}

export interface ConsentLinkPreview {
  readonly action: 'approve' | 'revoke';
  /** First name only — enough to recognise a rider, not a profile. */
  readonly rider_name: string;
  readonly granted: boolean;
  readonly revoked: boolean;
  readonly expired: boolean;
  readonly state: 'not_required' | 'pending' | 'granted' | 'revoked';
}

/**
 * What a link from a guardian's email is for, without using it.
 *
 * Read-only, which is why the email's links point at a page that asks before it
 * acts: a link that did the thing on its own would be actioned by every mail
 * scanner that touches the inbox.
 */
export async function previewConsentLink(
  client: Client,
  token: string,
): Promise<ConsentLinkPreview> {
  return client.send('/api/landit/consent/preview', { method: 'POST', body: { token } });
}

export interface ConsentDecision {
  readonly state: 'granted' | 'revoked';
  readonly rider_name: string;
}

/** The guardian says yes. */
export async function approveConsent(client: Client, token: string): Promise<ConsentDecision> {
  return client.send('/api/landit/consent/approve', { method: 'POST', body: { token } });
}

/** The guardian says no, or changes their mind. This link never expires. */
export async function revokeConsent(client: Client, token: string): Promise<ConsentDecision> {
  return client.send('/api/landit/consent/revoke', { method: 'POST', body: { token } });
}
