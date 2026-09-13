'use client';

import { foregroundFor } from '@landit/ui-web';
import type { ReactElement } from 'react';

import { SOCIALS, type SocialId } from '@/content/socials';
import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

import type { CtaTarget } from './LandingCta';
import styles from './landing.module.css';

/**
 * The Instagram, TikTok and Facebook accounts, as logo tiles in the landing
 * page's top bar.
 *
 * **Facebook joined on 2026-09-12** (owner, in chat: "we have a Facebook page as
 * well but the links are only to Instagram and TikTok"). It is the one of the
 * three a *parent* is likeliest to take, which matters more here than its
 * follower count does: the stranger this row is for is often the person paying,
 * and on a product a child signs up to that person checks before they allow.
 * The tiles come from `content/socials.ts`, so a fourth account is that file
 * plus a mark and a fill below — and nothing else on the page.
 *
 * **Why the page carries them at all** (Rachid, 2026-09-12, in chat): a
 * stranger arriving at `landthetrick.com` has no way to tell whether this is a
 * running product or a parked domain with a checkout bolted on. The question
 * asked for was "is there a good way to get people to check us out and actually
 * see we're real?", and a live account they can go and look at is the cheapest
 * proof there is — dated, with a face behind it, in a format they already know
 * how to read. Until the tiles, the only mention of any of them was a row of
 * text tags in the footer, four screens below where that doubt forms.
 *
 * **Logos, no copy** (owner, same conversation). No lead-in line, no handles
 * beside the marks, no follower counts: a count that is small proves the
 * opposite of what this row is for, and it cannot be fetched without an API key
 * and is stale the moment it renders. The handle is the accessible name instead
 * (`.socialName` below), so the words are there for anyone who needs them
 * without spending a line of the fold.
 *
 * **Links, never embeds.** Meta's and TikTok's embed scripts set third-party
 * cookies and fingerprint the visitor, on a page a child reaches, against a
 * cookie policy that promises cookieless analytics. Considered and refused
 * (owner, same conversation). Nothing here loads third-party code: three anchors
 * and three inline paths.
 *
 * **Why the bar and not the hero**, which is the one part of this that was
 * measured rather than argued. Three placements were built on the running page
 * and shot at 1280x900 and 390x844. The hero is 952px tall on its own, so the
 * obvious spot — last in the hero, after the sign-up field and the two doors
 * that need no account — starts *below* a laptop fold, and a row added to be
 * seen becomes one a visitor has to scroll for. Directly under the form clears
 * the fold at both sizes, but it drops a way off the site into the middle of
 * the one sequence on this page that works, and that slot is the byline's now.
 *
 * The bar is the only placement that is genuinely at the top, and it is free:
 * 34px tiles fit inside the height Sign in and Start free already set, so the
 * bar is 60px with them and 60px without, and at 960px — four nav links, both
 * buttons, all three tiles — nothing overflows.
 *
 * **The third tile was measured before it shipped, because a bar is where that
 * gets expensive.** Built and shot at 1280, 960, 901 (a pixel above where the
 * nav hides) and 390: the document's scroll width equals its client width at
 * every one of those except the phone, and the phone's is identical with two
 * tiles and three — 412px against a 390px viewport either way. That overflow is
 * the sticker wall, which is issue #380 and was there before this row existed.
 * The bar itself never overflows at any width, and adding the tile changed its
 * height nowhere: 60px on a desktop, 68px on a phone, with two tiles or three.
 *
 * What it costs is the company it keeps: three outbound links in the same strip
 * as the one button this page most wants pressed. That is the trade, and
 * `landing_cta` is what will eventually say whether it was the right one.
 */

/**
 * The three brand marks, drawn rather than fetched.
 *
 * Inline paths, not `packages/ui-web`'s `ICONS`: that set is transcribed
 * path-for-path from the design pack on a 24px grid at stroke 2.2, and these
 * are somebody else's trademarks with their own geometry. A TikTok note redrawn
 * to house stroke weight is a misdrawn logo, and the sticker badges centre
 * every shape in that map inside a 120px circle, so adding three marks nothing
 * else uses would put them on the sticker wall's shortlist.
 *
 * **Do not "tidy" the Instagram corners to match the design language.** Radius
 * is 0 everywhere in this product, and that rule is about our own surfaces: the
 * tile these sit on has hard corners and a hard offset shadow like everything
 * else. The mark inside it is a rounded square because that is what the mark
 * is, and squaring it off would be drawing a logo that does not exist.
 *
 * All three take `currentColor`, so the tile's `foregroundFor` answer paints
 * them.
 */
const MARKS: Record<SocialId, ReactElement> = {
  /* Three stroked shapes. Instagram's mark is an outline, so it stays one. */
  instagram: (
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.6" y="2.6" width="18.8" height="18.8" rx="5.4" strokeWidth="2.3" />
      <circle cx="12" cy="12" r="4.35" strokeWidth="2.3" />
      <circle cx="17.35" cy="6.65" r="1.35" fill="currentColor" stroke="none" />
    </g>
  ),
  tiktok: (
    <path
      fill="currentColor"
      d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"
    />
  ),
  /*
   * One contour, and the "f" is the hole in it — the tile's own fill showing
   * through a solid disc, not a second colour. That is what keeps this mark to
   * the one `currentColor` the other two use, and it is why the path is not
   * separable into "a circle" and "an f": pull them apart and the letter needs
   * a colour this component does not have.
   *
   * It is also the only mark here that reaches the edges of the 24 box, where
   * Instagram's rounded square stops at 2.6 and TikTok's note is narrower still
   * — hence its own entry in `MARK_WEIGHTS` below.
   */
  facebook: (
    <path
      fill="currentColor"
      d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854V15.54H7.078v-3.467h3.047V9.43c0-3.007 1.791-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.251h3.328l-.532 3.467h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
    />
  ),
};

/**
 * How much ink each mark puts in the same box, so the three can be given back
 * different amounts of size.
 *
 * Three logos drawn at the same 19px do not *look* the same size: a stroked
 * outline reads smaller than a filled glyph, and a glyph that stops short of
 * the viewBox reads smaller than one that fills it. The numbers live in
 * `landing.module.css`; this map only says which drawing is which.
 *
 * - `outline` — Instagram, three stroked shapes. The baseline, no correction.
 * - `solid` — TikTok, one filled path, but a narrow one.
 * - `disc` — Facebook, a filled circle touching all four edges of the box. It
 *   needs the most taken off, and a boolean could not say so: this map was
 *   `SOLID_MARKS: Record<SocialId, boolean>` until the third account arrived
 *   and turned "is it solid" into the wrong question.
 *
 * Named for what the drawing is, not where it sits, so a fourth account answers
 * the question rather than inheriting an answer from its position in the list.
 */
const MARK_WEIGHTS: Record<SocialId, 'outline' | 'solid' | 'disc'> = {
  instagram: 'outline',
  tiktok: 'solid',
  facebook: 'disc',
};

/** The class each weight asks for, or none for the uncorrected baseline. */
const WEIGHT_CLASSES: Record<'outline' | 'solid' | 'disc', string | undefined> = {
  outline: undefined,
  solid: styles.socialMarkSolid,
  disc: styles.socialMarkDisc,
};

/**
 * The fill per account, from the page's own accent tokens.
 *
 * Brand-adjacent rather than brand-exact, on purpose: Instagram takes the
 * page's pink and TikTok its teal, which is close enough to read instantly and
 * still the palette this page paints in. An Instagram gradient and a TikTok
 * cyan side by side would be two other companies' brand blocks sitting in our
 * top bar.
 *
 * Hex, not `var(--gpink)`: `foregroundFor` only understands hex and returns
 * `undefined` for anything it cannot parse, so a token here would silently fall
 * through to the stylesheet's default rather than being measured. These are the
 * same two values `landing.module.css` gives those tokens, and they are the
 * fills `.peek` and `.peekEvents` already carry — 4.87:1 with ink on the pink,
 * comfortably more on the teal.
 */
const FILLS: Record<SocialId, string> = {
  instagram: '#f5266e',
  tiktok: '#2ec4b6',
  /*
   * Facebook takes the page's yellow, and the one colour it could not take is
   * Facebook blue. `--blue` fails contrast against both ink and paper (issue
   * #278), so `foregroundFor` has nothing safe to put on it, and a blue this
   * page paints nothing else in would read as a brand block rather than a tile
   * — which is the trade the other two already made. Yellow is the third and
   * last of `landing.module.css`'s accents: a fourth account needs a colour
   * decision, not just a hex.
   *
   * It sits two places from the orange Start free button, which is the closest
   * pairing in the strip. They stay distinguishable because the button is
   * 13px uppercase type and this is a 34px square, and the tile is the quieter
   * of the two by shape even where the hues are neighbours.
   */
  facebook: '#ffc22e',
};

export type SocialLinksProps = {
  /**
   * Which zone of the page the row is in, sent as `landing_cta`'s `place`.
   *
   * One value, because there is one row. It stays a prop rather than becoming a
   * constant so that the event's `place` is chosen at the call site like every
   * other call to action on this page, and so a second row elsewhere cannot be
   * added without saying where it is.
   */
  place: 'bar';
  className?: string;
};

export function SocialLinks({ place, className }: SocialLinksProps) {
  return (
    <ul className={`${styles.socials}${className ? ` ${className}` : ''}`}>
      {SOCIALS.map((social) => {
        /*
         * Annotated rather than inferred, and that is the whole point of the
         * line: `capture`'s properties are `Record<string, unknown>`, so
         * nothing downstream checks this string. Naming the type here is what
         * makes an account added to `content/socials.ts` a compile error until
         * `CtaTarget` documents it too.
         */
        const target: CtaTarget = social.id;
        const fill = FILLS[social.id];
        const weightClass = WEIGHT_CLASSES[MARK_WEIGHTS[social.id]];
        return (
          <li key={social.id}>
            {/*
              A plain anchor, not `LandingCta`: `typedRoutes` types that
              component's `href` as an internal route, and there is nothing here
              for Next to prefetch. It fires the same event, because this is the
              same question the rest of the page's calls to action ask — a
              stranger with no account pressed something, which one, from where
              — and a second event would have split one funnel to describe one
              behaviour.

              `rel` is the ordinary hygiene for `target="_blank"`, and matters
              slightly more than usual here: these are the only links on the
              page that hand a third party a referrer.
            */}
            <a
              className={styles.socialTile}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ background: fill, color: foregroundFor(fill) }}
              onClick={() => capture(ANALYTICS_EVENTS.landingCta, { target, place })}
            >
              <svg
                className={`${styles.socialMark}${weightClass ? ` ${weightClass}` : ''}`}
                viewBox="0 0 24 24"
                width="19"
                height="19"
                aria-hidden="true"
                focusable="false"
              >
                {MARKS[social.id]}
              </svg>
              {/*
                The platform and the handle, hidden from sight and not from
                anything else. The owner asked for logos alone, and two
                unlabelled marks are two unlabelled marks to a screen reader —
                "link, link" — so the words are here rather than absent. Real
                text rather than `aria-label`, because a translation layer and a
                text-matching test can both read it.

                It says the handle as well as the platform because the handles
                differ between the two accounts, and "Instagram" alone does not
                tell a listener which account they are about to open.
              */}
              <span className={styles.socialName}>
                {social.name}, {social.handle}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
