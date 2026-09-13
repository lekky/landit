import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { loadNewSessionForm } from '@/components/sessions/form/load';
import { SessionFormScreen } from '@/components/sessions/form/SessionFormScreen';
import { ROUTES, signInHref } from '@/lib/routes';
import { newSessionHref, readNewSessionPrefill } from '@/lib/sessionRoutes';
import { currentRider } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Log a session · Land The Trick',
  robots: { index: false },
};

/**
 * Log a session, as a page (T38): the quick log with `?quick=1`, the full form
 * otherwise, holding the spot, event or trick the link named.
 *
 * This is what a phone, a shared link and a refresh get. A soft navigation from
 * the Sessions list is intercepted by `../@modal/(.)new` instead, and renders
 * the same screen as a modal over the list.
 */
export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const prefill = readNewSessionPrefill(await searchParams);
  const session = await currentRider();
  if (!session) redirect(signInHref(newSessionHref(prefill)));
  if (!session.rider.onboarded) redirect(ROUTES.onboarding);

  const data = await loadNewSessionForm(session, prefill);
  return <SessionFormScreen data={data} shell="page" />;
}
