import { SITE_URL } from '@landit/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import siteStyles from '@/components/site/site.module.css';
import { SiteFooter } from '@/components/site/SiteFooter';
import { Wordmark } from '@/components/site/Wordmark';
import { legalHref } from '@/lib/routes';
import { isLiveFromEnv } from '@/lib/siteLive';
import { sportsList } from '@/lib/sports';

import styles from './coming-soon.module.css';

/**
 * The holding page: what `landthetrick.com` serves until the flag says the site
 * is live. Every gated URL rewrites here, so this is the whole public face of
 * the product for now.
 *
 * **No email capture, and that is a decision** (Rachid, 2026-08-16, in chat).
 * A "notify me" box would mean storing personal data before the privacy position
 * is finished, and it would promise an email from an address that currently has
 * nowhere to receive (issue #36). A page that collects nothing owes nothing.
 *
 * It says what Land It is and that it is not ready. It does not give a date —
 * there isn't one, and a missed date on a holding page is worse than no date.
 */

export const metadata: Metadata = {
  title: 'Land It · Coming soon',
  description: `A trick tracker for ${sportsList()} riders. Not open yet.`,
  // Belt and braces with `robots.ts`: that file tells crawlers not to index the
  // site at all while the gate is shut, and this tag says the same thing on the
  // one page they would otherwise reach.
  robots: { index: false, follow: false },
  alternates: { canonical: SITE_URL },
};

/*
 * Read the flag per request, not at build. Without this the page is prerendered
 * with whatever the environment said during `docker build`, and the `notFound()`
 * below would answer from a snapshot taken before the flag was ever set.
 */
export const dynamic = 'force-dynamic';

export default function ComingSoon() {
  // When the site is live this route has no reason to exist, and a stale link to
  // it should not show a "coming soon" page on a product that has launched.
  if (isLiveFromEnv()) notFound();

  return (
    <div className={siteStyles.wash}>
      <div className={siteStyles.bar}>
        <Wordmark />
      </div>

      <div className={styles.body}>
        <span className="eyebrow">{sportsList()} · Coming soon</span>
        <h1 className={`d ${styles.title}`}>
          Not open
          <br />
          <span className={styles.yet}>just yet.</span>
        </h1>
        <p className={styles.copy}>
          Land It is a trick tracker for {sportsList()} riders — log what you&rsquo;re learning,
          what you want next, and how well you&rsquo;ve actually got it. We&rsquo;re still building
          it.
        </p>
        <p className={styles.copySecond}>
          There&rsquo;s nothing to sign up to yet, and we&rsquo;re not collecting your email. Come
          back and it&rsquo;ll be here.
        </p>
        <div className={styles.actions}>
          <Link className="btn ghost" href={legalHref('about')}>
            About Land It
          </Link>
        </div>
      </div>

      <SiteFooter compact minimal />
    </div>
  );
}
