'use client';

import type { CSSProperties } from 'react';

import { foregroundFor } from '../contrast';
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
  /**
   * `title` for the tab, for a label the row may have to clip (T47).
   *
   * Only worth setting where the label is data rather than copy — a crew's
   * name, not "Over time". A clipped label is still complete in the DOM, so a
   * screen reader reads all of it either way; this is for the sighted reader
   * with a pointer.
   */
  title?: string;
  /**
   * DOM `id` for the tab's button, so a panel can be `aria-labelledby` it (T50).
   *
   * ARIA's tabs pattern names a `tabpanel` after the tab that controls it, and
   * a panel cannot point at an element that has no id — so this is what makes
   * the reference possible. Without it a caller falls back to `aria-label` and
   * a copy of the tab's words, which is the same name by a route that can drift
   * from its source.
   *
   * It does not make the name unique: a tab and a control inside its panel may
   * legitimately be called the same thing, and on the session form they are
   * (the Notes step, and the notes textarea). Disambiguate by role.
   *
   * Optional, and absent by default: a row that does not pass one renders
   * exactly the markup it rendered before.
   */
  elementId?: string;
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
  /**
   * `boxed` is the app shell rethink's tab row (§3.3): each tab an equal share
   * of the row at a 44px floor, the active one yellow with the 4px lift.
   *
   * A new value, not a new default. `default` is exactly the row this component
   * has always drawn — tabs sized by their own content, the active one filled
   * with whatever colour the item carries — which is what the sport switch and
   * every other caller still gets without changing a line.
   */
  variant?: 'default' | 'boxed';
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
  variant = 'default',
  className,
  style,
}: TabsProps) {
  const boxed = variant === 'boxed';
  return (
    <div
      className={cx('sporttabs', compact && 'sporttabs-compact', boxed && 'tabrow', className)}
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
            id={it.elementId}
            role="tab"
            aria-selected={on}
            className={cx('sporttab', on && 'on')}
            title={it.title}
            onClick={() => onChange(it.id)}
            // A boxed row's active tab is the design's yellow lift (§3.3, D6),
            // the same one on every screen, so it takes no colour from the item
            // — `.tabrow .sporttab.on` paints it and an inline background would
            // outrank that.
            style={
              on && !boxed
                ? {
                    background: it.color,
                    borderColor: 'var(--ink)',
                    color: foregroundFor(it.color) ?? 'var(--on-dark)',
                  }
                : undefined
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
              /*
               * Wrapped, where it used to be a bare text node (T47).
               *
               * A label a caller cannot predict the length of — a crew's name on
               * What's new, 2 to 40 characters — has to be able to clip, and
               * `text-overflow` needs a box of its own: the anonymous text run
               * inside a flex container is not one, so an ellipsis set on the
               * button did nothing and a 37-character crew name pushed the whole
               * document 85px sideways on a 320px phone (issue #550, T47 review
               * B1). The `.tab-full` / `.tab-short` pair above has always had its
               * box; this gives the ordinary case the same one.
               *
               * Inert on its own: it inherits everything from `.sporttab` and is
               * still one flex item where the text run was. Only a row that asks
               * for it clips — `TabRow` in `apps/web` is the one that does.
               */
              <span className="tab-label">{it.label}</span>
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
      // The keyline carries the sport colour; the label is ink. In the prototype
      // the label was the sport colour too, which on paper is 3.06:1 for the
      // scooter's orange and 4.46 for the skateboard's blue - an 11px label on
      // the top bar of every page. The painted equipment art never took the
      // colour (plan, fifth divergence), so the chip still reads as its sport.
      style={{ borderColor: sport.color, color: 'var(--ink)', fontSize: small ? 10 : 11, ...style }}
    >
      <Equipment name={sport.icon} size={small ? 16 : 19} strokeWidth={2.4} />
      {sport.label}
    </span>
  );
}
