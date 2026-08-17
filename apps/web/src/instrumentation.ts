import { HEALTH_DETAIL, superuserCredentialsPresent } from '@landit/db';
import * as Sentry from '@sentry/nextjs';

import { sentryEnabled, sentryOptions } from '@/lib/sentry';

/**
 * Startup checks, and error reporting. Runs once per server instance, before
 * the first request (`instrumentation.ts`, stable since Next 15).
 *
 * **Why anything is here at all** (issue #62). A deployment with no superuser
 * credentials is not broken in any way a visitor or a log line would show: pages
 * render, sign-in works, and only "I rode today" fails — softly, with a message
 * that reads like a transient blip. The first honest signal arrives when
 * somebody asks why a rider's streak never moves. So the server says it once, at
 * the top of the log, on the way up.
 *
 * **Presence only, and no network.** `register` must complete before the server
 * accepts requests, so this deliberately does not authenticate: PocketBase
 * being slow to boot must not become the web app failing to boot. Whether the
 * credentials are *accepted* is `GET /api/health`'s question, and it asks it on
 * demand.
 *
 * **A warning, not a throw.** Every screen except one works without these, and
 * refusing to start would turn a degraded deployment into an outage. The
 * health endpoint is what turns this into a red light for a monitor;
 * this is what puts the reason in the log next to it.
 */
export function register(): void {
  // Sentry first, so a failure in anything below is itself reported. Both
  // server runtimes get it; what they may send is decided in one place
  // (`@/lib/sentry`), and it is nothing at all until a DSN is set.
  if (sentryEnabled()) Sentry.init(sentryOptions());

  // Edge has no superuser client and would not be the one to complain.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  if (!superuserCredentialsPresent()) {
    console.warn(`[startup] ${HEALTH_DETAIL.missing} Check GET /api/health.`);
  }
}

/**
 * Errors Next caught before any of our code could.
 *
 * Without this hook a server component that throws is a 500 in the browser and
 * a line in a container log nobody is watching — which is the same shape of
 * silent failure issue #62 was about. Re-exported rather than wrapped: Sentry's
 * own implementation knows the request context Next hands it, and a wrapper
 * would only be a place to lose it.
 */
export const onRequestError = Sentry.captureRequestError;
