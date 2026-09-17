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

export default async function WhatsNewPage({
  searchParams,
}: {
  /**
   * `?tab=<crew id>` — which tab to open on.
   *
   * Written by the desktop dropdown's "All →", so a rider reading a crew there
   * lands on that crew rather than back on You (review N4). A crew id in a URL
   * is what `/crew?crew=` already does; it is not an analytics property, and
   * the panel ignores one naming a crew this rider is not in.
   */
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await currentRider();
  if (!session) redirect(ROUTES.signIn);

  const [view, { tab }] = await Promise.all([loadWhatsNewView(), searchParams]);

  return (
    <div className={styles.pageWrap}>
      <span className="eyebrow">Your news</span>
      <WhatsNewPanel view={view} place="page" initialTab={tab} />
    </div>
  );
}
