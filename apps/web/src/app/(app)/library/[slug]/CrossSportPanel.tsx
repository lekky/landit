import type { Trick } from '@landit/core';
import { Panel, SportChip } from '@landit/ui-web';

import { trickHref } from '@/lib/routes';
import { SPORT_LOOKS } from '@/lib/sports';

import { TrickLink } from './TrickLink';
import styles from './trick.module.css';

/**
 * "Same trick, other sports" (T32, the pack's section G): one row per sport
 * that has the same movement under another name — "On a [Skateboard] this is
 * the Ollie".
 *
 * Which tricks is `crossSportEquivalents` in `@landit/core`, read against the
 * live trick list so a hidden equivalent drops out rather than linking to
 * nothing; the rows come back in sport order and are drawn in it. The chip is
 * the top bar's `SportChip`, so a sport looks the same here as it does
 * everywhere else, and the link is `TrickLink` so a press counts as
 * `trick_link_followed` with `kind: 'cross-sport'` — the one group on this
 * page that leads *out* of the rider's sport, which is the question it is
 * there to answer.
 *
 * Nothing is drawn when a trick has no equivalent: the page wraps this in the
 * same condition, so an empty panel and an empty gap are both impossible.
 */
export function CrossSportPanel({
  trick,
  equivalents,
}: {
  trick: Trick;
  /** From `crossSportEquivalents`, in sport order. */
  equivalents: readonly Trick[];
}) {
  if (equivalents.length === 0) return null;

  return (
    <Panel flat className={styles.sidePanel}>
      <div className={`d ${styles.panelTitle}`} id="cross-sport-title">
        Same trick, other sports
      </div>
      <ul className={styles.crossSportList} aria-labelledby="cross-sport-title">
        {equivalents.map((other) => (
          <li key={other.id} className={`cond ${styles.crossSportRow}`}>
            <span>On a</span>
            <SportChip sport={SPORT_LOOKS[other.sport]} />
            <span>this is the</span>
            <TrickLink
              kind="cross-sport"
              from={trick.id}
              to={other.id}
              href={trickHref(other.id)}
              className={styles.crossSportLink}
            >
              {other.name}
            </TrickLink>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
