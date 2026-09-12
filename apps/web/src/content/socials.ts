/**
 * The social accounts, in one place.
 *
 * These URLs were three copies of the same fact and are now one. The footer
 * (`components/site/SiteFooter.tsx`) listed them as link rows, `lib/
 * structuredData.ts` restated them as the organisation's `sameAs`, and both
 * carried a comment telling the next session to remember the other. The
 * landing hero is the third place that needs them, which is one too many to
 * keep synchronising by hand.
 *
 * **The handles are not the same on both platforms.** Instagram is
 * `@landthetrickapp` — `@landthetrick` was taken there — while TikTok is
 * `@landthetrick` (owner, 2026-09-11, in chat). That asymmetry is the exact
 * thing the old duplication got wrong once already: the Instagram link pointed
 * at the TikTok handle and went nowhere.
 *
 * **Only claimed accounts go in this list.** A YouTube row sat in the footer
 * until 2026-09-05 pointing at a `@landthetrick` channel that does not exist
 * (owner, in chat). On a product used by children, a link that advertises a
 * door and then refuses it is worse than no link: the whole job of these three
 * placements is to let a stranger check we are real, and an empty account
 * proves the opposite. An account gained or lost is edited here and nowhere
 * else.
 */

/** Stable per-account key. Doubles as the `landing_cta` target, so it is a fixed string. */
export type SocialId = 'instagram' | 'tiktok';

export type Social = {
  id: SocialId;
  /** The platform, as a person would say it. The accessible name of a logo link. */
  name: string;
  /** The account, `@` included — different per platform, see above. */
  handle: string;
  href: string;
};

export const SOCIALS: readonly Social[] = [
  {
    id: 'instagram',
    name: 'Instagram',
    handle: '@landthetrickapp',
    href: 'https://instagram.com/landthetrickapp',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    handle: '@landthetrick',
    href: 'https://tiktok.com/@landthetrick',
  },
];

/**
 * The same accounts as schema.org's `sameAs` — the list of profiles that are
 * demonstrably this brand, which is how a search engine reconciles them with
 * this site. Derived rather than retyped, so it cannot drift from the links a
 * rider actually sees.
 */
export const SOCIAL_SAME_AS: readonly string[] = SOCIALS.map((social) => social.href);
