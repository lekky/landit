'use client';

import { Icon, stickerArtSrc, stickerArtSrcSet } from '@landit/ui-web';
import Link from 'next/link';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import type { ShelfView } from '@/lib/libraryShelf';
import { ROUTES } from '@/lib/routes';

import styles from './library.module.css';

/**
 * "Your stickers", beside the library's count (Rachid, 2026-09-18, in chat).
 *
 * Three badges and a number, opening the wall. The art is the control: this
 * screen is already a grid of trick cards with their own tags and strips, and a
 * fifth text pill in the header would have read as another filter. The shelf is
 * the one thing on the page that is the rider's rather than the catalogue's.
 *
 * **The art keeps its colour, earned or not** — the badge rule (owner,
 * 2026-08-31, and badge-wide rather than page-scoped on 2026-09-01, #266):
 * never desaturate, grey out or reduce the opacity of a shield, because that
 * reads as art that failed to load rather than as a thing left to go and get.
 * So a rider with an empty wall gets three catalogue badges at full strength
 * and the *words* carry the state ("See what's up for grabs"), which is the
 * reading of the owner's "draw it greyed" that #266 leaves standing. Flagged in
 * the handover rather than settled here.
 *
 * **The flag counts what the rider has not been to look at**, not what has not
 * been announced — `users.stickers_seen_at`, stamped when the wall opens. The
 * older `rider_stickers.seen_at` beside it is consumed by whichever toast
 * announced the award, usually seconds after it landed, so a flag reading that
 * would have been blank on this screen almost every time (the migration says
 * this at length). It caps at `9+`, like the bell's badge.
 */
export function StickerShelf({ shelf }: { shelf?: ShelfView }) {
  if (!shelf) return null;

  const { total, fresh, arts, earned } = shelf;
  const flag = fresh > 9 ? '9+' : String(fresh);

  /*
   * One label for the whole control, because the art is decorative: three
   * badges with their own alt text would read out as a list of sticker names
   * before the thing the link actually does. The count and the flag are both in
   * it, so a screen reader hears what the eye gets from the number and the pink
   * square.
   */
  const label = earned
    ? `Your stickers: ${total} earned${fresh > 0 ? `, ${fresh} you have not seen` : ''}`
    : 'Your stickers: none yet — see what you can earn';

  return (
    <Link
      href={ROUTES.stickers}
      className={styles.shelf}
      aria-label={label}
      onClick={() =>
        capture(ANALYTICS_EVENTS.navClicked, { to: 'stickers', where: 'library-head' })
      }
    >
      <span className={styles.shelfArts} aria-hidden="true">
        {arts.map((art, index) =>
          art.img ? (
            // Our own sticker art, served by us and already resized into the
            // two widths `sticker-art.ts` declares — the same reason
            // `StickerBadge` and the session detail draw it with a plain `img`.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${art.name}-${index}`}
              src={stickerArtSrc(art.img)}
              srcSet={stickerArtSrcSet(art.img)}
              /* The box the CSS fixes, so the browser fetches one size, not a guess. */
              sizes="38px"
              alt=""
              width={512}
              height={512}
              loading="lazy"
              decoding="async"
              draggable={false}
            />
          ) : (
            /*
             * A record from before the printed art (T24) still has a hue and a
             * name. A tinted square with the star is the badge's own fallback
             * shape at this size — `StickerBadge`'s lettered SVG is drawn for a
             * 118px cell and is unreadable at 38.
             */
            <span
              key={`${art.name}-${index}`}
              className={styles.shelfFallback}
              style={{ background: art.hue }}
            >
              <Icon name="star" size={18} strokeWidth={2.4} />
            </span>
          ),
        )}
      </span>

      <span className={styles.shelfText}>
        {earned ? (
          <>
            <b className="d">{total}</b>
            {/*
              "Your" goes below 520px and the label reads "Stickers" there.
              Measured at 390px: with it, the control and "84 tricks" came to
              more than the row has, and the heading wrapped. The accessible
              name is built above and keeps the full wording at every width.
            */}
            <span>
              <span className={styles.shelfWord}>Your </span>stickers
            </span>
          </>
        ) : (
          <span className={styles.shelfEmpty}>
            See what&rsquo;s
            <br />
            up for grabs
          </span>
        )}
      </span>

      {fresh > 0 && <span className={styles.shelfFlag}>{flag} new</span>}
    </Link>
  );
}
