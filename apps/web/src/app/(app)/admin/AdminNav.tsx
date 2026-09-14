'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useState } from 'react';

import { ADMIN_GROUPS, activeAdminTab, isAdminTabActive, type AdminQueueKey } from './nav';

import styles from './admin.module.css';

/**
 * The portal's section nav: a drawer on a phone, a rail on a desktop.
 *
 * It replaced a flat row of twelve pills (Rachid, 2026-09-14, in chat, choosing
 * option A from the mockups). That row and the screen's filter pills were the
 * same component stacked in the same wrapping box, so nothing said one
 * navigated and the other narrowed — and on a phone the pair took six rows
 * before any work appeared. Two things fix it: the sections collapse behind one
 * button naming where you are, and they come back **grouped**, so the list
 * explains itself. The filters keep their own fix in `ShowBar`.
 *
 * **One element, two shapes, decided in CSS.** The list is always rendered and
 * always in the tree; below 900px it is hidden until the button opens it, and
 * above 900px `admin.module.css` shows it permanently and hides the button.
 * Doing it that way rather than by measuring the viewport in JS means the
 * server-rendered markup is already correct at both widths — a rail that
 * appeared a frame after hydration would be a layout shift on every admin page.
 *
 * The drawer is **inline, not an overlay**: it pushes the content down rather
 * than floating over it. That is what makes it cheap — no focus trap, no
 * click-outside handler, no scroll lock, and nothing that can leave the page
 * unusable if a listener fails to detach.
 *
 * `.pill` styles a `button` in the design pack, so a class put on an `<a>` has
 * to carry its own look — LESSONS §3a, the trap that rendered the whole rider
 * nav unstyled. Every row below restates what a link brings with it rather than
 * trusting the cascade.
 */

/**
 * How much is waiting in each queue, read once by the layout.
 *
 * Partial because a count that failed to load is better absent than zero: "0
 * open reports" is a claim, and this nav should not make one it cannot back.
 */
export type AdminQueueCounts = Readonly<Partial<Record<AdminQueueKey, number>>>;

export function AdminNav({ counts }: { counts: AdminQueueCounts }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const here = activeAdminTab(pathname);

  /*
   * Escape closes it, which is what a keyboard user expects of anything that
   * opened. Bound only while open, so the portal adds no document listener to
   * the twelve screens that are not using one.
   */
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <nav className={styles.nav} aria-label="Staff portal sections">
      <button
        type="button"
        className={styles.navToggle}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.navToggleText}>
          <span className={`lab ${styles.navToggleLab}`}>Section</span>
          {/* Named rather than "Menu", so the closed drawer still says where
              you are. `activeAdminTab` returns nothing only on a path no tab
              claims, which today cannot happen — the fallback is here so a
              future nested screen degrades to a label instead of a blank. */}
          <span className={styles.navToggleName}>{here?.label ?? 'Choose a section'}</span>
        </span>
        <span className={styles.navChev} aria-hidden="true">
          {open ? '▴' : '▾'}
        </span>
      </button>

      <div id={listId} className={styles.navList} data-open={String(open)}>
        {ADMIN_GROUPS.map((group) => (
          <div key={group.id} className={styles.navGroup}>
            {/*
              The group heading is a real heading, not a styled paragraph: it is
              the thing that tells a screen-reader user the twelve sections come
              in three kinds, which is the whole point of the redesign.
            */}
            <h2 className={styles.navGroupLabel}>{group.label}</h2>
            <ul className={styles.navRows}>
              {group.tabs.map((tab) => {
                const waiting = tab.queue ? counts[tab.queue] : undefined;
                const on = isAdminTabActive(tab, pathname);

                return (
                  <li key={tab.id}>
                    {tab.href ? (
                      <Link
                        href={tab.href}
                        className={`${styles.navRow} ${on ? styles.navRowOn : ''}`}
                        aria-current={on ? 'page' : undefined}
                        /*
                         * Closing belongs on the click rather than on a
                         * pathname effect: the tap *is* the event, and an
                         * effect that calls `setOpen` during render is a
                         * cascading render the lint rule rightly refuses.
                         * Without it, tapping a section on a phone leaves
                         * thirteen rows sitting on top of the screen you just
                         * asked for — the height problem the drawer exists to
                         * solve.
                         */
                        onClick={() => setOpen(false)}
                      >
                        <span className={styles.navRowLabel}>{tab.label}</span>
                        {waiting === undefined ? null : (
                          <span
                            className={`${styles.navBadge} ${waiting === 0 ? styles.navBadgeNone : ''}`}
                          >
                            {waiting}
                            <span className={styles.srOnly}> waiting</span>
                          </span>
                        )}
                      </Link>
                    ) : (
                      /* A tab whose screen nobody has landed. A label, not a
                         dead link, and out of the tab order so keyboard focus
                         does not stop on something it cannot open. */
                      <span
                        className={`${styles.navRow} ${styles.navRowSoon}`}
                        aria-disabled="true"
                      >
                        <span className={styles.navRowLabel}>{tab.label}</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
