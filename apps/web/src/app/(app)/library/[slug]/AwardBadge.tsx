import Image from 'next/image';

import styles from './trick.module.css';

/**
 * The trick's award, in the hero, with a mark laid over it for its state.
 *
 * Two rules from the trick-page pack, both of them the point of the thing:
 *
 * **The badge is never greyed out.** Not desaturated, not faded, not dimmed.
 * An unearned award is drawn in exactly the colour an earned one is, because
 * the colour is what a rider is being offered — a washed-out badge reads as a
 * page that failed to load, not as a thing left to go and get. State is
 * carried by a mark *over* the art instead: a red stamp reading LANDED when it
 * is held, a dashed NOT YET in the same place when it is not.
 *
 * **Earned is the server's answer.** `earnedLabel` comes from `rider_stickers`
 * and nothing here re-derives it from the rider's stage (plan §3, and T25's
 * reasoning when it first put this badge on the page). The award hook is the
 * only thing that can make that row, so a screen that decided for itself would
 * look right until the day it stamped a badge a child had not earned.
 *
 * No shield is drawn under the art. The pack specifies one in CSS — a yellow
 * clip-path with a striped slot, a nameplate and a star — because its badges
 * were placeholders awaiting artwork. T24 already printed that artwork: every
 * file under `/stickers/` *is* the shield with the trick's name lettered across
 * it and the star beneath. The slot takes the file, and the CSS carries only
 * the drop shadow and the mark.
 */
export function AwardBadge({
  name,
  img,
  earned,
}: {
  /** The award's name — every trick award repeats its trick's. */
  name: string;
  /** The printed art's file name under `/stickers/`. */
  img: string;
  earned: boolean;
}) {
  return (
    <div className={styles.badge}>
      <Image
        className={styles.badgeArt}
        src={`/stickers/${img}`}
        /*
         * The state is in the name, not only in the mark beside it: the stamp
         * is `aria-hidden` because it is the same fact drawn twice, and a
         * screen reader announcing "Tic Tac award, earned. LANDED." says it
         * once too often.
         */
        alt={`${name} award, ${earned ? 'earned' : 'not earned yet'}`}
        width={512}
        height={512}
        /* One badge, above the fold, and the largest image on the page. */
        priority
        sizes="132px"
      />
      <span className={earned ? styles.stamp : styles.pending} aria-hidden="true">
        {earned ? 'Landed' : 'Not yet'}
      </span>
    </div>
  );
}
