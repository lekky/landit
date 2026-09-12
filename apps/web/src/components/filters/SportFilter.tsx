'use client';

import { SPORTS, SPORT_IDS, type SportId } from '@landit/core';
import { foregroundFor, Pill } from '@landit/ui-web';
import { useCallback } from 'react';

import { toggleSport } from '@/lib/sportFilter';

import styles from './sportFilter.module.css';

/**
 * The sport filter for a list of things riders browse — `/events` and `/spots`.
 *
 * **It is a multi-select, and it is not the sport switch** (Rachid, 2026-09-12,
 * in chat: "I just want them to be able to pick everything, or one of each, or
 * multiple"). Both screens used to filter with a two-state pill bound to
 * `useSport` — "Every sport" or "Good for {the sport you ride}" — above a
 * `SportSwitch` tab row that chose which sport that was. Three things were
 * wrong with that, and they compounded:
 *
 * - **The tab row disappears below two sports** (`SportSwitch` returns `null`),
 *   and it is fed by the rider's own `users.sports`. So a rider who records one
 *   sport saw *no* tab row and a pill hard-wired to that sport: the calendar
 *   offered "Every sport" or "Good for Skate" and nothing else, with scooter
 *   and BMX unreachable. That is the bug this file closes.
 * - **The tab row is global state.** Switching it to look at BMX events changed
 *   the sport on home, library, progress and stickers too. Browsing what is on
 *   is not a statement about what you ride.
 * - **It could not express "scooter and BMX".** One sport or all of them, with
 *   nothing in between.
 *
 * So the sports a rider can *filter by* are `SPORT_IDS` — every sport the
 * product has, never the subset they ride — and the selection is a set. Empty
 * is "every sport", which is what both screens open on.
 *
 * The switch itself is untouched and still global on every other screen; these
 * two simply stopped using it. That divergence from plan §7 T13, which put
 * `SportSwitch` on `/spots` deliberately in 2026-08-31, is recorded in
 * `docs/implementation-plan.md` under T13 rather than only here.
 */
export function SportFilter({
  value,
  onChange,
  everyLabel,
  note,
  label = 'Filter by sport',
}: {
  /** The chosen sports. Empty is every sport, and is the default both screens open on. */
  readonly value: readonly SportId[];
  readonly onChange: (next: readonly SportId[]) => void;
  /** The "all of them" pill's words — "Every sport" on events, "Every spot" on spots. */
  readonly everyLabel: string;
  /** Faded count after a sport's name, e.g. `id => '12 on'`. */
  readonly note?: (id: SportId) => string;
  /** Accessible name for the group. */
  readonly label?: string;
}) {
  /*
   * Pressing the last chosen sport off lands back on "every sport" rather than
   * on nothing — `toggleSport` returns an empty list and empty is every sport.
   * A filter whose only possible answer is an empty screen would be reachable
   * by un-pressing one pill, with nothing on screen to say what had happened.
   */
  const toggle = useCallback((id: SportId) => onChange(toggleSport(value, id)), [value, onChange]);

  return (
    <div className={styles.row} role="group" aria-label={label}>
      <Pill on={value.length === 0} onClick={() => onChange([])}>
        {everyLabel}
      </Pill>
      {SPORT_IDS.map((id) => {
        const on = value.includes(id);
        return (
          <Pill
            key={id}
            on={on}
            onClick={() => toggle(id)}
            /*
             * The sport's own colour when it is on, so a row of three reads as
             * three sports rather than three identical dark pills. Off, it
             * keeps the stylesheet's plain pill — the colour is what "chosen"
             * looks like.
             */
            style={
              on
                ? {
                    background: SPORTS[id].color,
                    color: foregroundFor(SPORTS[id].color) ?? 'var(--on-dark)',
                  }
                : undefined
            }
          >
            {SPORTS[id].short}
            {note ? <span className={styles.note}>{note(id)}</span> : null}
          </Pill>
        );
      })}
    </div>
  );
}
