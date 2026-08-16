import type { Metadata } from 'next';
import Link from 'next/link';

import siteStyles from '@/components/site/site.module.css';
import { SiteFooter } from '@/components/site/SiteFooter';
import { Wordmark } from '@/components/site/Wordmark';
import { ROUTES, legalHref } from '@/lib/routes';

import styles from './not-found.module.css';

/**
 * The 404.
 *
 * Part of the shell rather than a nicety: through most of the build the app has
 * more navigation than it has screens, and a mistyped or bookmarked URL should
 * land on something that looks like Land It rather than Next's default page.
 *
 * The copy says nothing about what is or is not built yet. Riders will read
 * this after launch too, when the honest answer is simply that the page is not
 * there.
 */
export const metadata: Metadata = {
  title: 'Page not found · Land It',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className={siteStyles.wash}>
      <div className={siteStyles.bar}>
        <Wordmark href={ROUTES.home} />
      </div>

      <div className={styles.body}>
        <span className="eyebrow">404</span>
        <h1 className={`d ${styles.title}`}>
          That page
          <br />
          <span className={styles.isnt}>isn&rsquo;t here.</span>
        </h1>
        <p className={styles.copy}>
          Either the link is wrong or we moved it. Nothing you have tracked is affected.
        </p>
        <div className={styles.actions}>
          <Link className="btn" href={ROUTES.home}>
            Back to Land It
          </Link>
          <Link className="btn ghost" href={legalHref('about')}>
            About Land It
          </Link>
        </div>
      </div>

      <SiteFooter compact />
    </div>
  );
}
