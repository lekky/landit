'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { ROUTES } from '@/lib/routes';

import styles from './account.module.css';

/**
 * The account's frame: a list, and the screen a row opens (rethink §3.9).
 *
 * **One layout, two shapes, decided in CSS rather than on the server.**
 *
 * - **Phone.** `/account` is the list; a row's screen is that screen, with a
 *   "Your account" back link (§2.3). So at the root the detail pane holds the
 *   header a rider arrives at, and below it the rows; anywhere else the list is
 *   `display: none` and the sub-screen has the phone to itself.
 * - **Desktop.** A 340px column of rows on the left and the chosen panel on the
 *   right, at every one of the seven addresses. The URL is what picks the
 *   panel, so a link lands on it.
 *
 * The one thing that has to be known at render time is "are we on the list or
 * on one of its screens", and `usePathname` is the cheapest honest answer:
 * a layout is not handed the path, and the alternative — a `<div>` per page
 * that says which it is — puts the same fact in seven files.
 *
 * **The detail pane is first in the DOM**, and the grid puts the list left on a
 * desktop (`grid-column`) rather than the flex `order` a first cut used. The
 * `h1` of whichever screen a rider is on then comes before the navigation that
 * reaches the others, which is the order a screen reader wants; on a phone at
 * the root it puts "Your account / Nia Okafor" above the rows, which is the
 * order a rider wants.
 */
export function AccountShell({ list, children }: { list: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const atRoot = pathname === ROUTES.account;

  return (
    <div className={`${styles.shell} ${atRoot ? styles.shellRoot : ''}`.trim()}>
      <div className={styles.detail}>{children}</div>
      <div className={styles.listCol}>{list}</div>
    </div>
  );
}
