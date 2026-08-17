/**
 * What Land The Trick tells Sentry, and what it deliberately does not (T18).
 *
 * The options live here rather than inline in `instrumentation.ts` for one
 * reason: they are a **privacy decision** about a service used by children, and
 * a privacy decision inlined into a framework hook is one nobody tests. Every
 * choice below is asserted in `sentry.test.ts`, including the end-to-end one —
 * that a client built from these options actually delivers an event.
 *
 * **It is off unless a DSN is set**, and blank is the honest default for every
 * checkout and for CI. There is no Sentry project provisioned yet
 * (`docs/infrastructure.md`, plan §6.5 lists Sentry among the processors nobody
 * has contracted with), so a build that quietly started shipping a rider's
 * stack traces somewhere would be worse than one that reports nothing.
 *
 * **Three things are switched off on purpose.**
 *
 *  - `sendDefaultPii` — the SDK's own switch for attaching IP addresses,
 *    cookies and usernames to every event. On a service whose users are
 *    children, the default has to be the quiet one, and an error report is not
 *    a reason to start collecting an address we do not otherwise keep.
 *  - **Session replay and profiling** are not configured at all. A replay is a
 *    recording of a child using an app; nothing in a crash report needs one.
 *  - **Query strings are stripped** from every URL an event carries, because
 *    `/report?about=profile&id=<rider id>` is a rider id in a third party's
 *    logs — and so is the guardian-consent **path** segment, which is a live
 *    credential rather than an identifier. See `SECRET_PATHS`.
 */

// Types only, so this import is erased and nothing that reads a DSN drags the
// SDK in with it.
import type { Breadcrumb, ErrorEvent } from '@sentry/nextjs';

/** The DSN, or empty when Sentry is switched off. */
export function sentryDsn(): string {
  return (process.env.NEXT_PUBLIC_SENTRY_DSN ?? '').trim();
}

export function sentryEnabled(): boolean {
  return sentryDsn().length > 0;
}

/** Which deployment an event came from. Not a secret and not a rider fact. */
export function sentryEnvironment(): string {
  return (
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
    process.env.NODE_ENV ??
    'development'
  ).trim();
}

/**
 * URL paths that carry a capability in a **path segment** rather than a query
 * string, and are therefore invisible to `stripQuery`.
 *
 * There is one today and it is the most valuable secret in the product:
 * `/consent/approve/<token>` and `/consent/revoke/<token>` (plan §6.2). Holding
 * that token is sufficient, with no account and no sign-in, to grant or withdraw
 * a guardian's consent for a child — it is the whole of §3 guarantee 4 in a
 * string. `onRequestError` reports the full URL of any route that throws, so a
 * slow PocketBase behind that page would put a live credential into a third
 * party's issue tracker.
 *
 * Add to this list rather than reaching for a general redactor: a pattern that
 * guessed at "things that look like tokens" would be confident and wrong in both
 * directions. The real fix is not to put credentials in URLs, which is why
 * `apps/web/src/lib/routes.ts` says so — this is the belt for the one that
 * already exists.
 */
const SECRET_PATHS: readonly [RegExp, string][] = [
  [/\/consent\/(approve|revoke)\/[^/?#]+/gi, '/consent/$1/[redacted]'],
];

/**
 * Everything after the `?`, gone — and any capability-bearing path segment with
 * it.
 *
 * Exported so the test can exercise it on its own rather than only through a
 * whole event. Leaves a URL with neither exactly as it was.
 */
export function stripQuery(url: string): string {
  const cut = url.indexOf('?');
  let out = cut === -1 ? url : url.slice(0, cut);
  for (const [pattern, replacement] of SECRET_PATHS) out = out.replace(pattern, replacement);
  return out;
}

/**
 * Strip the query string from wherever an event carries one.
 *
 * Deliberately shallow and dull. A recursive scrubber over an arbitrary event
 * would be slower, harder to reason about, and would still miss whatever the
 * next SDK version adds — the honest fix for that is not to put rider data in a
 * URL in the first place, which is why `apps/web/src/lib/routes.ts` says so.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (typeof event.request?.url === 'string') {
    event.request.url = stripQuery(event.request.url);
    delete event.request.query_string;
  }
  for (const crumb of event.breadcrumbs ?? []) scrubBreadcrumb(crumb);
  return event;
}

/**
 * The same treatment for a breadcrumb on its way in, which is the earlier of the
 * two chances to catch a URL — `beforeSend` only ever sees the ones that made it
 * onto an event that is being reported.
 */
export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb {
  if (crumb.data && typeof crumb.data.url === 'string') {
    crumb.data.url = stripQuery(crumb.data.url);
  }
  return crumb;
}

/**
 * The subset both `Sentry.init` calls take.
 *
 * Typed against the SDK's own `ErrorEvent` and `Breadcrumb` rather than a local
 * approximation: a hand-rolled shape compiles right up until it stops matching
 * what the SDK passes, and then fails at runtime instead of at the build.
 */
export interface SentryOptions {
  readonly dsn: string;
  readonly enabled: boolean;
  readonly environment: string;
  readonly sendDefaultPii: false;
  readonly tracesSampleRate: number;
  readonly beforeSend: (event: ErrorEvent) => ErrorEvent;
  readonly beforeBreadcrumb: (crumb: Breadcrumb) => Breadcrumb;
}

/**
 * The options both runtimes initialise with.
 *
 * One function for server and browser because there is nothing to differ about:
 * neither is allowed to send more than the other, and two copies is how the
 * browser one quietly grows a replay.
 */
export function sentryOptions(): SentryOptions {
  return {
    dsn: sentryDsn(),
    enabled: sentryEnabled(),
    environment: sentryEnvironment(),
    sendDefaultPii: false,
    // Errors, not performance. Tracing every request would sample a child's
    // navigation into a third party's store for no benefit anybody has asked
    // for; turn it up deliberately if performance is ever the question.
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  };
}
