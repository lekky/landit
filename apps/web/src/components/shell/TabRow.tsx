'use client';

import { Icon, Tabs, type IconName, type TabItem } from '@landit/ui-web';
import type { Route } from 'next';
import Link from 'next/link';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

import styles from './shell.module.css';

/**
 * The boxed tab row (§3.3, D6) — the product's way of getting about inside a
 * group, and the thing that fires `tabs_switched`.
 *
 * **In `apps/web`, not in `packages/ui-web`** (review S10). The design-system
 * half of this is `Tabs variant="boxed"`, which is what draws the row: separate
 * boxes with the 3px keyline and the hard offset, the active one yellow with
 * the 4px lift. What cannot live there is the rest of what §3.3 asks for — the
 * analytics call, because `packages/ui-web` knows nothing about
 * `ANALYTICS_EVENTS` and should not, and the link form, because it renders
 * `next/link`. So the shell owns the wrapper and the package owns the paint.
 *
 * Two forms, because §3.3 asks for two:
 *
 * - **Switching content in place** — `role="tablist"` of buttons, the caller
 *   holding `value` and taking `onChange`. Progress, Stickers, Crew, a rider's
 *   profile, Plans, What's new and the session form's three steps.
 * - **Switching route** — items with an `href` render "a plain `nav` of links",
 *   as on Find. A tab that is a page may not be a `role="tab"`: a screen reader
 *   told it is a tab expects the panel to change under it, not the document to.
 *
 * Both fire `tabs_switched` `{ group, tab }` from here, so a screen cannot
 * forget: an event that four later sessions each have to remember is one that
 * ships half-wired, and there is no autocapture to fall back on.
 *
 * T45 builds and exports it; T46, T48 and T52 are what put it on screens.
 */

export type TabRowItem = {
  /**
   * The tab's own id — React's key, the caller's state, and the default value
   * of `tabs_switched`'s `tab`. Where that id is a record id rather than a
   * catalogue one, set `analyticsId` as well: see below.
   */
  id: string;
  label: string;
  icon?: IconName;
  /**
   * A count after the label, in `.sporttab`'s faded `.n` (T46).
   *
   * The sticker wall's Earned / Not yet row carried one before the rethink and
   * it is the reason to press either tab — "Not yet 109" is a wall worth
   * opening, "Not yet" is a word. A count of the rider's own badges is a fact
   * on screen, never a property on an event: `tabs_switched` carries the tab id
   * and nothing else.
   */
  note?: string | number;
  /**
   * What `tabs_switched` carries as `tab`, when `id` may not leave the browser.
   *
   * `ANALYTICS_EVENTS.tabsSwitched` says both properties are catalogue ids, and
   * a row whose tabs *are* records has to say something else: What's new has a
   * tab per crew, and sending `crew.id` would put a membership graph into a
   * third-party store — every rider who shares a crew, linked, on a product
   * whose child-safety position rests on crews having no discovery surface
   * (T47 review S3). Such a row sends `crew-1`, `crew-2` and keeps the real id
   * as local state.
   */
  analyticsId?: string;
  /**
   * `title` for the tab, for a label the row will clip.
   *
   * Worth setting where the label is data rather than copy — a crew's name, not
   * "Over time".
   */
  title?: string;
  /** Present on a row that navigates. All items in a row agree. */
  href?: Route;
};

export type TabRowProps = {
  items: readonly TabRowItem[];
  /** The tab being looked at. On a link row, match it against the pathname. */
  value: string;
  /** The screen's catalogue id — `find`, `progress`, `whats-new`. */
  group: string;
  /** Accessible name for the row. */
  label: string;
  /** Called after the event, for a row that switches content in place. */
  onChange?: (id: string) => void;
  className?: string;
};

export function TabRow({ items, value, group, label, onChange, className }: TabRowProps) {
  const analyticsIdOf = (id: string) => items.find((item) => item.id === id)?.analyticsId ?? id;

  /**
   * Fire `tabs_switched`, **unless nothing switched**.
   *
   * Pressing the tab you are already on is not a switch, and counting it as one
   * quietly inflates every funnel built on this event: a rider tapping the
   * active tab twice while reading looks like two moves between sections, so
   * "which tab do riders actually go to" is answered partly by fidgeting. Found
   * by the T48 review, in the row rather than on a screen, so all nine users of
   * `TabRow` get it.
   *
   * It returns whether it fired, so both forms below can leave early on the
   * same condition. For the button form that also skips `onChange`, which would
   * be setting the caller's state to the value it already holds; a caller that
   * ever needs "the tab was *pressed*" rather than "the tab changed" should say
   * so with a prop rather than by reading a no-op event.
   */
  const fire = (id: string): boolean => {
    if (id === value) return false;
    capture(ANALYTICS_EVENTS.tabsSwitched, { group, tab: analyticsIdOf(id) });
    return true;
  };

  const links = items.every((item) => item.href);

  /*
   * **The row never widens the page** (issue #550, T47 review B1).
   *
   * `.tabrow .sporttab` is `flex: 1` with `white-space: nowrap`, and a flex
   * item's `min-width` is `auto` — so a label that does not fit makes its box
   * refuse to shrink, the row grows past its container, and the whole document
   * scrolls sideways. Measured with a 37-character crew name: 475px of document
   * at 320, 360, 375 and 390.
   *
   * It is fixed **here** rather than on a screen because §3.3 lists nine users
   * of this row and several have three tabs or more; T46 tightened it for
   * Progress alone and filed #550 saying so. It is fixed here rather than in
   * `packages/ui-web`'s `.tabrow` because that stylesheet is merged shared code
   * two sibling tasks are building on this wave, and the class below reaches
   * every row that goes through this component without moving anything that
   * does not.
   *
   * What gives is the label, and only once there is no padding left to give:
   * `rowFit` clips with an ellipsis and leaves the full string in the DOM, so a
   * screen reader still reads the whole crew name and a pointer gets it from
   * `title`. #550 asked for the words to be the last thing to go, and they are —
   * the tracking and the padding tighten first.
   */
  const rowClass = `${styles.rowFit} ${className ?? ''}`.trim();

  if (links) {
    return (
      <nav className={`sporttabs tabrow ${rowClass}`.trim()} aria-label={label}>
        {items.map((item) => {
          const on = item.id === value;
          return (
            <Link
              key={item.id}
              href={item.href as Route}
              className={`sporttab ${on ? 'on' : ''}`.trim()}
              aria-current={on ? 'page' : undefined}
              title={item.title}
              // The navigation is left alone — pressing the tab you are on is
              // allowed to reload the page. Only the count declines it.
              onClick={() => {
                fire(item.id);
              }}
            >
              {item.icon && <Icon name={item.icon} size={16} strokeWidth={2.3} />}
              <span className="tab-label">{item.label}</span>
              {item.note !== undefined && <span className="n">{item.note}</span>}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <Tabs
      variant="boxed"
      items={items.map((item): TabItem => ({
        id: item.id,
        label: item.label,
        icon: item.icon,
        ...(item.note !== undefined ? { note: item.note } : {}),
        ...(item.title ? { title: item.title } : {}),
      }))}
      value={value}
      label={label}
      className={rowClass}
      onChange={(id) => {
        if (!fire(id)) return;
        onChange?.(id);
      }}
    />
  );
}

/**
 * The class a caller puts on the panel a `TabRow` switches, for §4's 120ms
 * cross-fade.
 *
 * It is the caller's because the panel is the caller's: this component draws
 * the row and knows nothing about what is under it. Key the panel on the tab id
 * (`<div key={tab} className={TAB_PANEL}>`) so React remounts it and the
 * animation runs again on every switch.
 */
export const TAB_PANEL = styles.tabPanel;
