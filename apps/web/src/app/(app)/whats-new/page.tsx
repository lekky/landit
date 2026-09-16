import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ROUTES } from '@/lib/routes';
import { currentRider } from '@/lib/session';

/**
 * **What's new** — the bell's page on a phone (D4, rethink §3.6).
 *
 * A placeholder, and a deliberate one: T45 builds the bell and the slot its
 * count sits in, because the bell is part of the top bar's shape and a bar
 * built without it would have to be rebuilt to take it. **T47 builds what goes
 * here** — the You / crew tabs, the derived lines, `whats_new_seen_at` and the
 * unseen count. Until then the page says so in one line rather than 404ing on a
 * bell that is on every screen.
 *
 * **Gated**, like `/crew`: everything that will be on it is one rider's own
 * record and their crews' feeds, so a signed-out visitor goes to sign in. It is
 * in `GATED_ROUTES` and out of the sitemap for the same reason.
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

  return (
    <>
      <span className="eyebrow">Your news</span>
      <h1 className="d" style={{ fontSize: 'clamp(30px,6vw,44px)', margin: '8px 0 12px' }}>
        What’s new
      </h1>
      <div className="panel flat">
        <p style={{ margin: 0, color: 'var(--ink-2)' }}>
          Nothing here yet. Stickers you earn, riders joining your crews and what’s coming up will
          land here.
        </p>
      </div>
    </>
  );
}
