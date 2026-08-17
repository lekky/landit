/**
 * Where Land The Trick can be reached, and the domain it lives on.
 *
 * **One place, because these are promises.** The safeguarding address is
 * published in the terms and on the safeguarding page with a one-working-day
 * response commitment (plan §7, T5), and it is also the address the guardian
 * consent email gives a parent who has a concern. An address that is wrong in
 * one of those places and right in the others is worse than one that is wrong
 * everywhere, because nobody notices.
 *
 * They were nine separate string literals until 2026-08-16, when the domain
 * changed from `landit.app` — which the product had promised in published copy
 * without owning — to `landthetrick.com`. That sweep is the reason this file
 * exists: same shape as the mail provider's name a day earlier, and the same
 * lesson (LESSONS §4). The next domain change is one line here.
 *
 * `pocketbase/hooks/lib/consent_mail.js` keeps its own copy, because the JSVM
 * cannot import TypeScript. That is the one deliberate duplicate and it says so.
 *
 * **Every address here has to be able to receive mail**, which is a separate
 * job from sending it — see `docs/infrastructure.md`. A published address that
 * bounces is worse than no address at all, and one of these carries a
 * safeguarding promise.
 */

/** The product's domain, and since the 2026-08-17 rename, the brand as well. */
export const DOMAIN = 'landthetrick.com' as const;

/** The public web address, for copy and for links out of an email. */
export const SITE_URL = `https://${DOMAIN}` as const;

/**
 * The four addresses the product publishes.
 *
 * - `safeguarding` — anything about a rider's safety. Answered within one
 *   working day; that promise is in the terms and on the safeguarding page, and
 *   it is a commitment the owner made deliberately rather than a description of
 *   a feature.
 * - `privacy` — data access and deletion requests (30 days).
 * - `hello` — everything else.
 * - `events` — parks, shops and comps asking to be on the calendar.
 */
export const CONTACT = {
  safeguarding: `safeguarding@${DOMAIN}`,
  privacy: `privacy@${DOMAIN}`,
  hello: `hello@${DOMAIN}`,
  events: `events@${DOMAIN}`,
} as const;

/** Every published address, for a test that wants to check the whole set. */
export const CONTACT_ADDRESSES: readonly string[] = Object.freeze(Object.values(CONTACT));
