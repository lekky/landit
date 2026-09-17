'use client';

import { Icon } from '@landit/ui-web';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { ROUTES } from '@/lib/routes';

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

/** The raised yellow square and its label, which both forms of the cell wear. */
function LogFace() {
  return (
    <>
      <span className={styles.logSquare} aria-hidden="true">
        <Icon name="plus" size={30} strokeWidth={2.8} className={styles.logGlyph} />
      </span>
      LOG
    </>
  );
}

/**
 * The middle cell, and what the cross on it does and does not mean.
 *
 * §4 asks the plus to turn into a cross while the sheet is open "so the cell
 * reads as 'close' too". It does turn, and since the sheet and its scrim now
 * stop at the top of the bar it is visible while they are up — which the first
 * cut of this was not (review S1).
 *
 * **It is a state, not a second way out.** A sheet is `aria-modal`, and
 * `inertOutside` makes everything outside the dialog `inert` — which is what
 * `aria-modal` promises and what stops a rider tabbing into the page behind. An
 * inert subtree takes no pointer events, so the cell cannot be pressed while
 * the sheet is up, and the label therefore does not offer a close it cannot
 * perform. Escape, a tap on the scrim and a drag down are the ways out, and the
 * scrim is now everything on screen except the bar.
 *
 * Making the cell genuinely pressable would mean teaching `inertOutside` to
 * keep one element live — shared code another task owns, and the same function
 * issue #540 is about.
 */
function LogCell({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={styles.logCell}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label="Log something"
      onClick={onToggle}
    >
      <LogFace />
    </button>
  );
}

/**
 * The same cell for a visitor with no account: a link to sign in.
 *
 * The bar stays five cells — `.mobnav` is `repeat(5, 1fr)` and a four-cell bar
 * on the signed-out screens beside a five-cell one on the signed-in ones would
 * be two bars to learn. What changes is what the cell does.
 *
 * Drawn as a button it was the loudest control on `/spots`, `/events` and
 * `/library` for somebody it could do nothing for: "I rode today" bounced them
 * to `/signin` with no explanation, and both trick pickers came back empty
 * because `trickPickerAction` answers a session-less call with nothing (review
 * B2). A link says where it goes before it is pressed, which is the honest
 * version of the same invitation.
 */
function LogSignInCell() {
  return (
    <Link href={ROUTES.signIn} className={styles.logCell} aria-label="Sign in to log something">
      <LogFace />
    </Link>
  );
}

export function MobileNav({
  sessionsEnabled,
  rodeToday,
  signedIn,
}: {
  sessionsEnabled?: boolean;
  /** Today's ride is already counted (owner, 2026-09-17). */
  rodeToday?: boolean;
  /** Whether there is a rider to log for. `AppShell` decides it from `rider`. */
  signedIn?: boolean;
}) {
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
        {signedIn ? (
          <LogCell
            open={logging}
            onToggle={() => {
              if (!logging) capture(ANALYTICS_EVENTS.logSheetOpened, { where: 'mobile' });
              setLogging(!logging);
            }}
          />
        ) : (
          <LogSignInCell />
        )}
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
      {signedIn && logging && (
        <LogSheet
          sessionsEnabled={sessionsEnabled}
          rodeToday={rodeToday}
          onClose={() => setLogging(false)}
        />
      )}
    </>
  );
}
