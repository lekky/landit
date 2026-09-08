import { STAGE, isLandedStage, type TrickHistory } from '@landit/core';
import { Panel } from '@landit/ui-web';

import styles from './trick.module.css';

/**
 * "Your history with this trick" (T31, section A): every stage the rider has
 * logged for it, oldest first, as a vertical timeline.
 *
 * Signed in only, and the page never renders it otherwise — there is no
 * "sign in to see your history" tease, because a visitor has none and the
 * band above already carries the one sign-in line the page needs.
 *
 * Every string arrives formatted: `trickHistory` in `@landit/core` builds the
 * dates from day keys and a word table and the summary from elapsed days, so
 * nothing here asks ICU anything (LESSONS §3a). The dots take the stage's own
 * colour from `STAGE`, which is the code's palette rather than the design's
 * (owner, 2026-09-07): Learning is `#FF9F1C` here, not yellow.
 */
export function HistoryPanel({ history }: { history: TrickHistory }) {
  return (
    <Panel flat className={`${styles.sidePanel} ${styles.history}`}>
      <div className={`d ${styles.panelTitle}`}>Your history with this trick</div>
      <div className={`cond ${styles.historySummary}`}>{history.summary}</div>

      {history.entries.length > 0 && (
        <ol className={styles.timeline}>
          {history.entries.map((entry) => {
            const stage = STAGE[entry.stage];
            const want = entry.stage === 'want';
            return (
              <li
                key={`${entry.at}-${entry.stage}`}
                className={`${styles.timelineRow}${isLandedStage(entry.stage) ? ` ${styles.timelineLanded}` : ''}`}
              >
                {/* A ring only for "Want to learn": the design's open dot for
                    the one stage that is a bookmark rather than a thing done. */}
                <span
                  className={`${styles.timelineDot}${want ? ` ${styles.timelineDotWant}` : ''}`}
                  style={want ? undefined : { background: stage.color }}
                />
                <span className={`cond ${styles.timelineDate}`}>{entry.dateLabel}</span>
                <span className={`cond ${styles.timelineStage}`}>{stage.label}</span>
                {(entry.firstLanded || entry.estimated) && (
                  <span className={`cond ${styles.timelineNote}`}>
                    {entry.firstLanded ? '★ first landed' : '(estimated)'}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
