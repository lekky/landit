import type { Metadata } from 'next';

import { Gallery } from './gallery';

/**
 * `/design` — the design system gallery.
 *
 * Part of T3's deliverable: everything in `@landit/ui-web` rendered side by
 * side so it can be compared against `design-handoff/screenshots/`. Not a rider
 * screen, not in the navigation, and deliberately kept out of search results.
 */
export const metadata: Metadata = {
  title: 'Design system · Land It',
  description: 'Every Land It primitive, side by side.',
  robots: { index: false, follow: false },
};

export default function DesignPage() {
  return <Gallery />;
}
