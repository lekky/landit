import type { Metadata } from 'next';

import { ROUTES } from '@/lib/routes';

import { AccountDetail } from '../../AccountDetail';
import { DataPanel } from '../../DataPanel';
import { requireAccountRider } from '../../load';

export const metadata: Metadata = {
  title: 'Your data · Land The Trick',
  description: 'Download everything Land The Trick holds about you, or close your account.',
  robots: { index: false, follow: false },
};

/**
 * "Your data" — T18's export, and the way to the door.
 *
 * Both halves of what the privacy policy promises are reachable from this one
 * screen, and the split between them is the one the owner made on 2026-09-12:
 * the download is here, and closing an account is a page of its own that this
 * screen links to. UK GDPR wants erasure reachable, and a rider looking for the
 * way out finds it under the heading they would look under — which is now a row
 * called "Your data" rather than a panel at the bottom of a long scroll.
 */
export default async function AccountDataPage() {
  await requireAccountRider(ROUTES.accountData);

  return (
    <AccountDetail title="Your data">
      <DataPanel headed={false} />
    </AccountDetail>
  );
}
