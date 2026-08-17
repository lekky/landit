import type { Route } from 'next';
import Link from 'next/link';

import { ROUTES, legalHref } from '@/lib/routes';
import { sportsWithArticles } from '@/lib/sports';

import { Wordmark } from './Wordmark';
import styles from './site.module.css';

/**
 * The site footer, shared by the signed-out pages and the app shell
 * (screenshot 02).
 *
 * Columns whose destination has not been built yet render as plain labels —
 * see `lib/routes.ts` for why, and for the one line that turns each back into a
 * link. Stickers, Events, Spots, Crew, the weekly challenge and plans are still
 * labels; T10 to T15 land those routes and each fills in its own line.
 *
 * The footer is shared with the signed-out pages, and Progress is a signed-in
 * screen that bounces a visitor to `/signin`. That is deliberate rather than
 * overlooked: `components/shell/nav.ts` already links it for signed-out
 * visitors on `/library` — which is readable without an account — so leaving
 * the footer a label while the top bar links it would be the odd choice.
 *
 * The prototype's "Avatar set" link is not here at all: it pointed at
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
      { label: 'Trick library', href: ROUTES.library },
      { label: 'Progress', href: ROUTES.progress },
      { label: 'Stickers', href: ROUTES.stickers },
      { label: 'Events', href: ROUTES.events },
      { label: 'Spots', href: ROUTES.spots },
    ],
  },
  {
    title: 'Riders',
    links: [
      { label: 'Crew', href: ROUTES.crew },
      { label: 'Weekly challenge', href: ROUTES.challenge },
      { label: 'Plans and pricing', href: ROUTES.plans },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Land The Trick', href: legalHref('about') },
      { label: 'Contact', href: legalHref('about') },
      { label: 'Safeguarding', href: legalHref('safeguarding') },
      // T18. "Easy" is what the OSA codes actually ask for, and a route nobody
      // can find is not easy. It is in the footer of every page, and it works
      // without an account (plan §6.1).
      { label: 'Report something', href: ROUTES.report },
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
  /**
   * Drops the four link columns, leaving the brand and the bottom strip.
   *
   * Set by the pre-launch holding page and nothing else. Those columns are a map
   * of a product that is not open yet — most of them render as plain labels
   * because the screens do not exist — and listing Events, Spots and Crew
   * underneath the words "not open just yet" reads as a roadmap nobody asked
   * for. The bottom strip stays, because that is where Privacy and Terms are,
   * and those have to remain reachable while the gate is shut.
   */
  minimal?: boolean;
};

export function SiteFooter({ compact = false, minimal = false }: SiteFooterProps) {
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

          {!minimal &&
            COLUMNS.map((col) => (
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
            © {year} Land The Trick. Made in the north of England.
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
