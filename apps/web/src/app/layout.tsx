import { SITE_URL } from '@landit/core';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import '@landit/ui-web/styles.css';

import { sportsList } from '@/lib/sports';

import { fontVariables } from '../fonts';

import './globals.css';

// The sport list is generated, never written out: it says three the day T21
// lands BMX, without anybody remembering to come back here (`lib/sports.ts`).
export const metadata: Metadata = {
  // Where the app believes it lives. Every relative URL in a page's metadata —
  // canonical links, Open Graph and share-card images — is resolved against
  // this, and without it Next cannot make them absolute and says so at build.
  // Taken from `@landit/core` rather than written here, so the domain is one
  // fact in one place (`data/contact.ts`).
  metadataBase: new URL(SITE_URL),
  title: 'Land The Trick',
  description: `A trick tracker for ${sportsList()} riders.`,

  /**
   * The installed-app metadata (T19). `manifest` is the link tag that makes the
   * app installable at all; `appleWebApp` is the same promise for iOS, which
   * reads its own meta tags and not the manifest — without it, an icon added to
   * a home screen on an iPhone opens Safari with its address bar rather than the
   * app. The icons themselves are `app/icon.tsx`, `app/apple-icon.tsx` and
   * `app/icons/[icon]`, and Next writes their link tags on its own.
   */
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    // iOS's home-screen label, the counterpart of the manifest's short_name:
    // "LTT" matches the monogram icon and survives the label width (#158).
    title: 'LTT',
    // Ink under the status bar, matching `theme_color` and the top bar.
    statusBarStyle: 'black-translucent',
  },
};

/**
 * The colour a browser paints its own chrome with — the address bar on Android,
 * the status bar in a standalone window. Ink, the same value `manifest.ts` gives
 * as `theme_color`, because the two describe the same surface and a rider would
 * see the seam if they disagreed.
 */
export const viewport: Viewport = {
  themeColor: '#12100b',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // `fontVariables` defines --font-anton / --font-barlow-condensed /
    // --font-archivo, which the design system's --fd / --fc / --fb read.
    <html lang="en-GB" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
