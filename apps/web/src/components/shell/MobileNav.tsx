'use client';

import { Icon } from '@landit/ui-web';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

import { LogSheet } from './LogSheet';
import { isNavActive, mobileNavFor, type NavItem } from './nav';
import styles from './shell.module.css';

/**
 * The fixed bottom bar: **Home · Tricks · LOG · Find · Crew** (D1, Rachid,
 * 2026-09-15, in chat, choosing shape A from three).
 *
 * Five cells, `repeat(5, 1fr)`, as the design has always specified — but the
 * middle one is not a destination. It is `LogCell`: a raised yellow square that
 * opens the LOG sheet, because logging is what a rider opens this product to
 * do and it was previously spread across four screens.
 *
 * ## What went, and why the file is so much shorter
 *
 * The bar used to fold nine destinations into five *sections*, two of which
 * held more than one screen, and it grew a drawer to name the screens the
 * folding hid — opened on arrival in a section and again on a tap of the lit
 * cell. All of that is gone: four groups, four labels, no fold, no drawer, no
 * `useCompactViewport`, no `nav_section_opened`. The screens the folded halves
 * held are reached from Home's cards (T46) and the Find tab row (T48), which is
 * navigation a rider can see rather than a caret they had to understand.
 *
 * It is always in the DOM; the stylesheet is what shows it below 861px and
 * hides `.nav` in the top bar. Keeping the decision in CSS means no layout
 * shift on load and no `matchMedia` in the shell — the drawer was the one thing
 * that needed a width in JavaScript here, and it has taken that with it.
 */

function LogCell({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={styles.logCell}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={open ? 'Close the log sheet' : 'Log something'}
      onClick={onToggle}
    >
      <span className={styles.logSquare} aria-hidden="true">
        <Icon name="plus" size={30} strokeWidth={2.8} className={styles.logGlyph} />
      </span>
      LOG
    </button>
  );
}

export function MobileNav({ sessionsEnabled }: { sessionsEnabled?: boolean }) {
  const items = mobileNavFor(sessionsEnabled);
  const pathname = usePathname();
  const [logging, setLogging] = useState(false);

  const cell = (item: NavItem) => {
    const active = isNavActive(item, pathname);
    return (
      <Link
        key={item.id}
        href={item.href}
        className={active ? 'on' : undefined}
        aria-current={active ? 'page' : undefined}
        // The group's id, not its href: an id is a fixed name from `nav.ts`,
        // while an href could one day carry a parameter.
        onClick={() => capture(ANALYTICS_EVENTS.navClicked, { to: item.id, where: 'mobile' })}
      >
        <Icon name={item.icon} size={21} strokeWidth={2.2} />
        {item.label}
      </Link>
    );
  };

  return (
    <>
      <nav className="mobnav" aria-label="Main, compact">
        {items.slice(0, 2).map(cell)}
        <LogCell
          open={logging}
          onToggle={() => {
            if (!logging) capture(ANALYTICS_EVENTS.logSheetOpened, { where: 'mobile' });
            setLogging(!logging);
          }}
        />
        {items.slice(2).map(cell)}
      </nav>
      {/*
        Beside the bar, not inside it. `.mobnav a` and `.mobnav button` are
        descendant selectors in the shared stylesheet, so a sheet rendered
        inside the bar would have every button in it drawn as a bar cell —
        stacked, 10.5px, uppercase, muted (the trap `sectionDrawer.module.css`
        documented and LESSONS §3a names). It also keeps the sheet out of the
        bar's stacking context, where `z-index: 70` would have capped it.
      */}
      {logging && <LogSheet sessionsEnabled={sessionsEnabled} onClose={() => setLogging(false)} />}
    </>
  );
}
