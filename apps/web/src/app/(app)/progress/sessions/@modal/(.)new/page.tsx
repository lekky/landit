import { redirect } from 'next/navigation';

import { loadNewSessionForm } from '@/components/sessions/form/load';
import { SessionFormScreen } from '@/components/sessions/form/SessionFormScreen';
import { ROUTES, signInHref } from '@/lib/routes';
import { newSessionHref, readNewSessionPrefill } from '@/lib/sessionRoutes';
import { currentRider } from '@/lib/session';

/**
 * `/progress/sessions/new`, intercepted over the Sessions list (T38): the same
 * screen as `../../new/page.tsx`, as a modal, so the rider keeps their place in
 * the list (handoff, "Decisions"). Rendered into the `@modal` slot that
 * `progress/sessions/layout.tsx` (T37) draws beside the list; closing it goes
 * back, which empties the slot.
 */
export default async function NewSessionModal({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const prefill = readNewSessionPrefill(await searchParams);
  const session = await currentRider();
  if (!session) redirect(signInHref(newSessionHref(prefill)));
  if (!session.rider.onboarded) redirect(ROUTES.onboarding);

  const data = await loadNewSessionForm(session, prefill);
  return <SessionFormScreen data={data} shell="modal" />;
}
