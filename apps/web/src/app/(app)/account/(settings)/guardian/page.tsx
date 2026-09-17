import { isConsentLimited, type ConsentState } from '@landit/core';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ROUTES } from '@/lib/routes';

import { AccountDetail } from '../../AccountDetail';
import { GuardianPanel } from '../../GuardianPanel';
import { requireAccountRider } from '../../load';

export const metadata: Metadata = {
  title: 'Your guardian · Land The Trick',
  description: 'Asking a parent or carer to approve your account.',
  robots: { index: false, follow: false },
};

/**
 * "Your guardian" — the eighth row (Rachid, 2026-09-16, in chat).
 *
 * §3.9 lists seven rows and the guardian panel is not one of them, which would
 * have left the consent gate's only control with no way in from a screen that
 * is now a list. It is the owner's addition, and it is drawn only while the
 * gate applies — `pending` or `revoked` — because the panel is written to a
 * rider waiting on a grown-up or told no, and has nothing to say to anybody
 * else.
 *
 * **The panel is unchanged, including what it does not do.** It explains the
 * refusals; it does not implement them. The gate is enforced server-side (plan
 * §3 guarantee 4), the guardian's link is minted and hashed on the server, and
 * a rider never holds a token — if this screen could see one, a child could
 * approve their own account.
 *
 * A rider the gate does not apply to is sent back to the list, the same answer
 * `/account/sessions` gives a rider outside the sessions preview.
 */
export default async function AccountGuardianPage() {
  const { rider } = await requireAccountRider(ROUTES.accountGuardian);
  const consent = rider.consent_state as ConsentState;
  if (!isConsentLimited(consent)) redirect(ROUTES.account);

  return (
    <AccountDetail title="Your guardian">
      <GuardianPanel state={consent} />
    </AccountDetail>
  );
}
