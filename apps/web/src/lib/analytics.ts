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
 *  - **`cookieless_mode: 'always'` with `persistence: 'memory'`** — no cookie,
 *    no `localStorage`, no `sessionStorage`. Nothing is written to a rider's
 *    device at all, so there is no identifier to carry between page loads and
 *    none to ask us to delete. Riders are counted instead by a hash PostHog
 *    computes on its own servers from
 *    `(team, daily salt, IP, user agent, hostname)`; the salt is thrown away at
 *    the end of each day, which is what makes the hash irreversible and stops it
 *    being an identifier for a person rather than for a day's visit.
 *
 *    **So "unique riders" means unique *per day*.** The same child on Tuesday
 *    and Wednesday is two, because the salt changed — a monthly figure is a sum
 *    of daily ones and will overcount. That is the honest limit of counting
 *    without storing anything, and it is the right way round for this product:
 *    the alternative buys a truer monthly number with a durable identifier for a
 *    child, which is the thing `/legal/cookies` says we do not keep.
 *
 *    `persistence: 'memory'` stays set beneath it. Cookieless mode already
 *    disables storage, but the two are independent switches and only one of them
 *    is named in the policy.
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
 * **Cookieless mode has to be switched on in the PostHog project as well**
 * ("Cookieless server hash mode", under the project's web-analytics settings).
 * The SDK asking for it is not enough: with the project setting off, PostHog
 * **ignores every cookieless event**, so the failure mode is an empty dashboard
 * rather than an error. That is the one thing to check first if nothing appears.
 *
 * **The IP address is PostHog's to handle, not ours.** The SDK's own `ip` option
 * is deprecated and does nothing, and the `$ip` denylist below only removes the
 * property the *browser* sends — ingestion reads an address off the request
 * regardless. In cookieless mode that address is the hash's main ingredient and
 * is stripped before any transformation runs, which is why GeoIP and bot
 * detection stop enriching events. **Do not also switch on "Discard client IP
 * data"**: cookieless mode already does that job, and the two settings pull on
 * the same input with no documented answer for what happens when both are set.
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
 *
 * **This is the whole of the safety argument now that the catalogue is broad.**
 * Coverage was widened on 2026-08-21 (owner, in chat) from the four areas §6.8
 * named to nearly every action a rider can take. Autocapture was considered for
 * it and refused again in the same breath, because the two are not the same
 * trade: an event written here is one somebody chose the properties for, while
 * autocapture sends the *text of whatever was clicked* — which on this product
 * is crew names, rider handles and spot names a child typed. Breadth is safe;
 * automatic breadth is not. A new screen is therefore untracked until somebody
 * adds an entry below, and that is the direction this should fail in.
 *
 * Three events name a thing that happened on a path carrying something secret,
 * and each carries only that it happened: `consent_decided` (never the token —
 * see `URL_PROPERTIES`), `report_filed` (never a word of the report), and
 * `guardian_asked` (never the address).
 */
export const ANALYTICS_EVENTS = {
  /* ------------------------------------------------------------ account -- */
  /** An account was created. Carries nothing about who. */
  signedUp: 'signed_up',
  signedIn: 'signed_in',
  signedOut: 'signed_out',
  passwordResetRequested: 'password_reset_requested',
  passwordResetCompleted: 'password_reset_completed',
  verificationResent: 'verification_resent',
  profileSaved: 'profile_saved',
  /** A privacy toggle moved. Carries which setting and its new value. */
  privacySet: 'privacy_set',

  /* ------------------------------------------------------- safeguarding -- */
  /** A rider asked a grown-up for consent. Never the email address. */
  guardianAsked: 'guardian_asked',
  /** A guardian approved or revoked. Never the token, never the address. */
  consentDecided: 'consent_decided',
  /** A report was filed. **That** it happened, and what kind — never a word of it. */
  reportFiled: 'report_filed',

  /* --------------------------------------------------------- onboarding -- */
  onboardingStep: 'onboarding_step',
  onboardingFinished: 'onboarding_finished',

  /* ---------------------------------------------------------- the loop -- */
  /** "I rode today" — the weekly streak, and the best signal the product has. */
  rideLogged: 'ride_logged',
  /** A rider moved a trick's stage. Carries the trick's catalogue facts. */
  trickLogged: 'trick_logged',
  /** A note was saved against a trick. Never the note. */
  noteSaved: 'note_saved',
  challengeLogged: 'challenge_logged',
  /** The coach-view toggle on the progress screen. */
  insightsSet: 'insights_set',

  /* ------------------------------------------------------------- crews -- */
  crewCreated: 'crew_created',
  crewJoined: 'crew_joined',
  crewLeft: 'crew_left',
  inviteMinted: 'invite_minted',

  /* ------------------------------------------------------------ content -- */
  videoLinkAdded: 'video_link_added',
  videoLinkRemoved: 'video_link_removed',
  videoVisibilitySet: 'video_visibility_set',
  /** A spot was submitted for review. Never its name or the address typed. */
  spotSubmitted: 'spot_submitted',
  /** Going / not going on an event. */
  eventAttendanceSet: 'event_attendance_set',

  /* -------------------------------------------------------------- money -- */
  /** A locked trick was opened — the paywall, seen. Carries tier and sport. */
  paywallHit: 'paywall_hit',
  /** Checkout was started from a plan card. Carries plan slug and period. */
  upgradeStarted: 'upgrade_started',
  billingPortalOpened: 'billing_portal_opened',

  /* --------------------------------------------------------- getting about -- */
  /** The sport switcher in the top bar. */
  sportSwitched: 'sport_switched',
  /** A nav destination was chosen. Carries the route, which is not a rider fact. */
  navClicked: 'nav_clicked',
  /** The library's sport / category / tier filters. */
  libraryFiltered: 'library_filtered',
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
  | 'cookieless_mode'
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

    // Nothing written to the rider's device, and no profile behind it. Riders
    // are counted by PostHog's server-side daily hash instead — see the header
    // for what that does and does not buy.
    cookieless_mode: 'always',
    persistence: 'memory',
    person_profiles: 'never',

    // `$ip`: removes the property the browser sends. The address ingestion
    // reads off the request is PostHog's to strip, not ours — see the header.
    //
    // `title`: the document title, which the SDK attaches to every pageview.
    // Today every title in the app is safe — the rider profile is a flat
    // "Rider · Land The Trick" and a trick page uses the catalogue name. It is
    // dropped anyway, because the *next* person to want a nicer share preview
    // will put a rider's handle in that title and nothing here would notice.
    // The path already says which page it was, so this costs a duplicate.
    property_denylist: ['$ip', 'title'],

    sanitize_properties: scrubProperties,

    // No feature flags are used, so this saves every page load a request to
    // `/flags` and one more thing that could block a render.
    advanced_disable_flags: true,
  };
}
