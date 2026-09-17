import type { ReactNode } from 'react';

import styles from './feed.module.css';

/**
 * The feed row — one disc, one sentence, a `.lab` line under it.
 *
 * **One set of styles, two screens.** The crew screen drew this row first and
 * What's new asks for "the existing crew-feed row" by name (rethink §3.6). The
 * first cut of T47 copied it instead: `.row`/`.body`/`.line`/`.meta`/`.when`
 * beside `crew.module.css`'s `.feedItem`/`.feedBody`/`.feedLine`/`.feedMeta`/
 * `.feedWhen`, two of them byte-identical, and two copies that would drift the
 * first time the row changed (review S5). This is that row, in one place, and
 * both screens import it.
 *
 * It is deliberately a **shell and nothing more**. It knows about a disc, a
 * sentence and a meta line; it knows nothing about crews, stickers, sports or
 * time, because the two screens fill those slots differently — a crew row opens
 * with a link to the rider's profile and a What's new row is a sentence about
 * the reader. Putting either screen's knowledge in here would make the next
 * screen that wants a feed row copy it again.
 *
 * A server component: neither caller needs it to be a client one, and the crew
 * screen is only a client component because of its forms.
 */

export function FeedList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`${styles.feed} ${className ?? ''}`.trim()}>{children}</div>;
}

export function FeedLine({
  /** 32px: an `Avatar`, or a coloured disc with an icon in it. */
  disc,
  /** The sentence. A frame the product wrote, never text a rider typed (§6.1). */
  children,
  /** The `.lab` row under it — a time, a source, a sport chip, a tag. */
  meta,
}: {
  disc: ReactNode;
  children: ReactNode;
  meta: ReactNode;
}) {
  return (
    <div className={styles.row}>
      {disc}
      <div className={styles.body}>
        <p className={styles.line}>{children}</p>
        <div className={styles.meta}>{meta}</div>
      </div>
    </div>
  );
}

/** The class a caller puts on a rider's name inside a line, where it links. */
export const FEED_WHO = styles.who;

/** The class for a `.lab` in the meta row — 10px, `--ink-3`, wide tracking. */
export const FEED_META = styles.when;
