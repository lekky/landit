'use client';

import posthog from 'posthog-js';
import { useEffect, useRef } from 'react';

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

/**
 * Report that an action a rider submitted came back with an error.
 *
 * The forms that sign a rider up, sign them in and reset a password all
 * **redirect on success**, so the only thing a browser can observe is the
 * attempt and, when it happens, the failure. Firing the event once at submit
 * would leave a count called `signed_up` quietly including everyone who
 * mistyped their password, which is the kind of number somebody makes a
 * decision on a year later.
 *
 * So each of those call sites captures `outcome: 'attempted'` when the form
 * goes, and this captures `outcome: 'failed'` when one comes back — success is
 * the difference between the two. The ref stops React re-firing it on an
 * unrelated re-render; a *new* failure changes the message and fires again.
 *
 * `message` is the app's own copy, which is written by us and says nothing
 * about the rider. It is not sent — only the fact that it changed is used, and
 * what travels is the caller's own `properties`.
 */
export function useFailureCapture(
  event: AnalyticsEvent,
  message: string | undefined,
  properties?: Record<string, unknown>,
): void {
  const last = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!message || message === last.current) return;
    last.current = message;
    capture(event, { ...properties, outcome: 'failed' });
    // `properties` is a fresh object literal at most call sites, so it is
    // deliberately not a dependency — the message is what says "this is new".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, message]);
}

/**
 * The mirror of `useFailureCapture`, for an action that reports success in its
 * returned state rather than by redirecting.
 *
 * `token` is whatever the action hands back to prove it worked — a reference,
 * an id, a `true`. It is compared, not sent; what travels is the caller's own
 * `properties`. Fires once per distinct token, so a re-render does not
 * double-count and a second submission does.
 */
export function useSuccessCapture(
  event: AnalyticsEvent,
  token: string | number | boolean | null | undefined,
  properties?: Record<string, unknown>,
): void {
  const last = useRef<typeof token>(undefined);
  useEffect(() => {
    if (!token || token === last.current) return;
    last.current = token;
    capture(event, properties);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, token]);
}
