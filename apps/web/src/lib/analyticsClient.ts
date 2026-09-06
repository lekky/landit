'use client';

import posthog from 'posthog-js';
import { useEffect, useRef } from 'react';

import {
  ANALYTICS_EVENTS,
  analyticsEnabled,
  analyticsKey,
  analyticsOptions,
  gaConsentDefaults,
  gaEnabled,
  gaMeasurementId,
  gaOptions,
  gaPageContext,
} from './analytics';

import type { AnalyticsEvent } from './analytics';

/**
 * The browser half of analytics — the only place in the app that touches an
 * analytics SDK (§6.8).
 *
 * The split matches error reporting's: `analytics.ts` decides **what may be
 * collected** and is a pure module a node test can assert on; this file is the
 * SDK call that acts on those decisions. Keeping them apart is what lets
 * `analytics.test.ts` prove the privacy choices without a browser.
 *
 * **Two services since 2026-09-06** — PostHog and Google Analytics 4 — and this
 * file is where "two" stops being visible to anybody else. `capture()` sends
 * every event to whichever is configured, each is switched on by its own
 * environment variable, and no call site knows or cares which are running. The
 * reasoning for the second one, and for its cookieless configuration, is in
 * `analytics.ts` beside the options themselves.
 *
 * **Do not import this from a test.** `posthog-js` reaches for `window` on
 * import, and the unit tests run in a node environment. There is nothing here
 * worth asserting on anyway: every decision lives next door.
 *
 * Call sites import `capture` from here rather than an SDK for three reasons.
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

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

/**
 * gtag's command queue.
 *
 * Written the way Google's own snippet writes it, pushing the `arguments`
 * object rather than an array: gtag.js reads the queue as a list of argument
 * lists, and an array is not the same shape to it. This is the one place in the
 * codebase where `arguments` earns its keep.
 */
const gtag = function (): void {
  // eslint-disable-next-line prefer-rest-params
  (window.dataLayer ??= []).push(arguments);
} as (...args: unknown[]) => void;

/**
 * The last path GA was told about, scrubbed.
 *
 * Two jobs. It is the referrer for the next in-app pageview, which
 * `document.referrer` cannot be because it does not change on a client-side
 * navigation. And it is how a `replaceState` that did not actually move — Next
 * fires several per route — is told apart from one that did.
 */
let lastLocation = '';

/**
 * Tell GA where we are and count a pageview, scrubbed of anything secret.
 *
 * `gtag('set', …)` rather than parameters on the event, because gtag attaches
 * `page_location` to **every** event it sends and would otherwise read it
 * straight from `location.href`. Setting it globally is what stops a later
 * `report_filed` from carrying a guardian-consent token (plan §3, guarantee 4).
 */
function sendPageView(): void {
  const context = gaPageContext(window.location.href, lastLocation || document.referrer);
  if (context.page_location === lastLocation) return;
  lastLocation = context.page_location;
  gtag('set', context);
  gtag('event', 'page_view');
}

/**
 * Call `onNavigate` whenever the app changes route without a page load.
 *
 * GA has no equivalent of PostHog's `capture_pageview: 'history_change'`, so
 * the same job is done here. `posthog-js` patches these two methods for its own
 * pageviews; patches chain, so both services see every navigation.
 */
function watchNavigation(onNavigate: () => void): void {
  for (const name of ['pushState', 'replaceState'] as const) {
    const original = window.history[name].bind(window.history);
    window.history[name] = (data: unknown, unused: string, url?: string | URL | null): void => {
      original(data, unused, url);
      onNavigate();
    };
  }
  window.addEventListener('popstate', onNavigate);
}

/** Load gtag.js and configure it. Nothing is sent until it arrives. */
function startGoogleAnalytics(): void {
  const id = gaMeasurementId();

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);

  // Consent Mode first, and before gtag.js has had a chance to run: this is
  // what actually keeps GA4 from writing a cookie, and a default set after the
  // library initialises is a default set too late.
  gtag('consent', 'default', gaConsentDefaults());

  gtag('js', new Date());
  gtag('config', id, gaOptions());

  sendPageView();
  watchNavigation(sendPageView);
}

/**
 * Start analytics, once. Called from `instrumentation-client.ts`, which Next
 * runs before the rest of the client bundle — early enough that the first
 * pageview is the page the rider actually landed on.
 *
 * Each service is independent: either, both or neither can be configured, and a
 * checkout with no keys at all starts nothing.
 */
export function startAnalytics(): void {
  if (started) return;
  started = true;
  if (analyticsEnabled()) posthog.init(analyticsKey(), analyticsOptions());
  if (gaEnabled()) startGoogleAnalytics();
}

/**
 * Send one event to every service that is switched on.
 *
 * Separate `try` blocks so one service failing cannot swallow the other's
 * event. Both are deliberately silent: a counter is not worth a broken screen,
 * and there is nowhere useful to report to, because the thing that failed is
 * the reporting.
 */
export function capture(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
  if (analyticsEnabled()) {
    try {
      posthog.capture(event, properties);
    } catch {
      /* see above */
    }
  }
  if (gaEnabled()) {
    try {
      // The scrubbed location is repeated on every event rather than left to
      // the `gtag('set', …)` in `sendPageView`. `set` is documented to apply to
      // subsequent events and does, but guarantee 4 is not a thing to rest on
      // a third party's documented behaviour: without this line, a change in
      // how gtag treats defaults would silently start attaching a live
      // guardian-consent token to `report_filed`. Belt and braces, two lines.
      gtag('event', event, { ...gaPageContext(window.location.href, ''), ...properties });
    } catch {
      /* see above */
    }
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
