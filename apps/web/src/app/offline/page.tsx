import type { Metadata } from 'next';
import Link from 'next/link';

import styles from '@/components/offline/offline.module.css';
import siteStyles from '@/components/site/site.module.css';
import { SiteFooter } from '@/components/site/SiteFooter';
import { Wordmark } from '@/components/site/Wordmark';
import { ROUTES } from '@/lib/routes';

/**
 * What a rider gets when there is no signal and no cached copy of what they
 * asked for (plan §2.3, T19).
 *
 * The service worker fetches this page while there *is* signal and keeps it, so
 * it has to be renderable by nobody in particular: no session, no database, no
 * rider. One cached copy is shared by every rider on the device, which is only
 * safe because there is nothing of anyone's on it.
 *
 * The two links are the point of the page rather than decoration — `/library`
 * is the screen most likely to be in the cache already, so the offer is a real
 * one, not a "try again later".
 *
 * It is outside the `(app)` route group deliberately. `AppShell` reads the
 * signed-in rider for the top bar's streak and avatar, and a page that has to
 * render with no server cannot ask the server who is looking at it.
 */
export const metadata: Metadata = {
  title: 'No signal · Land It',
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className={siteStyles.wash}>
      <div className={siteStyles.bar}>
        <Wordmark href={ROUTES.home} />
      </div>

      <div className={styles.body}>
        <span className="eyebrow">Offline</span>
        <h1 className={`d ${styles.title}`}>
          No signal
          <br />
          <span className={styles.signal}>out here.</span>
        </h1>
        <p className={styles.copy}>
          This page needs a connection and there isn&rsquo;t one. Anything you looked at while you
          had signal is still readable — including your trick library. Nothing you have tracked is
          lost, and logging picks up when you are back.
        </p>
        <div className={styles.actions}>
          <Link className="btn" href={ROUTES.library}>
            Your trick library
          </Link>
          <Link className="btn ghost" href={ROUTES.home}>
            Back to Land It
          </Link>
        </div>
      </div>

      <SiteFooter compact />
    </div>
  );
}
