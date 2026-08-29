import { describe, expect, it } from 'vitest';

import {
  ANALYTICS_EVENTS,
  analyticsEnabled,
  analyticsHost,
  analyticsKey,
  analyticsOptions,
  scrubProperties,
} from './analytics';

/**
 * What analytics is allowed to collect, asserted rather than configured (§6.8).
 *
 * `/legal/cookies` makes three promises about this — no cookies, no advertising
 * identifiers, no per-rider profile — to an audience of children, on a live
 * site. Each one is a single option in `analytics.ts`, and an option nobody
 * tests is a default somebody restores. These are the assertions that make
 * changing one a deliberate act with a failing test in front of it.
 *
 * Unlike `sentry.test.ts` there is no end-to-end delivery check here. PostHog's
 * browser SDK reaches for `window` on import, and a fake ingest endpoint would
 * prove the SDK works rather than that our configuration is right — which is
 * the only thing this file is about. Delivery is proven by events appearing in
 * the project.
 */

describe('whether analytics is on', () => {
  it('is off with no key, which is CI and every local checkout', () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    expect(analyticsKey()).toBe('');
    expect(analyticsEnabled()).toBe(false);
  });

  it('is on with one, and reads the variable the env template documents', () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_example';
    expect(analyticsEnabled()).toBe(true);
    expect(analyticsKey()).toBe('phc_example');
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  });

  it('treats a whitespace-only key as unset, because a blank line in a dashboard is not a key', () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = '   ';
    expect(analyticsEnabled()).toBe(false);
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  });
});

describe('where the events go', () => {
  it('defaults to the EU cloud, which is the reason PostHog was chosen (plan §1)', () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
    expect(analyticsHost()).toBe('https://eu.i.posthog.com');
    expect(analyticsOptions().api_host).toBe('https://eu.i.posthog.com');
  });

  it('never silently falls back to the US cloud when the override is blank', () => {
    process.env.NEXT_PUBLIC_POSTHOG_HOST = '';
    expect(analyticsHost()).toBe('https://eu.i.posthog.com');
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
  });
});

describe('the three promises the cookie policy makes', () => {
  it('writes nothing to the rider’s device — no cookie, no localStorage', () => {
    // Two switches, both required. `cookieless_mode` is what makes PostHog
    // count riders by a server-side daily hash instead of by something stored
    // on the device; `memory` is the independent belt to that brace, and rules
    // out localStorage and sessionStorage as well — neither is a cookie, and a
    // banner would have to cover both.
    expect(analyticsOptions().cookieless_mode).toBe('always');
    expect(analyticsOptions().persistence).toBe('memory');
  });

  it('asks for cookieless always, never the banner-shaped variant', () => {
    // 'on_reject' is the mode for a site that shows a cookie banner and only
    // falls back to hashing when someone refuses. We show no banner, so
    // anything other than 'always' would mean cookies for whoever did not
    // refuse — which is the opposite of what /legal/cookies says.
    expect(analyticsOptions().cookieless_mode).not.toBe('on_reject');
  });

  it('cannot create a per-rider profile, even if a call site asks it to', () => {
    // `never` makes a stray `identify()` a no-op rather than a policy breach.
    // `identified_only` would leave the promise resting on nobody ever calling
    // it, which is a habit and not a guarantee.
    expect(analyticsOptions().person_profiles).toBe('never');
  });

  it('does not autocapture, because clicks carry handles, crew names and typed text', () => {
    expect(analyticsOptions().autocapture).toBe(false);
  });
});

describe('what is switched off on purpose', () => {
  it('never records a session', () => {
    // A replay is a recording of a child using an app.
    expect(analyticsOptions().disable_session_recording).toBe(true);
  });

  it('never renders a survey at a rider', () => {
    expect(analyticsOptions().disable_surveys).toBe(true);
  });

  it('loads no third-party script, so switching one on is a change here', () => {
    expect(analyticsOptions().disable_external_dependency_loading).toBe(true);
  });

  it('asks for no feature flags, so no request blocks a page load', () => {
    expect(analyticsOptions().advanced_disable_flags).toBe(true);
  });

  it('denies the IP property the browser would send', () => {
    // Not the whole story, and the module says so: ingestion reads an address
    // off the request itself. In cookieless mode PostHog strips that after
    // hashing with it, which is why "Discard client IP data" must stay off.
    expect(analyticsOptions().property_denylist).toContain('$ip');
  });
});

describe('pageviews from pages that carry a credential', () => {
  const scrub = (url: string) => scrubProperties({ $current_url: url }).$current_url as string;

  it('redacts a guardian-consent token, which is the whole of guarantee 4', () => {
    // Holding this token is sufficient, with no account and no sign-in, to
    // grant or withdraw consent for a child. A `$pageview` from the page a
    // guardian lands on would put it in a third party's event store.
    expect(scrub('https://landthetrick.com/consent/approve/abc123')).toBe(
      'https://landthetrick.com/consent/approve/[redacted]',
    );
    expect(scrub('https://landthetrick.com/consent/revoke/abc123')).toBe(
      'https://landthetrick.com/consent/revoke/[redacted]',
    );
  });

  it('strips the query string, where the rider ids are', () => {
    expect(scrub('https://landthetrick.com/report?about=profile&id=abc123')).toBe(
      'https://landthetrick.com/report',
    );
  });

  it('scrubs every URL-bearing property, not just the current one', () => {
    const scrubbed = scrubProperties({
      $current_url: 'https://landthetrick.com/home?id=abc',
      $pathname: '/consent/approve/abc123',
      $referrer: 'https://landthetrick.com/library?q=flip',
      $initial_current_url: 'https://landthetrick.com/plans?from=abc',
      $session_entry_url: 'https://landthetrick.com/consent/revoke/xyz789',
    });
    expect(scrubbed.$current_url).toBe('https://landthetrick.com/home');
    expect(scrubbed.$pathname).toBe('/consent/approve/[redacted]');
    expect(scrubbed.$referrer).toBe('https://landthetrick.com/library');
    expect(scrubbed.$initial_current_url).toBe('https://landthetrick.com/plans');
    expect(scrubbed.$session_entry_url).toBe('https://landthetrick.com/consent/revoke/[redacted]');
  });

  it('leaves a URL with neither exactly as it was, and non-strings alone', () => {
    const scrubbed = scrubProperties({
      $current_url: 'https://landthetrick.com/home',
      $pathname: undefined,
      sport: 'scoot',
      diff: 3,
    });
    expect(scrubbed.$current_url).toBe('https://landthetrick.com/home');
    expect(scrubbed.$pathname).toBeUndefined();
    expect(scrubbed.sport).toBe('scoot');
    expect(scrubbed.diff).toBe(3);
  });

  it('does not edit the bag the SDK handed it', () => {
    const original = { $current_url: 'https://landthetrick.com/home?id=abc' };
    scrubProperties(original);
    expect(original.$current_url).toBe('https://landthetrick.com/home?id=abc');
  });

  it('follows SPA navigation, or every route after the first is invisible', () => {
    expect(analyticsOptions().capture_pageview).toBe('history_change');
  });
});

describe('the event catalogue', () => {
  it('names each event once, so a typo cannot split a funnel in two', () => {
    const names = Object.values(ANALYTICS_EVENTS);
    expect(new Set(names).size).toBe(names.length);
  });

  it('covers what §6.8 asked to be instrumented', () => {
    // Onboarding funnel, trick logging, paywall hits and upgrades — the four
    // the plan names. A screen adding a fifth adds it to the catalogue, not to
    // a string literal at its call site.
    expect(Object.keys(ANALYTICS_EVENTS)).toEqual([
      'onboardingStep',
      'onboardingFinished',
      'trickLogged',
      'paywallHit',
      'upgradeStarted',
    ]);
  });
});
