import * as Sentry from '@sentry/nextjs';

import { sentryEnabled, sentryOptions } from '@/lib/sentry';

/**
 * The browser half of error reporting (T18).
 *
 * Next runs this file before anything else in the client bundle. It is the
 * counterpart to `instrumentation.ts` and shares its options function, so
 * neither runtime can quietly send more than the other — see `@/lib/sentry` for
 * what is switched off and why. No session replay, no profiling, no PII.
 *
 * **Inert without a DSN**, which is every checkout and CI today: there is no
 * Sentry project provisioned (plan §6.5), and the SDK's own code is a few
 * kilobytes that initialise nothing.
 */
if (sentryEnabled()) {
  Sentry.init(sentryOptions());
}

/**
 * Client-side navigation timing, which Next asks for by name. Harmless with
 * tracing sampled at zero, and the export has to exist or Next warns on every
 * route change in development.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
