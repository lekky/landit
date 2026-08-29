'use client';

import { SPORTS, type SportId } from '@landit/core';
import { Tabs, type TabItem } from '@landit/ui-web';
import { useMemo } from 'react';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

import { useSport } from '@/providers/sport';
import { SPORT_LOOKS } from '@/lib/sports';

/**
 * The sport tab row (screens A and B put it directly under the page heading).
 *
 * Three things it deliberately does:
 *
 * - **One tab per entry in `SPORT_IDS`.** Two today, three when T21 lands BMX
 *   (plan §1). No literal pair, and no layout that only works for two.
 * - **Nothing below two.** "Tabs only appear when a rider does both sports"
 *   (handoff, Interactions) — with one sport there is nothing to switch.
 * - **It survives a 375px phone at three sports.** The row is `compact`, so
 *   below 520px each tab shows the short sport name and the note is dropped.
 *   Without that, three tabs plus "12 landed" wrap into two ragged lines. The
 *   note is a nicety; the switch is not.
 */
export function SportSwitch({
  note,
  label = 'Sport',
}: {
  /** Faded text after the label, e.g. `id => tricksFor(id).length`. */
  note?: (id: SportId) => string | number;
  /** Accessible name for the tab row. */
  label?: string;
}) {
  const { sports, sport, setSport } = useSport();

  const items = useMemo<TabItem[]>(
    () =>
      sports.map((id) => ({
        id,
        label: SPORTS[id].label,
        shortLabel: SPORTS[id].short,
        icon: SPORT_LOOKS[id].icon,
        color: SPORTS[id].color,
        note: note?.(id),
      })),
    [sports, note],
  );

  if (sports.length < 2) return null;

  return (
    <Tabs
      items={items}
      value={sport}
      onChange={(id) => {
        // A sport id is one of three fixed strings — the same for everybody.
        capture(ANALYTICS_EVENTS.sportSwitched, { sport: id, from: sport });
        setSport(id as SportId);
      }}
      label={label}
      compact
    />
  );
}
