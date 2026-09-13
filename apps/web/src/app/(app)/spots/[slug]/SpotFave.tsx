'use client';

import { Icon } from '@landit/ui-web';

import { useFavourites } from '../useFavourites';
import type { SpotView } from '../view';

import styles from './spot.module.css';

/**
 * "Fave this spot" on a spot's own page.
 *
 * A client island on an otherwise server-rendered page, and a small one: it
 * holds one spot's state, and the page around it — which is crawlable, cached
 * and read by people with no account — stays server-rendered. That is also why
 * the *page* does not ask the database for the rider's faves: doing so would
 * make a public page's HTML depend on who is reading it.
 *
 * **A labelled control, not the bare star the cards carry.** On a list a star
 * in the corner of a card is read from its neighbours; alone in a strip beside
 * "Directions" it is a mystery. So it says what it does and what it did.
 *
 * **Nothing is rendered until the read lands** (`ready`), for the reason
 * `FaveButton` sets out: a control that says "Fave" and flips to "Faved" a beat
 * later tells a returning rider they had lost it.
 */
export function SpotFave({
  spot,
  signedIn,
}: {
  readonly spot: SpotView;
  readonly signedIn: boolean;
}) {
  const faves = useFavourites(signedIn);

  // Signed out there is nothing to show. The page already has its own
  // invitation to join further down; a second one in the strip would be two
  // ways off a page a rider came to read.
  if (!signedIn || !faves.ready) return null;

  const on = faves.ids.has(spot.id);
  const pending = faves.pending.has(spot.id);

  return (
    <div className={styles.faveWrap}>
      <button
        type="button"
        className={`btn sm ghost ${styles.faveBtn} ${on ? styles.faveBtnOn : ''}`}
        aria-pressed={on}
        aria-busy={pending || undefined}
        onClick={() => faves.toggle(spot, 'spot_page')}
      >
        {/*
          Stroked, never given `Icon`'s `fill` — which drops the stroke — so
          the filled star keeps the hard black outline. `.faveBtnOn` fills it.
        */}
        <Icon name="star" size={16} strokeWidth={2.6} />
        {on ? 'Faved' : 'Fave'}
      </button>
      {faves.error && (
        <p className={styles.faveError} role="alert">
          {faves.error}
        </p>
      )}
    </div>
  );
}
