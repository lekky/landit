import {
  CATS,
  categoryLabel,
  isTrickLanded,
  isTrickLocked,
  type PlanId,
  type StageId,
  type Trick,
} from '@landit/core';
import { Difficulty, Icon, Tag } from '@landit/ui-web';

import { trickHref } from '@/lib/routes';

import { TrickLink } from './TrickLink';
import styles from './trick.module.css';

/**
 * "More like this" (T31, section F): up to four tricks from the same sport and
 * category within one difficulty step, as small cards across the full width
 * under the two columns.
 *
 * The cards are the design's, not `TrickCard`: a name, the category tag, the
 * small difficulty meter and a corner flash in the category colour, with no
 * stage footer and no sport chip — every card here is the same sport as the
 * page, and a footer per card would make four small cards into four big ones.
 * A locked one carries the padlock and a landed one the tick, which is the
 * vocabulary the road above uses for the same two states.
 *
 * Which four is `similarTricks` in `@landit/core`. Nothing is drawn when it
 * finds none: a shelf with one trick on it has no "more like this" to offer,
 * and a heading over an empty row would say otherwise.
 */
export function SimilarTricks({
  trick,
  tricks,
  byId,
  plan,
}: {
  trick: Trick;
  tricks: readonly Trick[];
  byId: Readonly<Record<string, StageId>>;
  plan: PlanId;
}) {
  if (tricks.length === 0) return null;

  return (
    <section className={styles.similar} aria-labelledby="similar-tricks">
      <div className={`d ${styles.panelTitle} ${styles.similarTitle}`} id="similar-tricks">
        More like this
      </div>
      <div className={styles.similarGrid}>
        {tricks.map((next) => {
          const category = CATS[next.cat];
          const locked = isTrickLocked(next, plan);
          const landed = isTrickLanded(byId, next.id);
          return (
            <TrickLink
              key={next.id}
              kind="similar"
              from={trick.id}
              to={next.id}
              href={trickHref(next.id)}
              className={`${styles.similarCard}${locked ? ` ${styles.similarCardLocked}` : ''}`}
            >
              <span className={styles.similarFlash} style={{ borderRightColor: category.color }} />
              <span className={`d ${styles.similarName}`}>
                {locked && (
                  <Icon name="lock" size={13} strokeWidth={2.8} className={styles.similarMark} />
                )}
                {landed && (
                  <Icon name="check" size={14} strokeWidth={3} className={styles.similarMark} />
                )}
                {next.name}
              </span>
              <span className={styles.similarMeta}>
                <Tag color={category.color} tilt>
                  {categoryLabel(next.cat, next.sport)}
                </Tag>
                <Difficulty value={next.diff} small />
              </span>
            </TrickLink>
          );
        })}
      </div>
    </section>
  );
}
