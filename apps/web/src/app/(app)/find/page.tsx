import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ROUTES } from '@/lib/routes';

/**
 * **Find** — the group's landing screen (D2, rethink §3.7). A **redirect to
 * `/spots` until T48**, which builds the "For you" summary that belongs here.
 *
 * The route exists now because T45 builds the two bars that point at it, and a
 * cell pointing at nothing is worse than a cell that lands one screen early: a
 * rider who presses Find today gets Spots, which is where the old "What's on"
 * cell took them anyway. Nothing about the redirect is permanent, and the nav
 * does not have to change when the page arrives.
 *
 * `noindex`, because a signpost is not a page worth arriving on from a search
 * result — `/spots` is, and it is in the sitemap.
 */
export const metadata: Metadata = {
  title: 'Find · Land The Trick',
  robots: { index: false, follow: true },
};

export default function FindPage() {
  redirect(ROUTES.spots);
}
