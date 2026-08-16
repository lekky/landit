import { SITE_URL } from '@landit/core';
import type { Metadata } from 'next';
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
  title: 'Land It',
  description: `A trick tracker for ${sportsList()} riders.`,
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
