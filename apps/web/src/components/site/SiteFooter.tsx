import type { Route } from 'next';
import Link from 'next/link';

import { legalHref } from '@/lib/routes';
import { sportsWithArticles } from '@/lib/sports';

import { Wordmark } from './Wordmark';
import styles from './site.module.css';

/**
 * The site footer, shared by the signed-out pages and the app shell
 * (screenshot 02).
 *
 * Columns whose destination has not been built yet render as plain labels —
 * see `lib/routes.ts` for why, and for the one line that turns each back into a
 * link. The prototype's "Avatar set" link is not here at all: it pointed at
 * `Land It - Avatars.html`, a page of the design pack that no task in §7 turns
 * into a route, so there is nothing for it to become. Filed as an issue rather
 * than guessed at.
 */

type FooterLink = { label: string; href?: Route };
type FooterColumn = { title: string; links: readonly FooterLink[] };

const COLUMNS: readonly FooterColumn[] = [
  {
    title: 'The app',
    links: [
      { label: 'Trick library' },
      { label: 'Progress' },
      { label: 'Stickers' },
      { label: 'Events' },
      { label: 'Spots' },
    ],
  },
  {
    title: 'Riders',
    links: [{ label: 'Crew' }, { label: 'Weekly challenge' }, { label: 'Plans and pricing' }],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Land It', href: legalHref('about') },
      { label: 'Contact', href: legalHref('about') },
      { label: 'Safeguarding', href: legalHref('safeguarding') },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy policy', href: legalHref('privacy') },
      { label: 'Terms of use', href: legalHref('terms') },
      { label: 'Cookies', href: legalHref('cookies') },
    ],
  },
];

const SOCIALS = ['Instagram', 'YouTube', 'TikTok'];

function FooterLinkItem({ label, href }: FooterLink) {
  if (!href) {
    return (
      <span className={`cond ${styles.link} ${styles.linkPending}`} aria-disabled="true">
        {label}
      </span>
    );
  }
  return (
    <Link className={`cond ${styles.link}`} href={href}>
      {label}
    </Link>
  );
}

export type SiteFooterProps = {
  /**
   * Drops the Staff link. The signed-out pages set it: there is no reason to
   * show a rider the door to the admin app.
   */
  compact?: boolean;
};

export function SiteFooter({ compact = false }: SiteFooterProps) {
  // Rendered on the server, so on a statically generated page this is the build
  // year. That is what the prototype's client-side `getFullYear()` amounted to
  // as well, and a footer is not worth making the page dynamic for.
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.footerIn}>
        <div className={styles.grid}>
          <div className={styles.brand}>
            <div style={{ marginBottom: 12 }}>
              <Wordmark />
            </div>
            <p className={styles.brandCopy}>
              Every trick you can do, on {sportsWithArticles()}, tracked properly. Log it, learn it,
              land it.
            </p>
            <div className={styles.social}>
              {SOCIALS.map((name) => (
                <span key={name} className={`lab ${styles.socialTag}`}>
                  {name}
                </span>
              ))}
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <div className={`lab ${styles.colTitle}`}>{col.title}</div>
              <div className={styles.colLinks}>
                {col.links.map((link) => (
                  <FooterLinkItem key={link.label} {...link} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.bottom}>
          <span className={`cond ${styles.bottomNote}`}>
            © {year} Land It. Made in the north of England.
          </span>
          <span className={`lab ${styles.bottomWarn}`}>
            Ride within your ability. Wear a helmet.
          </span>
          <div className={styles.bottomLinks}>
            <Link className={`cond ${styles.bottomLink}`} href={legalHref('privacy')}>
              Privacy
            </Link>
            <Link className={`cond ${styles.bottomLink}`} href={legalHref('terms')}>
              Terms
            </Link>
            {!compact && (
              <span className={`cond ${styles.staffLink}`} aria-disabled="true">
                Staff
              </span>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
