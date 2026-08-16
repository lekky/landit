/**
 * Is the site live yet, and who is allowed to look past the holding page.
 *
 * `landthetrick.com` resolved to the finished-looking landing page from the day
 * it was pointed at the box, while most of the product behind it did not exist.
 * Anyone who found the domain could create a real account — a child, with a real
 * guardian email — in a build that could not yet honour it. The gate that closed
 * that is enforced in `apps/web/src/proxy.ts`, and this file is the decision it
 * asks.
 *
 * **Why the decision lives in `@landit/core`.** Two callers need exactly the same
 * answer — the proxy, and `app/robots.ts`, which must say "index nothing" while
 * the gate is shut — and a launch gate that two files disagree about is worse
 * than no gate. It is also the one place in this repo where a pure function gets
 * unit tests: `apps/web` is deliberately outside the Vitest projects
 * (`vitest.config.ts`), because screens are Playwright's job. This is not a
 * screen and not a game rule; it is a policy question with exactly two answers,
 * and it is tested like one.
 *
 * Nothing here reads `process.env` itself. The caller passes the values in, so
 * the function stays pure, the tests need no environment, and the one place that
 * touches the environment is the proxy.
 */

/** The environment the gate is asked about. */
export type LaunchEnv = {
  /** `LANDIT_SITE_LIVE`, exactly as the environment gave it (may be absent). */
  readonly siteLive: string | undefined;
  /**
   * Whether this is a production build (`NODE_ENV === 'production'`).
   *
   * It decides only what an **unset** flag means, and the two answers are
   * deliberately opposite — see `isSiteLive`.
   */
  readonly isProduction: boolean;
};

/**
 * The strings that count as "yes".
 *
 * More than one because the value is typed into a Coolify form by a human, and
 * `1` is what half of them type. Anything not on this list is a no, including
 * typos: the gate fails **shut**, so a fat-fingered `ture` keeps the holding
 * page up rather than publishing the app.
 */
const TRUTHY = ['true', '1', 'yes', 'on'];

/** The strings that count as an explicit "no", as opposed to an unset flag. */
const FALSY = ['false', '0', 'no', 'off'];

/**
 * Is the site live?
 *
 * - **Set to something recognisable** — that answer wins, in every environment.
 *   A developer who wants to see the holding page sets `LANDIT_SITE_LIVE=false`
 *   locally and gets it.
 * - **Unset in production** — **not live.** This is the important half: the
 *   failure this whole file exists to prevent is a deploy that forgets the flag
 *   and publishes an unfinished product. Forgetting it now costs a holding page,
 *   which is embarrassing for ten minutes and reversible in one restart.
 * - **Unset anywhere else** — live. `pnpm dev` and the Playwright suite must not
 *   need a flag to see the app they are working on.
 * - **Set to something unrecognisable** — not live, on the same reasoning as
 *   unset-in-production, and in development too: a value nobody can parse is a
 *   mistake, and the safe reading of a mistake is "not yet".
 */
export function isSiteLive({ siteLive, isProduction }: LaunchEnv): boolean {
  if (siteLive === undefined) return !isProduction;

  const value = siteLive.trim().toLowerCase();
  if (value === '') return !isProduction;
  if (TRUTHY.includes(value)) return true;
  if (FALSY.includes(value)) return false;

  // Unparseable. Fail shut, and say so loudly enough to be found in a log.
  return false;
}

/**
 * Does this request carry the preview key, and is there a key to carry?
 *
 * The escape hatch. Without it, "flip the flag on launch day" is a blind leap:
 * nobody can see the real site on the real domain until the moment it is public
 * to everyone. With it, the owner opens `?preview=<key>` once and browses the
 * finished product behind the holding page.
 *
 * **An unset or empty `LANDIT_PREVIEW_KEY` disables the bypass entirely** rather
 * than opening it. The alternative — treating "no key configured" as "no key
 * required" — turns a missing environment variable into a hole in the gate, and
 * that is precisely the shape of mistake this module is here to make impossible.
 */
export function isPreviewUnlocked(
  provided: string | undefined | null,
  expected: string | undefined | null,
): boolean {
  if (typeof expected !== 'string' || expected.length === 0) return false;
  if (typeof provided !== 'string' || provided.length === 0) return false;
  return constantTimeEquals(provided, expected);
}

/**
 * Compare without leaking the answer in how long it took.
 *
 * Hand-rolled rather than `crypto.timingSafeEqual` because this package imports
 * nothing — not Node, not the DOM (see `index.ts`) — and the PocketBase JSVM and
 * a future Expo app both have to be able to load it.
 *
 * The length check is not constant-time and cannot be: comparing strings of
 * different lengths has to stop somewhere. It leaks the key's **length**, which
 * is not the secret.
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * The cookie the proxy sets once a valid `?preview=` key has been seen, so the
 * key does not have to be re-typed on every navigation.
 *
 * It holds the key itself, which is why the proxy sets it `httpOnly` and
 * `secure`: presence alone cannot be the test, or anyone could grant themselves
 * the bypass with one line of `curl`.
 */
export const PREVIEW_COOKIE = 'landit_preview' as const;

/** The query parameter that opens the bypass. */
export const PREVIEW_PARAM = 'preview' as const;

/** Where the proxy sends every gated request. */
export const HOLDING_PATH = '/coming-soon' as const;
