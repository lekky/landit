import { isSiteLive } from '@landit/core';

/**
 * `isSiteLive` bound to this process's environment.
 *
 * The decision is in `@landit/core` and is pure — it takes the values rather
 * than reading them — so that it can be unit tested without an environment
 * (`launch.test.ts`). This is the one-line adapter that supplies them, and it
 * exists so that the two server-side callers outside the proxy (`robots.ts` and
 * the holding page) read the flag the same way rather than each spelling out
 * `process.env` and disagreeing about what an empty string means.
 *
 * Deliberately **not** `NEXT_PUBLIC_`: a build-time-inlined flag could not be
 * flipped without a rebuild, and the browser has no business knowing.
 */
export function isLiveFromEnv(): boolean {
  return isSiteLive({
    siteLive: process.env.LANDIT_SITE_LIVE,
    isProduction: process.env.NODE_ENV === 'production',
  });
}
