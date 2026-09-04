import { CONTACT, SITE_URL, SPORTS, TIERS_LABEL, type Trick } from '@landit/core';

import { lowerLabel } from '@/lib/sports';

/**
 * Schema.org descriptions of what a page is about, for the machines that read
 * pages rather than look at them.
 *
 * **Why this exists.** A search engine and an answer engine are both guessing,
 * from prose, what a page is: whether "Bunny Hop" is a trick or a rabbit,
 * whether Land The Trick is a company or a turn of phrase. JSON-LD stops the
 * guessing. It is the difference between a page that might be summarised
 * correctly and one that describes itself, and it is the only part of a page an
 * AI system can read without inferring anything.
 *
 * **Only what the page already says.** A claim here that the page does not
 * carry is what search engines call structured-data spam, and it is also simply
 * a lie about the product. Every field below is read off the trick record or
 * off `data/contact.ts`; nothing is written out a second time, for the same
 * reason the sports list is generated rather than typed (LESSONS §4).
 *
 * This module imports nothing from React or Next and returns plain objects, so
 * the shapes are unit-testable without rendering anything. That matters more
 * here than usual: a malformed graph fails **silently** — it is ignored, and
 * nobody finds out.
 */

/** The loose shape of a JSON-LD node. Values are whatever schema.org allows. */
export type JsonLdNode = Record<string, unknown>;

/**
 * Land The Trick itself, and the site it runs.
 *
 * Two nodes rather than one, because they answer different questions: the
 * `Organization` is who publishes this, and the `WebSite` is the thing at this
 * address. Giving both an `@id` is what lets every other page point at the
 * publisher instead of restating it ninety-odd times.
 *
 * `sameAs` is the list of profiles that are demonstrably the same brand, which
 * is how a search engine reconciles those accounts with this site. It matches
 * the footer's list exactly (`components/site/SiteFooter.tsx`) — if one gains
 * an account, so does the other.
 */
export function organizationLd(): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'Land The Trick',
        url: SITE_URL,
        logo: `${SITE_URL}/icon.png`,
        email: CONTACT.hello,
        sameAs: [
          'https://instagram.com/landthetrick',
          'https://youtube.com/@landthetrick',
          'https://tiktok.com/@landthetrick',
        ],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: 'Land The Trick',
        url: SITE_URL,
        publisher: { '@id': `${SITE_URL}/#organization` },
        inLanguage: 'en-GB',
      },
    ],
  };
}

/** What `trickHowToLd` needs that is not on the trick record. */
export type TrickHowToContext = {
  /** The page's own absolute URL. */
  url: string;
  /** The "What you need" line, which is staff copy on the sport, not the trick. */
  equipment?: string;
};

/**
 * One trick, as a `HowTo`.
 *
 * `HowTo` rather than `Article`, because that is what the page is: a thing a
 * rider is trying to do, what they need in order to do it, and what to do. The
 * page already carries every part of that shape, so this describes the page
 * rather than adding to it.
 *
 * **The steps are the two the page shows, and no more.** It is tempting to
 * invent numbered steps out of the prose, and it would be wrong — a `HowTo`
 * listing steps a reader cannot find on the page is exactly the mismatch the
 * structured-data guidelines are written against. Staff copy is one lowdown and
 * one set of tips, so this is two steps.
 *
 * The prerequisite tricks are deliberately **not** here. They are on the page,
 * as links, which is the form that is useful to a crawler; `HowTo` has no field
 * that means "be able to do this first" — `supply` and `tool` both mean things
 * you own — and bending one of those to fit would describe the page wrongly to
 * say something the links already say properly.
 */
export function trickHowToLd(trick: Trick, context: TrickHowToContext): JsonLdNode {
  // `lowerLabel`, not `.toLowerCase()`: "BMX" is an acronym and survives, where
  // "Skateboard" does not (`lib/sports.ts`). This string is the `HowTo`'s name,
  // which is the single sentence most likely to be read back to somebody.
  const sport = lowerLabel(trick.sport);
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: `How to ${trick.name.toLowerCase()} on a ${sport}`,
    description: trick.about,
    url: context.url,
    inLanguage: 'en-GB',
    publisher: { '@id': `${SITE_URL}/#organization` },
    /*
     * Free to read, and true. The paywall is on *tracking* a trick, never on
     * its lowdown, and a locked trick renders the locked page — which is a
     * different page and is not described by this.
     */
    isAccessibleForFree: true,
    /** Rookie to Pro, in the words the page uses. */
    educationalLevel: TIERS_LABEL[trick.diff - 1],
    about: { '@type': 'Thing', name: `${SPORTS[trick.sport].label} tricks` },
    ...(context.equipment ? { supply: [{ '@type': 'HowToSupply', name: context.equipment }] } : {}),
    step: [
      { '@type': 'HowToStep', name: 'The lowdown', text: trick.about },
      { '@type': 'HowToStep', name: 'Tips', text: trick.tips },
    ],
  };
}

/**
 * A node, as the text that goes inside `<script type="application/ld+json">`.
 *
 * `JSON.stringify` escapes quotes but not `<`, so staff copy containing
 * `</script>` would close the tag and everything after it would be parsed as
 * markup. Escaping the angle bracket to its `\u003c` form is the standard
 * defence and costs nothing: a JSON parser reads the escape back as the
 * character, and the HTML parser never sees a `<` it could act on.
 */
export function jsonLdText(node: JsonLdNode): string {
  return JSON.stringify(node).replace(/</g, '\\u003c');
}
