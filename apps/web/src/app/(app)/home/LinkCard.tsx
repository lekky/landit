'use client';

import { Icon, type IconName } from '@landit/ui-web';
import type { Route } from 'next';
import Link from 'next/link';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

import styles from './home.module.css';

/**
 * A record card on Home (rethink §3.4) — the way into Progress, Sessions,
 * Stickers and the weekly Challenge.
 *
 * Those four screens lost their own place in the bar when the shell folded nine
 * destinations into four groups (D8, T45): all four are **under Home** now, and
 * these cards are the whole of how a rider reaches them. So a card is not
 * decoration that happens to be clickable — it is navigation, and it is held to
 * navigation's standards. It is an `<a>`, so it has an address, a status bar
 * preview, a middle-click and a focus stop; it carries a number the rider can
 * read without following it, so the dashboard still answers "how am I doing"
 * without four taps; and it fires the same `nav_clicked` the bars fire, with
 * `where: 'home-card'`, because a card nobody presses is a screen that has gone
 * dark and nothing else would say so.
 *
 * **The number is the point, and the arrow is the promise.** `value` is an
 * Anton number at 30px — landed tricks, sessions this month, stickers earned,
 * "1/3" logged — and `sub` is the one line of context underneath. Both are
 * built on the server (`view.ts`), so nothing here is produced by ICU on one
 * side of hydration and not the other (LESSONS §3a).
 *
 * The press is §4's one gesture, and it is in `home.module.css` rather than
 * here: `translate(2px, 2px)` with the shadow dropping to 1px, the same as
 * every other tappable box in the product.
 */
export function LinkCard({
  href,
  to,
  title,
  icon,
  value,
  sub,
  hue,
}: {
  readonly href: Route;
  /**
   * What `nav_clicked` carries as `to` — `progress`, `sessions`, `stickers` or
   * `challenge`. A route id, which is a catalogue fact and not a rider one.
   */
  readonly to: string;
  readonly title: string;
  readonly icon: IconName;
  /** The big number, already a string: "12", "1/3", "—". */
  readonly value: string;
  /** One line under it: "3 learning · 5 want to". */
  readonly sub: string;
  /** The card's fill, from the tokens. */
  readonly hue: string;
}) {
  return (
    <Link
      href={href}
      className={styles.card}
      style={{ background: hue }}
      onClick={() => capture(ANALYTICS_EVENTS.navClicked, { to, where: 'home-card' })}
    >
      <span className={styles.cardHead}>
        <span className="lab">{title}</span>
        <Icon name={icon} size={18} strokeWidth={2.4} />
      </span>
      <span className={`d ${styles.cardValue}`}>{value}</span>
      <span className={styles.cardSub}>{sub}</span>
      {/*
        The arrow says "this goes somewhere" without a second sentence saying
        so. Decoration: the link's own text is the title, the number and the
        line under it, which is what a screen reader should read out.
      */}
      <Icon name="arrow-right" size={17} strokeWidth={2.6} className={styles.cardArrow} />
    </Link>
  );
}
