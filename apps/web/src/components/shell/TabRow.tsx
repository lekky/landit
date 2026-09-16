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
  /** A catalogue id — what `tabs_switched` carries as `tab`. */
  id: string;
  label: string;
  icon?: IconName;
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
  const fire = (tab: string) => capture(ANALYTICS_EVENTS.tabsSwitched, { group, tab });

  const links = items.every((item) => item.href);

  if (links) {
    return (
      <nav className={`sporttabs tabrow ${className ?? ''}`.trim()} aria-label={label}>
        {items.map((item) => {
          const on = item.id === value;
          return (
            <Link
              key={item.id}
              href={item.href as Route}
              className={`sporttab ${on ? 'on' : ''}`.trim()}
              aria-current={on ? 'page' : undefined}
              onClick={() => fire(item.id)}
            >
              {item.icon && <Icon name={item.icon} size={16} strokeWidth={2.3} />}
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <Tabs
      variant="boxed"
      items={items.map((item): TabItem => ({ id: item.id, label: item.label, icon: item.icon }))}
      value={value}
      label={label}
      className={className}
      onChange={(id) => {
        fire(id);
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
