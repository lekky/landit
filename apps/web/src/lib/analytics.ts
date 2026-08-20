/**
 * What Land The Trick tells PostHog, and what it deliberately does not (§6.8).
 *
 * The options live here rather than inline in the provider for the same reason
 * Sentry's do (`sentry.ts`): they are a **privacy decision** about a service
 * used by children, and a privacy decision inlined into a React component is one
 * nobody tests. Every choice below is asserted in `analytics.test.ts`.
 *
 * **It is off unless a key is set**, which is the honest default for CI, for
 * every local checkout, and for any deployment nobody has configured. A build
 * that quietly started reporting a child's navigation somewhere would be worse
 * than one that reports nothing.
 *
 * ## What the cookie policy already promises
 *
 * `/legal/cookies` is public and says, of this: it is "set up without cookies
 * and without advertising identifiers, and the counts are not attached to you.
 * There is no per-rider analytics profile here — not one to look at, not one to
 * switch off, and not one to ask us for." That is not marketing copy to live up
 * to later; it is a published statement that this file has to keep true. Three
 * options carry it, and none of them is a default:
 *
 *  - **`persistence: 'memory'`** — no cookie, no `localStorage`, no
 *    `sessionStorage`. Nothing is written to a rider's device at all, so there
 *    is no identifier to carry between page loads and none to ask us to delete.
 *    The cost is real and accepted: "unique visitors" counts page loads rather
 *    than people, and a funnel cannot span a full page reload. Counts of what
 *    gets used are what §6.8 asked for; a durable per-rider identity is the
 *    thing the policy says we do not have.
 *  - **`person_profiles: 'never'`** — the SDK will not create a person profile
 *    even if some future call site reaches for `identify()`. The promise is then
 *    enforced by configuration rather than by everyone remembering, which is the
 *    difference between a guarantee and a habit.
 *  - **`autocapture: false`** — autocapture records the text of what was
 *    clicked. On this product that is rider handles, crew names, trick names a
 *    child typed and the free-text goal from onboarding step 3. Every event here
 *    is therefore hand-written below, and a screen that wants a new one adds it
 *    to `ANALYTICS_EVENTS` where it can be read and argued with.
 *
 * Session replay, surveys and feature flags are off as well: a replay is a
 * recording of a child using an app, a survey is third-party UI rendered in
 * front of one, and we use no flags. `disable_external_dependency_loading` stops
 * the SDK fetching the scripts those three would need, so switching one on is a
 * deliberate change here rather than a remote toggle in somebody's dashboard.
 *
 * ## Two things this file cannot do
 *
 * **IP addresses are attached by PostHog's ingestion, from the request** — the
 * SDK's own `ip` option is deprecated and documented as having no effect. The
 * `$ip` denylist below removes the property the browser sends, which is not the
 * same thing. Discarding the address for real is a project setting
 * ("Discard client IP data"), and it is the owner's to switch on. Until it is,
 * an IP reaches an EU processor and is dropped there rather than never sent.
 *
 * **A processor contract still has to exist.** Plan §6.5 lists PostHog among the
 * services needing an Article 28 contract and a ROPA entry. Wiring the SDK does
 * not create one.
 */

import type { PostHogConfig, Properties } from 'posthog-js';

import { stripQuery } from './sentry';

/** The project key, or empty when analytics is switched off. */
export function analyticsKey(): string {
  return (process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '').trim();
}

export function analyticsEnabled(): boolean {
  return analyticsKey().length > 0;
}

/**
 * Which PostHog to talk to. **EU by default and on purpose** (plan §1): rider
 * data stays in the EU, which is the same reason R2 and MailerSend were picked.
 * Overridable only so a checkout can point at a throwaway project.
 */
export function analyticsHost(): string {
  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? '').trim();
  return host.length > 0 ? host : 'https://eu.i.posthog.com';
}

/**
 * The event names, in one place, because a name typed at a call site is a name
 * that gets typed differently at the next one and quietly splits a funnel in
 * two.
 *
 * The rule for what may travel with an event: **catalogue facts, never rider
 * facts.** A trick id, a sport, a difficulty and a plan slug all describe the
 * product and are the same for everybody who touches them. A rider id, a handle,
 * a display name, a guardian's email address and anything a child typed are
 * none of our analytics' business — most sharply the custom goal from onboarding
 * step 3, which is free text written by a child and never leaves the device.
 */
export const ANALYTICS_EVENTS = {
  /** A step of onboarding was reached. Carries the step index and its title. */
  onboardingStep: 'onboarding_step',
  /** Onboarding was submitted. Carries how many sports and tricks were picked. */
  onboardingFinished: 'onboarding_finished',
  /** A rider logged progress on a trick. Carries the trick's catalogue facts. */
  trickLogged: 'trick_logged',
  /** A locked trick was opened — the paywall, seen. Carries tier and sport. */
  paywallHit: 'paywall_hit',
  /** Checkout was started from a plan card. Carries plan slug and period. */
  upgradeStarted: 'upgrade_started',
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/**
 * Properties whose value is a URL or a path, and which therefore may carry a
 * capability in a path segment.
 *
 * This is the same problem `sentry.ts` solves for error reports, and it uses the
 * same solution rather than a second one: `/consent/approve/<token>` is a live
 * guardian-consent credential (plan §3, guarantee 4), and a `$pageview` from
 * that page would put it in a third party's event store as surely as a stack
 * trace would. `stripQuery` removes the query string and redacts the consent
 * paths; the list below is where it gets applied.
 *
 * Named explicitly rather than guessed at by shape. A rule like "any string that
 * starts with a slash" would be confident and wrong in both directions — the
 * comment in `sentry.ts` on `SECRET_PATHS` argues this at length.
 */
const URL_PROPERTIES: readonly string[] = [
  '$current_url',
  '$pathname',
  '$referrer',
  '$initial_current_url',
  '$initial_pathname',
  '$initial_referrer',
  '$session_entry_url',
  '$session_entry_pathname',
  '$session_entry_referrer',
];

/**
 * Every URL-bearing property, scrubbed, on its way into an event.
 *
 * Returns a new object rather than editing in place: `sanitize_properties` is
 * handed the SDK's own property bag, and a mutation there is a change to state
 * we do not own.
 */
export function scrubProperties(properties: Properties): Properties {
  const out: Properties = { ...properties };
  for (const key of URL_PROPERTIES) {
    if (typeof out[key] === 'string') out[key] = stripQuery(out[key]);
  }
  return out;
}

/** The subset of PostHog's config this app sets. */
export type AnalyticsOptions = Pick<
  PostHogConfig,
  | 'api_host'
  | 'autocapture'
  | 'capture_pageview'
  | 'capture_pageleave'
  | 'disable_session_recording'
  | 'disable_surveys'
  | 'disable_external_dependency_loading'
  | 'persistence'
  | 'person_profiles'
  | 'property_denylist'
  | 'sanitize_properties'
  | 'advanced_disable_flags'
>;

export function analyticsOptions(): AnalyticsOptions {
  return {
    api_host: analyticsHost(),

    // Hand-written events only — see the note on autocapture above.
    autocapture: false,

    // The app is a single page once it has loaded, so a pageview has to follow
    // `history.pushState` or every route after the first is invisible.
    capture_pageview: 'history_change',
    // The matching "they left" event buys nothing we asked for and doubles the
    // volume of a free tier.
    capture_pageleave: false,

    disable_session_recording: true,
    disable_surveys: true,
    disable_external_dependency_loading: true,

    // Nothing written to the rider's device, and no profile behind it.
    persistence: 'memory',
    person_profiles: 'never',

    // Removes the property the browser sends. The address ingestion reads off
    // the request is a project setting, not this — see the header.
    property_denylist: ['$ip'],

    sanitize_properties: scrubProperties,

    // No feature flags are used, so this saves every page load a request to
    // `/flags` and one more thing that could block a render.
    advanced_disable_flags: true,
  };
}
