import { createSuperuserClient, MissingPocketBaseUrl, SuperuserUnavailable } from './clients';

/**
 * Is this deployment actually able to act as itself?
 *
 * **The problem this exists for** (issue #62). "I rode today" writes a
 * server-owned streak, so it needs `createSuperuserClient()`, so it needs
 * `POCKETBASE_SUPERUSER_EMAIL` and `POCKETBASE_SUPERUSER_PASSWORD`. When they
 * are absent the server action catches `SuperuserUnavailable` and tells the
 * rider "We could not record that just now. Try again in a moment." — which is
 * the right thing to say to a child, and is also indistinguishable from a
 * transient blip. A button that has never once worked looks exactly like a
 * button having a bad minute, and nobody would learn otherwise from the UI.
 *
 * So the operator gets their own answer, out loud, in a place a health check can
 * read. The same credentials are wanted by T15's Stripe webhook and T16's admin
 * actions, so this is not one button's problem.
 *
 * **It reports, it never throws.** A health check that throws is a health check
 * that 500s with a stack trace instead of naming what is wrong.
 *
 * **And it never says what the credentials are.** The whole value is in
 * distinguishing "nobody set them" from "they are set and PocketBase refused
 * them" from "PocketBase is not answering" — three different jobs for whoever is
 * holding the pager. None of them needs the email, the password, or the URL, and
 * this result is served over HTTP, so none of them is in here.
 */

/** What is wrong with the superuser credentials, if anything. */
export type SuperuserHealth =
  /** Authenticated. The credentials are set and PocketBase accepts them. */
  | 'ok'
  /** One or both environment variables are unset or empty. */
  | 'missing'
  /** Both are set, and PocketBase rejected them. A wrong password, or a superuser that was deleted. */
  | 'rejected'
  /** Nothing to authenticate against: no URL configured, or PocketBase did not answer. */
  | 'unreachable';

export interface HealthReport {
  /** True only when every check below passed. */
  readonly ok: boolean;
  /** Whether PocketBase answered its own `/api/health`. */
  readonly pocketbase: 'ok' | 'unreachable';
  readonly superuser: SuperuserHealth;
}

/** Human-readable one-liners, for a log line rather than for a rider. */
export const HEALTH_DETAIL: Record<SuperuserHealth, string> = {
  ok: 'Superuser credentials accepted.',
  missing:
    'POCKETBASE_SUPERUSER_EMAIL and/or POCKETBASE_SUPERUSER_PASSWORD are not set. Server-side writes — the weekly streak, and later the Stripe webhook and the admin actions — will fail softly. See apps/web/.env.example.',
  rejected:
    'POCKETBASE_SUPERUSER_EMAIL and POCKETBASE_SUPERUSER_PASSWORD are set, and PocketBase refused them. The superuser may have been deleted, or the password changed.',
  unreachable:
    'Could not reach PocketBase to check the superuser credentials. Check POCKETBASE_URL / NEXT_PUBLIC_POCKETBASE_URL and that the instance is up.',
};

/**
 * Are both superuser variables present? A string check, no network.
 *
 * Separate from {@link checkHealth} because a startup check wants this and only
 * this: it runs before the server accepts its first request, and blocking that
 * on a PocketBase round trip would turn a database that is slow to boot into a
 * web app that will not boot at all.
 */
export function superuserCredentialsPresent(): boolean {
  const env = typeof process === 'undefined' ? undefined : process.env;
  return Boolean(env?.POCKETBASE_SUPERUSER_EMAIL && env?.POCKETBASE_SUPERUSER_PASSWORD);
}

async function pocketbaseReachable(url: string | undefined): Promise<boolean> {
  if (!url) return false;
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Did the request fail to get an answer at all?
 *
 * The SDK's `ClientResponseError` carries `status: 0` when the underlying fetch
 * threw rather than returning a response. Read structurally rather than by
 * importing the class: this is one property, and the check should not become a
 * reason for this module to depend on the SDK's error shape any more than it
 * already does.
 */
function isNetworkFailure(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { status?: unknown }).status === 0
  );
}

export interface HealthOptions {
  /** PocketBase base URL. Defaults to `POCKETBASE_URL`, then `NEXT_PUBLIC_POCKETBASE_URL`. */
  readonly url?: string;
}

/**
 * The full check: PocketBase answers, and the superuser credentials work.
 *
 * "Work" means an actual authentication, not a `typeof` on two environment
 * variables. A password that is set and wrong fails in exactly the same place as
 * a password that is absent, and the two need different people to fix them.
 */
export async function checkHealth(options: HealthOptions = {}): Promise<HealthReport> {
  const env = typeof process === 'undefined' ? undefined : process.env;
  const url = options.url ?? env?.POCKETBASE_URL ?? env?.NEXT_PUBLIC_POCKETBASE_URL;

  const reachable = await pocketbaseReachable(url);

  let superuser: SuperuserHealth;
  if (!superuserCredentialsPresent()) {
    superuser = 'missing';
  } else if (!reachable) {
    superuser = 'unreachable';
  } else {
    try {
      await createSuperuserClient(options.url ? { url: options.url } : {});
      superuser = 'ok';
    } catch (error) {
      // Only a refusal counts as `rejected`. `SuperuserUnavailable` here can
      // only mean the browser guard, since the variables were just confirmed
      // present; `MissingPocketBaseUrl` means there was nothing to connect to;
      // and the SDK reports a request that never got an answer as status 0,
      // which is PocketBase going away between the health ping and this call.
      // None of those is a bad password, and calling them one would send
      // somebody off to reset a credential that was fine all along.
      superuser =
        error instanceof SuperuserUnavailable ||
        error instanceof MissingPocketBaseUrl ||
        isNetworkFailure(error)
          ? 'unreachable'
          : 'rejected';
    }
  }

  return {
    ok: reachable && superuser === 'ok',
    pocketbase: reachable ? 'ok' : 'unreachable',
    superuser,
  };
}
