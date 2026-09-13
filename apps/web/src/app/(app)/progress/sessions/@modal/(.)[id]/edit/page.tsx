import { notFound, redirect } from 'next/navigation';

import { loadEditSessionForm } from '@/components/sessions/form/load';
import { SessionFormScreen } from '@/components/sessions/form/SessionFormScreen';
import { ROUTES, signInHref } from '@/lib/routes';
import { editSessionHref, isRecordId } from '@/lib/sessionRoutes';
import { currentRider } from '@/lib/session';

/**
 * `/progress/sessions/<id>/edit`, intercepted over the Sessions list (T38) —
 * the edit screen as a modal, rendered into T37's `@modal` slot.
 */
export default async function EditSessionModal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isRecordId(id)) notFound();
  const session = await currentRider();
  if (!session) redirect(signInHref(editSessionHref(id)));
  if (!session.rider.onboarded) redirect(ROUTES.onboarding);

  const data = await loadEditSessionForm(session, id);
  if (!data) notFound();
  return <SessionFormScreen data={data} shell="modal" />;
}
