import { STAGE, isLandedStage, type TrickHistory } from '@landit/core';
import { Panel } from '@landit/ui-web';

import { PagedPanel } from '@/components/panels/PagedPanel';

import { ClearHistoryButton } from './ClearHistory';
import styles from './trick.module.css';

/** Entries before the timeline pages. Six rows is about a phone's height. */
const PER_PAGE = 6;

/**
 * "Your history with this trick" (T31, section A): every stage the rider has
 * logged for it, **newest first**, as a vertical timeline.
 *
 * Newest first since 2026-09-13 (Rachid, in chat). It read oldest-first from
 * T31, which put the thing that just happened at the bottom of a growing list —
 * fine at three entries and wrong at twenty, and this panel only ever grows.
 * The order is reversed here rather than in `trickHistory`, which stays
 * oldest-first: "first landed" and the summary are both computed by walking
 * forwards, and a rule that has to reason about time should read in the
 * direction time runs.
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
export function HistoryPanel({
  history,
  clear,
}: {
  history: TrickHistory;
  /**
   * The reset, for a rider who is no longer tracking this trick.
   *
   * `null` whenever the band above is already carrying it — a rider on a stage
   * reaches the same thing through "Stop tracking", and two doors to one
   * destructive act on one screen is one too many. The page decides; this panel
   * only draws what it is handed, and `null` is the ordinary case.
   */
  clear?: { trickId: string; slug: string; count: number; holdsBadge: boolean } | null;
}) {
  return (
    <Panel flat className={`${styles.sidePanel} ${styles.history}`}>
      <div className={`d ${styles.panelTitle}`}>Your history with this trick</div>
      <div className={`cond ${styles.historySummary}`}>{history.summary}</div>

      {history.entries.length > 0 && (
        <PagedPanel
          panel="history"
          perPage={PER_PAGE}
          noun="entries"
          className={styles.timeline}
          pagerClassName={styles.timelinePager}
          rows={[...history.entries].reverse().map((entry) => {
            const stage = STAGE[entry.stage];
            const want = entry.stage === 'want';
            return (
              <div
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
              </div>
            );
          })}
        />
      )}

      {clear && (
        <div className={styles.historyFoot}>
          <ClearHistoryButton
            trickId={clear.trickId}
            slug={clear.slug}
            count={clear.count}
            holdsBadge={clear.holdsBadge}
          />
        </div>
      )}
    </Panel>
  );
}
