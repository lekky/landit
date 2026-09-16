import type { Metadata } from 'next';

import { ROUTES } from '@/lib/routes';

import { FindScreen } from './FindScreen';
import { loadFind } from './load';

/**
 * **Find** — the group's landing screen (D2, rethink §3.7).
 *
 * T45 left a redirect to `/spots` here so the two bars had somewhere to point;
 * this is the summary that belongs at the address. Three sections — what the
 * rider is going to, what is near them, what is coming up — with the group's
 * tab row above them, and the full list one press behind each.
 *
 * **Public, like `/spots` and `/events`.** Everything on it for a visitor is
 * public data: the calendar's own rule is `is_live = true` with no auth arm,
 * and a spot is a public place. The two sections that are about the reader
 * simply are not rendered for somebody with no account, rather than being a
 * locked door advertised on a public page. `/events/mine` stays gated and
 * `noindex`, and "Mine →" is a link into it for a rider who is signed in.
 *
 * It is in `PUBLIC_ROUTES` and therefore in the sitemap now that it is a screen
 * rather than a signpost — while it was a redirect it was deliberately in
 * neither list, because advertising a redirect teaches a crawler that this
 * site's sitemap cannot be trusted.
 */
export const metadata: Metadata = {
  title: 'Find · Land The Trick',
  description: 'Where to ride, what is on, and the events you said you are going to.',
  alternates: { canonical: ROUTES.find },
};

/*
 * `force-dynamic` for the same reason `/events` carries it: every section is
 * about the reader — their attendance, their faves, their country — and a
 * statically rendered hub would be one rider's page served to everybody.
 */
export const dynamic = 'force-dynamic';

export default async function FindPage() {
  const data = await loadFind();
  return <FindScreen data={data} />;
}
