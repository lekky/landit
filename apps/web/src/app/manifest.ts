import type { MetadataRoute } from 'next';

import { sportsList } from '@/lib/sports';

/**
 * The install manifest (plan §7, T19).
 *
 * What it buys: "Add to Home Screen" gives a rider an icon that opens Land It
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
    name: 'Land It',
    short_name: 'Land It',
    description: `A trick tracker for ${sportsList()} riders.`,

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
  };
}
