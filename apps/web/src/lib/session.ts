import { createServerClient, refreshAuth, type Client, type UsersRecord } from '@landit/db';
import { cookies } from 'next/headers';

/**
 * The signed-in rider, on the server.
 *
 * The token lives in an **httpOnly** cookie rather than in the SDK's usual
 * `localStorage` auth store. Two reasons, and the second is the one that
 * matters here: a server component cannot read `localStorage`, so every screen
 * would have to be a client component that fetches after it renders; and a token
 * script can read is a token an injected script can take, on a service whose
 * users are children.
 *
 * Nothing in this file decides what a rider may see. Every read goes through
 * `createServerClient` carrying *their* token, so the API rules apply exactly as
 * they would in the browser (plan §3). The superuser client is not used here at
 * all — a page that renders as the product rather than as the rider would have
 * to opt into that deliberately.
 */

export const SESSION_COOKIE = 'landit_auth';

/**
 * Fourteen days. Long enough that a rider is not signed out between sessions,
 * short enough that a shared or lost device is not a permanent handover — and
 * `refreshAuth` re-checks the token against the server on every request anyway,
 * so a suspended or deleted account stops working immediately rather than when
 * this expires.
 */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 14;

export interface RiderSession {
  readonly token: string;
  readonly rider: UsersRecord;
  /** A per-request client carrying this rider's token. */
  readonly client: Client;
}

/** The cookie options every place that writes the session must agree on. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  };
}

/**
 * Who is signed in, or `null`.
 *
 * Fails soft on purpose: an expired token, a deleted account, a PocketBase that
 * is not running — all of them mean "nobody is signed in" as far as a page is
 * concerned. A signed-out landing page should not 500 because the database is
 * down.
 */
export async function currentRider(): Promise<RiderSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const client = createServerClient({ token });
    // Re-checked against the server, never trusted as a decoded blob: this is
    // also where a band transition is noticed, so `consent_state` is current
    // rather than whatever it was when the token was minted.
    const { rider } = await refreshAuth(client);
    return { token, rider, client };
  } catch {
    return null;
  }
}

/** The signed-in rider, or throw. For pages that have already redirected guests. */
export async function requireRider(): Promise<RiderSession> {
  const session = await currentRider();
  if (!session) throw new Error('No signed-in rider');
  return session;
}

/** An anonymous client, for the guardian pages nobody signs in to. */
export function anonymousClient(): Client {
  return createServerClient();
}
