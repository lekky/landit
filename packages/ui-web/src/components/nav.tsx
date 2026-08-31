'use client';

import type { CSSProperties } from 'react';

import { cx } from '../cx';
import type { IconName } from '../icons';
import { Equipment } from '../sport-art';
import type { SportLook } from './tricks';

/**
 * The tab row (`.sporttabs`) and the small sport chip (`.sportchip`).
 *
 * Sport switching is global state, not per page — that wiring is T5's. This is
 * only the control.
 */

export type TabItem = {
  id: string;
  label: string;
  /**
   * Shorter label for narrow screens, e.g. "Skate" for "Skateboard". Only used
   * when the row is `compact`; without it the full label shows at every width.
   */
  shortLabel?: string;
  icon?: IconName;
  /** Colour of the tab when selected. */
  color?: string;
  /** Faded number on the right of the label, e.g. a trick count. */
  note?: string | number;
};

export type TabsProps = {
  items: readonly TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** Accessible name for the tab row. */
  label?: string;
  /**
   * Below 520px, show `shortLabel` instead of `label` and hide the note.
   *
   * The sport switch sets this: at three sports a 375px phone has about 110px
   * per tab, which fits an icon and "Skate" but not "Skateboard · 12 landed"
   * (`additions.css`). Rows of two or three fixed tabs generally do not need it.
   */
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
};

/** One-or-the-other tabs. Hide the row yourself when there is only one item. */
export function Tabs({
  items,
  value,
  onChange,
  label,
  compact = false,
  className,
  style,
}: TabsProps) {
  return (
    <div
      className={cx('sporttabs', compact && 'sporttabs-compact', className)}
      style={style}
      role="tablist"
      aria-label={label}
    >
      {items.map((it) => {
        const on = value === it.id;
        return (
          <button
            type="button"
            key={it.id}
            role="tab"
            aria-selected={on}
            className={cx('sporttab', on && 'on')}
            onClick={() => onChange(it.id)}
            style={
              on ? { background: it.color, borderColor: 'var(--ink)', color: '#fff' } : undefined
            }
          >
            {/*
             * `Equipment`, not `Icon`: a tab row is a sport switch as often as it is
             * a section switch, and this is where the sport switch and the sticker
             * wall draw their scooter. Every other tab icon falls through to the
             * stroked glyph, which is what `Equipment` does with a name it has no
             * art for.
             */}
            {it.icon && <Equipment name={it.icon} size={17} strokeWidth={2.3} />}
            {it.shortLabel ? (
              <>
                <span className="tab-full">{it.label}</span>
                <span className="tab-short">{it.shortLabel}</span>
              </>
            ) : (
              it.label
            )}
            {it.note !== undefined && <span className="n">{it.note}</span>}
          </button>
        );
      })}
    </div>
  );
}

export type SportChipProps = {
  sport: SportLook;
  /** The 10px version used on trick cards. */
  small?: boolean;
  className?: string;
  style?: CSSProperties;
};

/**
 * "What it's for" badge: equipment plus short sport name, keyline in sport
 * colour.
 *
 * The art is given 16/19px where the stroked glyph took 12/13. Painted wheels
 * and a die-cut edge need the extra two or three pixels to read at all, and the
 * chip is laid out `align-items: center` around its tallest child, so the badge
 * grows by that much and nothing inside it moves.
 */
export function SportChip({ sport, small = false, className, style }: SportChipProps) {
  return (
    <span
      className={cx('sportchip', className)}
      style={{ borderColor: sport.color, color: sport.color, fontSize: small ? 10 : 11, ...style }}
    >
      <Equipment name={sport.icon} size={small ? 16 : 19} strokeWidth={2.4} />
      {sport.label}
    </span>
  );
}
