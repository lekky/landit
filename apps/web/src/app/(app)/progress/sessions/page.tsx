import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SessionsScreen } from '@/components/sessions/list/SessionsScreen';
import { buildSessionsView } from '@/components/sessions/list/view';
import { ROUTES } from '@/lib/routes';
import { currentRider } from '@/lib/session';

export const metadata: Metadata = {
  // Not "Sessions · Progress ·" any more: Sessions is its own screen under
  // Home since the rethink, not a tab of Progress (§3.10, T46 and T50).
  title: 'Sessions · Land The Trick',
  description:
    'Every session you have logged: where, how long, what you worked on and how it felt.',
};

/**
 * Progress › Sessions (plan §7, T37; design 1a, 1b, 2a, 2b).
 *
 * The rider's own diary, read with **their** client — the same token the
 * browser would hold, so the rules and the enrich hook decide what comes back
 * (`components/sessions/list/view.ts`). The whole diary is read once and the
 * filters, pages, table and month accordions are drawn from it in the browser,
 * so switching any of them is instant and none of them is a second request.
 */
export default async function SessionsPage() {
  const session = await currentRider();
  if (!session) redirect(ROUTES.signIn);
  if (!session.rider.onboarded) redirect(ROUTES.onboarding);

  const view = await buildSessionsView({ client: session.client, rider: session.rider });
  return <SessionsScreen view={view} />;
}
