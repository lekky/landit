'use client';

import { ROUTES } from '@/lib/routes';

import { TabRow, type TabRowItem } from '../shell/TabRow';

/**
 * The Find group's one row of tabs: **For you · Spots · Events** (D2, §3.7).
 *
 * One component rather than the same three items written out on three screens,
 * because the row has to be *identical* on all of them for the tabs to read as
 * one control a rider moves along rather than three rows that happen to look
 * alike. It is also the only thing that decides which tab is lit, and that is a
 * question three screens would answer three ways the first time a route grows a
 * child.
 *
 * **Links, not buttons.** These are three addresses, so `TabRow`'s link form
 * draws a plain `nav` of `next/link`s with `aria-current="page"` — a screen
 * reader told something is a tab expects the panel beneath it to change, not
 * the document (§3.3). `tabs_switched { group: 'find', tab }` is fired by
 * `TabRow` itself, so no screen can forget it.
 *
 * **The archive and a rider's own events light Events**, because both are the
 * calendar: `/events/past` is the Past pill of the same screen, and
 * `/events/mine` is where "You're going" leads. A spot's own page lights Spots
 * for the same reason `nav.ts` gives Find the four routes — the group's cell
 * stays lit for everything the group reaches (§2.2).
 */

export type FindTab = 'for-you' | 'spots' | 'events';

const ITEMS: readonly TabRowItem[] = [
  { id: 'for-you', label: 'For you', href: ROUTES.find },
  { id: 'spots', label: 'Spots', href: ROUTES.spots },
  { id: 'events', label: 'Events', href: ROUTES.events },
];

export function FindTabs({ current, className }: { current: FindTab; className?: string }) {
  return (
    <TabRow
      items={ITEMS}
      value={current}
      group="find"
      label="Find: for you, spots or events"
      className={className}
    />
  );
}
