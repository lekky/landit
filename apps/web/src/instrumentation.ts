import { HEALTH_DETAIL, superuserCredentialsPresent } from '@landit/db';

/**
 * Startup checks. Runs once per server instance, before the first request
 * (`instrumentation.ts`, stable since Next 15).
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
  // Edge has no superuser client and would not be the one to complain.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  if (!superuserCredentialsPresent()) {
    console.warn(`[startup] ${HEALTH_DETAIL.missing} Check GET /api/health.`);
  }
}
