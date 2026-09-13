'use client';

import { Icon } from '@landit/ui-web';

import styles from './spots.module.css';

import type { FavouriteSource } from './useFavourites';
import type { SpotView } from './view';

/**
 * The star that faves a spot, on a list card and on a spot's own page.
 *
 * **A real `<button>` with `aria-pressed`**, not a div and not a checkbox. It
 * sits on top of a card that is itself a stretched link (`.cardLink`), so it
 * has to be above it on `z-index` and it has to stop the press travelling — a
 * rider tapping the star and landing on the spot page would be the same class
 * of bug the card's other controls already guard against.
 *
 * **It says which spot, because the corner has no room to.** The visible label
 * is the star alone; `aria-label` carries "Fave Ventnor Skatepark" so a screen
 * reader hears which of twenty-four cards it is on, and `aria-pressed` carries
 * the state rather than the label flipping under the reader.
 *
 * **Nothing is drawn until the rider's faves have loaded** (`ready`). A star
 * that renders empty and fills a moment later tells every returning rider that
 * they have no faves, for exactly as long as the read takes.
 *
 * **Signed out, it is not rendered at all.** The screens decide that — see
 * `signedIn` at their call sites — rather than rendering a control that only
 * exists to send somebody to sign-in. `/spots` already has one thing that does
 * that job ("+ Add a spot"), and a star on every card promising the same trip
 * is twenty-four invitations to leave the page.
 */
export function FaveButton({
  spot,
  on,
  pending,
  source,
  onToggle,
  size = 20,
  className = '',
}: {
  readonly spot: SpotView;
  readonly on: boolean;
  readonly pending: boolean;
  readonly source: FavouriteSource;
  readonly onToggle: (spot: SpotView, source: FavouriteSource) => void;
  readonly size?: number;
  readonly className?: string;
}) {
  return (
    <button
      type="button"
      className={`${styles.fave} ${on ? styles.faveOn : ''} ${className}`}
      aria-pressed={on}
      aria-label={on ? `Remove ${spot.name} from your faves` : `Fave ${spot.name}`}
      // `aria-busy` rather than `disabled`: a disabled control loses focus and
      // stops announcing, and the press has already been applied on screen.
      // A second press during the write is absorbed by the ticket in
      // `useFavourites`, so there is nothing to guard against here.
      aria-busy={pending || undefined}
      onClick={(event) => {
        // The card behind this is a stretched link. Without both of these a
        // fave navigates to the spot page.
        event.preventDefault();
        event.stopPropagation();
        onToggle(spot, source);
      }}
    >
      {/*
        Always stroked, never `fill`ed through the prop: `Icon` drops the
        stroke entirely when it is given a fill, and a star with no outline is
        not this design language. `.faveOn` fills the path in CSS instead, so
        the filled state keeps the hard black edge every other mark here has.
      */}
      <Icon name="star" size={size} strokeWidth={2.4} />
    </button>
  );
}
