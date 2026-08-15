import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '@landit/ui-web/styles.css';

import { fontVariables } from '../fonts';

import './globals.css';

export const metadata: Metadata = {
  title: 'Land It',
  description: 'A trick tracker for scooter and skateboard riders.',
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
