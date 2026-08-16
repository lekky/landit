import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '@landit/ui-web/styles.css';

import { sportsList } from '@/lib/sports';

import { fontVariables } from '../fonts';

import './globals.css';

// The sport list is generated, never written out: it says three the day T21
// lands BMX, without anybody remembering to come back here (`lib/sports.ts`).
export const metadata: Metadata = {
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
