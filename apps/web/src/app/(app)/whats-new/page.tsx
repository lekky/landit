import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { loadWhatsNewView } from '@/components/whats-new/load';
import { WhatsNewPanel } from '@/components/whats-new/WhatsNewPanel';
import styles from '@/components/whats-new/whats-new.module.css';
import { ROUTES } from '@/lib/routes';
import { currentRider } from '@/lib/session';

/**
 * **What's new** — the bell's page on a phone (D4, rethink §3.6).
 *
 * The same `WhatsNewPanel` the desktop bell hangs in a dropdown, rendered as
 * the whole screen: a 420px panel off the right edge of a 375px display is not
 * a panel, and this is the address the dropdown's "All →" points at, so a rider
 * at either width ends up looking at one component.
 *
 * **Gated**, like `/crew`: everything on it is one rider's own record and their
 * crews' feeds, so a signed-out visitor goes to sign in. It is in
 * `GATED_ROUTES` and out of the sitemap for the same reason.
 *
 * It lights no nav cell (§2.2) — the bell is on every screen, so a rider
 * reading their own news is not "in" a group.
 */
export const metadata: Metadata = {
  title: 'What’s new · Land The Trick',
  robots: { index: false, follow: false },
};

export default async function WhatsNewPage() {
  const session = await currentRider();
  if (!session) redirect(ROUTES.signIn);

  const view = await loadWhatsNewView();

  return (
    <div className={styles.pageWrap}>
      <span className="eyebrow">Your news</span>
      <WhatsNewPanel view={view} place="page" />
    </div>
  );
}
