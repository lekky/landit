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
 * **The handles are not the same on every platform.** Instagram is
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
export type SocialId = 'instagram' | 'tiktok' | 'facebook';

export type Social = {
  id: SocialId;
  /** The platform, as a person would say it. The accessible name of a logo link. */
  name: string;
  /**
   * What the account is called, said the way that platform says it: an `@`
   * handle where the platform issues one, and the page's own name where it does
   * not. It is the second half of the accessible name, so it answers "which
   * account am I about to open" and nothing else.
   */
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
  /*
   * The Facebook page (owner, 2026-09-12, in chat). A page rather than a
   * profile, and the third account the site links: it had been running since
   * 2026-09-11 with nothing on the site pointing at it.
   *
   * **Two things about this URL are deliberate, and both are the kind of thing
   * a later session will want to "tidy".**
   *
   * It is the numeric page id, because this page has no vanity username yet.
   * `facebook.com/<id>` is the canonical address Facebook itself serves for
   * such a page and it never stops resolving, including after a username is
   * claimed. What was offered first was a `facebook.com/share/...` link, which
   * is a redirect token: fine to paste to a person, wrong here. Half the job of
   * this list is `SOCIAL_SAME_AS` below — the claim that this profile is this
   * brand — and a share token identifies nothing a search engine can reconcile.
   *
   * The handle is therefore the page's name, not an `@` anything. Inventing
   * `@landthetrick` here would put a handle we do not own into a screen
   * reader's mouth. **If a username is claimed, this entry is the one place to
   * change** — and the numeric link keeps working either way, so it is an
   * improvement rather than a repair.
   */
  {
    id: 'facebook',
    name: 'Facebook',
    handle: 'Land The Trick',
    href: 'https://facebook.com/1324987644027132',
  },
];

/**
 * The same accounts as schema.org's `sameAs` — the list of profiles that are
 * demonstrably this brand, which is how a search engine reconciles them with
 * this site. Derived rather than retyped, so it cannot drift from the links a
 * rider actually sees.
 */
export const SOCIAL_SAME_AS: readonly string[] = SOCIALS.map((social) => social.href);
