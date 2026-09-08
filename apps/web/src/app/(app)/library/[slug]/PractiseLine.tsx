import { categoryLabel, type CategoryId, type SportId } from '@landit/core';
import { Icon } from '@landit/ui-web';

import { practiseAdvice } from '@/lib/practise';
import { spotsHref } from '@/lib/routes';

import { TrickLink } from './TrickLink';
import styles from './trick.module.css';

/**
 * "Where to practise" (T31, section I): one line at the foot of the reading
 * column that says what ground this category's tricks want and links to the
 * spots list narrowed to that feature.
 *
 * The category-to-feature mapping is `practiseAdvice` in `lib/practise.ts`,
 * the inverse of the spot features' own `tricks` field; `hybrid` has no
 * honest answer and this renders nothing for it. The link is
 * `/spots?feature=<tag>`, which the spots screen reads on the server so the
 * narrowed list is the first thing painted.
 */
export function PractiseLine({
  slug,
  cat,
  sport,
}: {
  /** This trick's slug, for the analytics event's `from`. */
  slug: string;
  cat: CategoryId;
  sport: SportId;
}) {
  const advice = practiseAdvice(cat);
  if (!advice) return null;

  return (
    <div className={styles.practise}>
      <span className={styles.practiseIcon}>
        <Icon name="map" size={19} strokeWidth={2.2} />
      </span>
      <div className={styles.practiseText}>
        <div className={`lab ${styles.practiseLabel}`}>Where to practise</div>
        <p className={styles.practiseBody}>
          {categoryLabel(cat, sport)} tricks want {advice.want} —{' '}
          <TrickLink
            kind="practise"
            from={slug}
            to={advice.feature}
            href={spotsHref({ feature: advice.feature })}
            className={styles.practiseLink}
          >
            {advice.find} →
          </TrickLink>
        </p>
      </div>
    </div>
  );
}
