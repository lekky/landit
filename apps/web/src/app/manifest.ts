import type { MetadataRoute } from 'next';

import { ROUTES } from '@/lib/routes';
import { sportsList } from '@/lib/sports';

/**
 * The install manifest (plan §7, T19).
 *
 * What it buys: "Add to Home Screen" gives a rider an icon that opens Land The Trick
 * without browser chrome, which is most of what the handoff's Step 0 meant by a
 * PWA. It is also half of what makes the offline cache worth having — an app
 * opened from a home screen at a park is the case §2.3 is about.
 *
 * Like `layout.tsx`, the description says how many sports there are by asking
 * rather than by writing a number down, so it did not have to be revisited when
 * T21 landed BMX.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // `id` pins the app's identity independently of where it is served from. It
    // is what stops a change of `start_url` reading as a *different* app that
    // installs alongside the one a rider already has.
    id: '/',
    name: 'Land The Trick',
    // What a launcher writes under the icon. The full name is 14 characters and
    // gets truncated (#158); "LTT" matches the monogram on the icon above it
    // (owner's call, 2026-08-30, in chat).
    short_name: 'LTT',
    description: `A trick tracker for ${sportsList()} riders.`,

    // British English, stated rather than guessed at. A launcher and a store
    // listing both read this to decide which locale the app belongs to, and
    // `en` alone would let either pick US spellings for copy that is written
    // in ours.
    lang: 'en-GB',
    dir: 'ltr',

    /**
     * The dashboard, not the landing page.
     *
     * `/` is marketing and stays marketing (`lib/routes.ts`). Somebody who has
     * installed the app has already decided; opening them on the sales pitch
     * every time would be the wrong screen. Signed out, `/home` sends them to
     * sign-in, which is also the right screen.
     */
    start_url: '/home',
    scope: '/',

    display: 'standalone',
    orientation: 'portrait',

    // Ink and yellow, from `packages/ui-web/src/styles/tokens.css`. The
    // background is what a launcher paints behind the splash before the app has
    // rendered, so it matches the app bar rather than the page wash — a paper
    // splash followed by an ink top bar reads as a flash.
    background_color: '#12100b',
    theme_color: '#12100b',

    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],

    /**
     * What kind of app this is, for a store or a launcher that groups by it.
     *
     * `sports` is the honest first one. `fitness` is deliberately absent: this
     * counts tricks a rider has landed, not calories, minutes or a body, and a
     * children's product filed under fitness invites exactly the comparison
     * §6.4 says it should not make.
     */
    categories: ['sports', 'education'],

    /**
     * The long-press menu on an installed icon, and the four groups the app
     * shell itself is built on (D7) — minus Log, which opens a sheet rather
     * than a route and so has no URL a launcher could send anybody to.
     *
     * They are `ROUTES` rather than strings because a route that moves should
     * break the build here too, not quietly send a rider to a 404 from the one
     * surface nobody thinks to re-test.
     */
    shortcuts: [
      { name: 'Your tricks', url: ROUTES.library },
      { name: 'Find', url: ROUTES.find },
      { name: 'Crew', url: ROUTES.crew },
    ],

    /**
     * What Chrome shows in the install dialog instead of a bare icon and a
     * URL — the same four captures the landing page sells the product with.
     *
     * All four are 618 × 1373, which is one aspect ratio: Chrome refuses the
     * richer dialog outright if the narrow screenshots disagree with each
     * other, and silently falls back to the plain one, so the sameness is the
     * requirement rather than a coincidence.
     *
     * `form_factor: 'narrow'` on every one of them. There are no desktop
     * captures to offer, and claiming `wide` with a phone screenshot is how an
     * install dialog ends up showing a 618px-wide image stretched across a
     * desktop card.
     */
    screenshots: [
      {
        src: '/marketing/library.png',
        sizes: '618x1373',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'The trick library, filtered to one sport',
      },
      {
        src: '/marketing/trick-page.png',
        sizes: '618x1373',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'A trick, its coaching notes and the stage you are at',
      },
      {
        src: '/marketing/skill-tree.png',
        sizes: '618x1373',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'The skill tree, showing what unlocks next',
      },
      {
        src: '/marketing/profile.png',
        sizes: '618x1373',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'A rider profile and the stickers on it',
      },
    ],

    /**
     * There is no native app to prefer, and saying so is not redundant.
     *
     * Once Land The Trick is listed on Play, the store's own listing carries a
     * `related_applications` relationship back to this manifest. Leaving this
     * unset would let a browser decide on its own to promote the store listing
     * over the installed web app — the same product, a second install prompt,
     * and a rider bounced to Play from an app they are already using.
     */
    prefer_related_applications: false,
  };
}
