'use client';

import posthog from 'posthog-js';

import { ANALYTICS_EVENTS, analyticsEnabled, analyticsKey, analyticsOptions } from './analytics';

import type { AnalyticsEvent } from './analytics';

/**
 * The browser half of analytics — the only place in the app that touches the
 * PostHog SDK (§6.8).
 *
 * The split matches error reporting's: `analytics.ts` decides **what may be
 * collected** and is a pure module a node test can assert on; this file is the
 * SDK call that acts on those decisions. Keeping them apart is what lets
 * `analytics.test.ts` prove the privacy choices without a browser.
 *
 * **Do not import this from a test.** `posthog-js` reaches for `window` on
 * import, and the unit tests run in a node environment. There is nothing here
 * worth asserting on anyway: every decision lives next door.
 *
 * Call sites import `capture` from here rather than the SDK for three reasons.
 * It is a **no-op when analytics is off**, which is CI, every local checkout and
 * any unconfigured deployment — so a screen never has to ask whether it is on.
 * It takes an `AnalyticsEvent`, so a name that is not in the catalogue does not
 * compile. And it never throws: an analytics failure must not be able to break
 * a rider's page, which a bare SDK call inside an event handler can.
 *
 * What may travel in `properties` is the rule `analytics.ts` states: catalogue
 * facts, never rider facts.
 */

/** Whether `init` has run, so a second call cannot start a second client. */
let started = false;

/**
 * Start analytics, once. Called from `instrumentation-client.ts`, which Next
 * runs before the rest of the client bundle — early enough that the first
 * `$pageview` is the page the rider actually landed on.
 */
export function startAnalytics(): void {
  if (started || !analyticsEnabled()) return;
  started = true;
  posthog.init(analyticsKey(), analyticsOptions());
}

export function capture(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
  if (!analyticsEnabled()) return;
  try {
    posthog.capture(event, properties);
  } catch {
    // Deliberately silent. A counter is not worth a broken screen, and there is
    // nowhere useful to report to: the thing that failed is the reporting.
  }
}

export { ANALYTICS_EVENTS };
