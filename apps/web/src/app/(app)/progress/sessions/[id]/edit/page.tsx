import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { loadEditSessionForm } from '@/components/sessions/form/load';
import { SessionFormScreen } from '@/components/sessions/form/SessionFormScreen';
import { ROUTES, signInHref } from '@/lib/routes';
import { editSessionHref, isRecordId } from '@/lib/sessionRoutes';
import { currentRider } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Edit session · Land The Trick',
  robots: { index: false },
};

/**
 * Edit a session, as a page (T38, 2g in edit mode). A session that is not the
 * signed-in rider's is a 404, the same answer as one that does not exist.
 */
export default async function EditSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isRecordId(id)) notFound();
  const session = await currentRider();
  if (!session) redirect(signInHref(editSessionHref(id)));
  if (!session.rider.onboarded) redirect(ROUTES.onboarding);

  const data = await loadEditSessionForm(session, id);
  if (!data) notFound();
  return <SessionFormScreen data={data} shell="page" />;
}
