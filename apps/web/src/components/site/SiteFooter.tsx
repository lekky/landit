import type { Route } from 'next';
import Link from 'next/link';

import { LEGAL_CONTACT_HEADING, legalSectionId } from '@/content/legal';
import { ROUTES, legalHref } from '@/lib/routes';
import { sportsWithArticles } from '@/lib/sports';

import { Wordmark } from './Wordmark';
import styles from './site.module.css';

/**
 * The site footer, shared by the signed-out pages and the app shell
 * (screenshot 02).
 *
 * **Every entry here goes somewhere.** Columns whose destination had not been
 * built rendered as greyed labels until T10–T15 landed the routes; the last
 * three placeholders went on 2026-08-30 — the dead `Staff` label (issue #135)
 * and the three social tags, which are now the real accounts. A footer entry
 * that opens nothing is worse than no entry: on a product used by children it
 * advertises a door and then refuses it. If a future column needs a target that
 * does not exist yet, leave the column out rather than reviving the label.
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
 *
 * **Below 760px the four columns are disclosures** (plan §7 T5, thirteenth
 * divergence, 2026-09-12). Flat, they were 906px of footer on a 390px phone —
 * more than a screen — because seventeen links at the 44px touch floor cannot
 * be made short, only folded. The fold is the `input`/`label` pair below rather
 * than `<details>`, and that choice is load-bearing rather than old-fashioned:
 * a closed `<details>` hides its content in the UA shadow tree, which author
 * CSS cannot re-open, so the same markup could not be a disclosure on a phone
 * and four plain columns on a desktop. The checkbox can: `.colLinks` is visible
 * by default and only the phone query hides it, so a stylesheet that never
 * arrives leaves every link on the page.
 *
 * The cost of folding is that the four column headings are one tap further
 * away, which is why **Report something** is now in the always-visible bottom
 * strip as well. That link is the one this footer is not allowed to make
 * harder to find (T18, and the note on the Company column below).
 */

type FooterLink = { label: string; href: Route };
type FooterColumn = { title: string; links: readonly FooterLink[] };

const COLUMNS: readonly FooterColumn[] = [
  {
    title: 'The app',
    links: [
      { label: 'Trick library', href: ROUTES.library },
      { label: 'Glossary', href: ROUTES.glossary },
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
      { label: 'Challenge', href: ROUTES.challenge },
      { label: 'Plans and pricing', href: ROUTES.plans },
    ],
  },
  {
    title: 'Company',
    links: [
      // Two entries, two pages, on purpose: the story is why this exists and
      // the About document is what it is. Merging them would put a twelve year
      // old's account of learning to drop in inside the set that holds the
      // privacy policy.
      { label: 'Why we made this', href: ROUTES.story },
      { label: 'About Land The Trick', href: legalHref('about') },
      // Was the top of the same page as the entry above it, which made two
      // footer entries one destination and left "Contact" reading as a stub for
      // a page nobody built. It lands on the addresses now.
      {
        label: 'Contact',
        href: legalHref('about', legalSectionId(LEGAL_CONTACT_HEADING)),
      },
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

/**
 * The real accounts (owner, 2026-08-30, in chat). The handles are *not* the
 * same across both: Instagram is `@landthetrickapp` — `@landthetrick` was taken
 * there — while TikTok is `@landthetrick` (owner, 2026-09-11, in chat). The
 * Instagram link pointed at the TikTok handle until then and went nowhere.
 *
 * A YouTube row sat here until 2026-09-05, pointing at a `@landthetrick`
 * channel that does not exist — a footer link to nothing (owner, in chat). Only
 * accounts that are actually claimed go in this list; the same entries are
 * restated as `sameAs` in `lib/structuredData.ts`, so an account gained or lost
 * is edited in both.
 *
 * External, so plain anchors rather than `Link` — `typedRoutes` types `href` as
 * an internal route and there is nothing for Next to prefetch. `rel` is the
 * ordinary hygiene for a `target="_blank"`.
 */
const SOCIALS: readonly { name: string; href: string }[] = [
  { name: 'Instagram', href: 'https://instagram.com/landthetrickapp' },
  { name: 'TikTok', href: 'https://tiktok.com/@landthetrick' },
];

function FooterLinkItem({ label, href }: FooterLink) {
  return (
    <Link className={`cond ${styles.link}`} href={href}>
      {label}
    </Link>
  );
}

export type SiteFooterProps = {
  /**
   * Drops the four link columns, leaving the brand and the bottom strip.
   *
   * Set by the pre-launch holding page and nothing else. Those columns are a map
   * of a product that is not open yet, and listing Events, Spots and Crew
   * underneath the words "not open just yet" reads as a roadmap nobody asked
   * for. The bottom strip stays, because that is where Privacy and Terms are,
   * and those have to remain reachable while the gate is shut.
   */
  minimal?: boolean;
};

/*
 * There was a `compact` prop here until 2026-08-30. Its whole job was hiding the
 * dead `Staff` label from signed-out pages (issue #135); the label is gone, so
 * the prop had nothing left to switch and every caller was passing it for no
 * effect.
 */
export function SiteFooter({ minimal = false }: SiteFooterProps) {
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
              {SOCIALS.map((social) => (
                <a
                  key={social.name}
                  className={`lab ${styles.socialTag}`}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {social.name}
                </a>
              ))}
            </div>
          </div>

          {/*
            Each column is a labelled `nav`, not a bare div. The four titles
            already read as group headings to a sighted rider; `aria-labelledby`
            is what makes "The app", "Company" and "Legal" mean the same thing in
            a landmark list, so the footer stops being one undifferentiated run
            of seventeen links.

            The `input` is the phone's fold and nothing else: it is
            `display: none` from 760px up, so on a desktop it is not focusable,
            not announced, and the `label` is an ordinary heading over an
            ordinary column. Below 760px it is the only state in the footer, and
            `.colToggle:checked ~ .colLinks` is why the order here — input,
            label, links — is not free to change.
          */}
          {!minimal &&
            COLUMNS.map((col) => {
              const slug = col.title.toLowerCase().replace(/\s+/g, '-');
              const titleId = `footer-col-${slug}`;
              const toggleId = `footer-toggle-${slug}`;
              return (
                <nav key={col.title} className={styles.col} aria-labelledby={titleId}>
                  <input className={styles.colToggle} id={toggleId} type="checkbox" />
                  <label className={`lab ${styles.colTitle}`} htmlFor={toggleId} id={titleId}>
                    {col.title}
                    {/*
                      Drawn rather than typed: two bars, the upright of which is
                      scaled away when the section is open, so a plus becomes a
                      minus at exactly the weight of the rules around it. A glyph
                      would have been the font's idea of a minus sign instead.
                    */}
                    <span aria-hidden="true" className={styles.colMark} />
                  </label>
                  <div className={styles.colLinks}>
                    {col.links.map((link) => (
                      <FooterLinkItem key={link.label} {...link} />
                    ))}
                  </div>
                </nav>
              );
            })}
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
            {/*
              Deliberately the same destination as the Company column's last
              entry, the way Privacy and Terms have always restated the Legal
              column's first two. On a phone that column is folded, and reporting
              is the one thing this footer may not put behind a tap (T18).

              Not on the holding page: `/report` is not in `proxy.ts`'s
              `ALWAYS_OPEN`, so while the gate is shut it answers with the
              holding page — a footer entry that opens nothing, which is the
              thing the note at the top of this file forbids.
            */}
            {!minimal && (
              <Link className={`cond ${styles.bottomLink}`} href={ROUTES.report}>
                Report something
              </Link>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
