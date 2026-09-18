import { sessionVisibilityDefault } from '@landit/core';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ROUTES } from '@/lib/routes';
import { sessionsEnabledFor } from '@/lib/sessionsPreview';

import { AccountDetail } from '../../AccountDetail';
import { SessionVisibilityPanel } from '../../SessionVisibilityPanel';
import { requireAccountRider } from '../../load';

export const metadata: Metadata = {
  title: 'Who sees new sessions · Land The Trick',
  description: 'What every new session starts as, before you change it on the day.',
  robots: { index: false, follow: false },
};

/**
 * "Who sees new sessions" — T40's control, on a screen of its own.
 *
 * **Behind the same gate as the row that opens it.** Sessions are in owner-only
 * preview (T41), the row is drawn only for a rider `sessionsEnabledFor` covers,
 * and this screen asks the same question rather than trusting that nobody typed
 * the address. A rider outside the preview is sent back to the list — not a
 * 404, because the screen exists and the setting will be theirs the day the
 * preview opens, and not an error, because they have done nothing wrong.
 */
export default async function AccountSessionsPage() {
  const { rider } = await requireAccountRider(ROUTES.accountSessions);
  if (!sessionsEnabledFor(rider)) redirect(ROUTES.account);

  return (
    <AccountDetail title="Who sees new sessions">
      <SessionVisibilityPanel
        value={sessionVisibilityDefault(rider.session_visibility_default)}
        headed={false}
      />
    </AccountDetail>
  );
}
