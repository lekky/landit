/**
 * The one fact the confirm-your-email reminder keeps between visits.
 *
 * A cookie rather than `localStorage`, so the **server** decides whether the
 * banner is in the tree at all. Read on the client and the layout would have to
 * render it first and take it away on hydration, which is a flash of a bar the
 * rider dismissed last week — and it is the kind of flash that makes a product
 * feel like it is not listening.
 *
 * Not httpOnly and not a secret: it is a display preference, it is set by the
 * click that dismisses the bar, and the worst a forged one can do is hide a
 * reminder from the person who would have been reminded.
 */
export const VERIFY_DISMISSED_COOKIE = 'landit_verify_dismissed';

/**
 * How long dismissal lasts.
 *
 * Not forever: a rider who dismissed it on the first afternoon would never
 * learn why it mattered, and would find out on the day they cannot sign in. Not
 * every page load either — plan §6.4 is explicit that this product does not
 * nag. A week is the compromise.
 */
export const VERIFY_DISMISS_DAYS = 7;
