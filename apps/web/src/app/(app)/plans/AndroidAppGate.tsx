'use client';

import { useSyncExternalStore, type ReactNode } from 'react';

/**
 * Withhold the checkout from riders inside the Play Store app (owner's
 * decision, 2026-09-18, in chat).
 *
 * The Play listing is a Trusted Web Activity — these same pages, in the rider's
 * own Chrome — so without this a rider could buy a subscription inside a
 * Play-distributed app through Stripe, which Google's payments policy forbids.
 * The alternative was Play Billing, which is a 15% cut and several sessions of
 * receipt handling; hiding the purchase is what ships first.
 *
 * **This is only ever rendered on Android.** `plans/page.tsx` decides that on
 * the server (`isAndroidRequest`), and on every other device the form is
 * rendered exactly as it was, untouched by any of this. See `lib/androidApp.ts`
 * for why the question has to be answered in two halves.
 *
 * ## It fails towards withholding, deliberately
 *
 * The fallback is what renders on the server and on the first paint, and the
 * children replace it only once the browser has confirmed it is *not*
 * standalone. That is the wrong way round for perceived speed and the right way
 * round for everything else: if the check never runs — JavaScript blocked, a
 * hydration error, a browser that answers nothing — an Android rider sees a
 * page that cannot sell them anything, rather than a page that breaks a store's
 * payment rules. The cost is a form that appears a beat late on an Android
 * browser. The cost the other way round is the listing.
 *
 * ## Why `display-mode` and not something sharper
 *
 * It is what a page can observe. It is also true of a home-screen icon
 * installed straight from Chrome, so some Android riders who never went near
 * Play will be held back from a checkout they were entitled to use. That is
 * accepted: over-withholding costs a conversion and a rider who can still pay
 * on the website, and under-withholding costs the Play listing. The two are not
 * the same size.
 */
const STANDALONE = '(display-mode: standalone)';

/**
 * Subscribe to the display mode changing under us.
 *
 * It genuinely can: Chrome hands a tab to the installed app, and an app can
 * hand a page back to a tab. Rare, but a subscription costs a line and the
 * alternative is a card that sells nothing in a window that is now a browser.
 */
function subscribe(onChange: () => void): () => void {
  try {
    const query = window.matchMedia(STANDALONE);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  } catch {
    return () => {};
  }
}

/** Whether this window is an installed app rather than a tab. */
function standaloneNow(): boolean {
  try {
    return window.matchMedia(STANDALONE).matches;
  } catch {
    // A browser that cannot answer is treated as the app, per the rule above.
    return true;
  }
}

/**
 * What the server renders, and what hydration starts from: assume the app.
 *
 * This is the "fails towards withholding" rule as one line of code. There is
 * no way to know from a request, so the answer that cannot break a store's
 * rules is the one that ships in the HTML.
 */
function standaloneOnServer(): boolean {
  return true;
}

export function AndroidAppGate({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: ReactNode;
}) {
  // `useSyncExternalStore` rather than an effect: this is a subscription to
  // something outside React, it needs a server snapshot that differs from the
  // client one, and setting state from an effect to read a media query is the
  // cascading-render pattern the lint rule refuses.
  const standalone = useSyncExternalStore(subscribe, standaloneNow, standaloneOnServer);

  return <>{standalone ? fallback : children}</>;
}
