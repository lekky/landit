'use client';

import { SPORTS, SPORT_IDS, type SportId } from '@landit/core';
import { Dropdown, Equipment, Icon, Sheet } from '@landit/ui-web';
import Link from 'next/link';
import { useRef, useState, useSyncExternalStore } from 'react';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { ROUTES } from '@/lib/routes';
import { SPORT_LOOKS } from '@/lib/sports';
import { useSport } from '@/providers/sport';

import styles from './shell.module.css';

/**
 * The sport, chosen once, in the top bar (D5, Rachid, 2026-09-15, in chat).
 *
 * Before this the product asked the same question on six screens: Home,
 * Progress, Stickers, Challenge, Tricks and the glossary each carried their own
 * sport tab row, all of them writing to the same global state, none of them
 * agreeing on where in the page they sat. A rider learning the app met a
 * control that looked like a filter, six times, and had no way to tell that
 * pressing it on one screen had changed all the others. The chip is that
 * question asked once, in the one place that is on every screen — and the top
 * bar's bottom rule takes the sport's colour, so the answer is visible without
 * reading the chip at all.
 *
 * **Nothing below two sports**, the rule the tab row already had: with one
 * sport there is nothing to switch and a chip saying so is furniture.
 *
 * A sport the rider does not track is drawn greyed with a line pointing at
 * `/account`, rather than left out. Leaving it out means a rider who took up
 * BMX in March has no way of finding out the product tracks it; offering it as
 * a live choice would mean switching into a sport their record says they do not
 * ride. Naming it and saying where to add it is the honest third thing.
 *
 * The named export is `SportSwitchChip`, not `SportChip`: `packages/ui-web`
 * already exports a display-only `SportChip` (the "what it's for" badge on a
 * trick card), and that one is untouched.
 */

const PHONE = '(max-width: 860px)';

function subscribeToWidth(onChange: () => void) {
  const query = window.matchMedia(PHONE);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/**
 * Whether this is a phone, so the chip knows to open a sheet rather than a
 * dropdown. The server has no width and answers `false`; the panel only exists
 * after a press, so nothing renders against the wrong answer.
 */
function usePhone() {
  return useSyncExternalStore(
    subscribeToWidth,
    () => window.matchMedia(PHONE).matches,
    () => false,
  );
}

export function SportSwitchChip() {
  const { sports, sport, setSport } = useSport();
  const phone = usePhone();
  const holder = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  if (sports.length < 2) return null;

  const look = SPORTS[sport];

  const choose = (id: SportId) => {
    if (id !== sport) {
      // Three fixed ids and a fixed `where`. Nothing here is a rider fact.
      capture(ANALYTICS_EVENTS.sportSwitched, { sport: id, from: sport, where: 'chip' });
      setSport(id);
    }
    setOpen(false);
  };

  const rows = (
    <>
      {sports.map((id) => {
        const on = id === sport;
        return (
          <button
            key={id}
            type="button"
            className={`${styles.sportRow} ${on ? styles.sportRowOn : ''}`.trim()}
            aria-current={on ? 'true' : undefined}
            onClick={() => choose(id)}
          >
            <span
              className={styles.sportSwatch}
              style={{ background: SPORTS[id].color }}
              aria-hidden="true"
            />
            {SPORTS[id].label}
            {on && <Icon name="check" size={18} strokeWidth={2.8} className={styles.sportTick} />}
          </button>
        );
      })}

      {SPORT_IDS.filter((id) => !sports.includes(id)).map((id) => (
        <Link
          key={id}
          href={ROUTES.account}
          className={styles.sportRowOff}
          onClick={() => setOpen(false)}
        >
          <span
            className={styles.sportSwatch}
            style={{ background: 'var(--wash)' }}
            aria-hidden="true"
          />
          {SPORTS[id].label} — add it in your account
        </Link>
      ))}
    </>
  );

  return (
    <div className={styles.anchor} ref={holder}>
      <button
        type="button"
        className={styles.sportChip}
        style={{ background: look.color }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Riding: ${look.short}. Switch sport.`}
        onClick={() => setOpen(!open)}
      >
        <Equipment name={SPORT_LOOKS[sport].icon} size={20} strokeWidth={2.4} />
        <span className={styles.sportChipName}>{look.short}</span>
      </button>

      {open &&
        (phone ? (
          <Sheet as="sheet" title="What are you riding?" onClose={() => setOpen(false)}>
            {rows}
          </Sheet>
        ) : (
          <Dropdown
            label="Switch sport"
            width={300}
            holder={holder}
            onClose={() => setOpen(false)}
            className={styles.menuPad}
          >
            {rows}
          </Dropdown>
        ))}
    </div>
  );
}
