'use client';

import { sessionTimeLabel, type SessionMonthGroup, type RideSession } from '@landit/core';
import { FeelSwatch, Icon } from '@landit/ui-web';
import Link from 'next/link';

import { sparkHeight, trickCountLabel } from '@/lib/sessionList';

import type { SessionCardView } from './types';
import styles from './sessionsList.module.css';

export type MonthGroupView = SessionMonthGroup<RideSession> & {
  readonly views: readonly SessionCardView[];
};

/**
 * The phone list (2b): one card per month, newest first. A closed header shows
 * the month, a bar per session scaled to its length (lime where a trick moved
 * up), the count and the time, and a chevron. Each month opens on its own; this
 * month and last month start open.
 */
export function MonthAccordions({
  months,
  open,
  onToggle,
}: {
  months: readonly MonthGroupView[];
  open: ReadonlySet<string>;
  onToggle: (monthKey: string) => void;
}) {
  return (
    <div className={styles.months}>
      {months.map((month) => {
        const isOpen = open.has(month.monthKey);
        const panelId = `sessions-month-${month.monthKey}`;
        return (
          <section key={month.monthKey} className={styles.month}>
            <button
              type="button"
              className={`${styles.monthHead} ${isOpen ? styles.monthHeadOpen : ''}`}
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => onToggle(month.monthKey)}
            >
              <span className={styles.monthName}>{month.monthName}</span>
              <span className={styles.spark} aria-hidden="true">
                {month.views.map((s) => (
                  <i
                    key={s.id}
                    className={styles.sparkBar}
                    style={{
                      height: sparkHeight(s.session.durationMinutes),
                      background: s.moved ? 'var(--lime)' : 'var(--paper)',
                    }}
                  />
                ))}
              </span>
              <span className={styles.monthMeta}>
                {month.count} · {sessionTimeLabel(month.minutes)}
              </span>
              <Icon
                name="chevron"
                size={18}
                className={`${styles.monthChev} ${isOpen ? styles.monthChevOpen : ''}`}
              />
            </button>
            {isOpen ? (
              <div id={panelId} className={styles.monthRows}>
                {month.views.map((s) => {
                  const sub = [s.duration, s.event?.name, trickCountLabel(s.tricks.length)]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <Link key={s.id} href={s.viewHref} className={styles.mRow}>
                      <span className={styles.mDay}>{s.day}</span>
                      {s.feel ? (
                        <FeelSwatch feel={s.feel.id} color={s.feel.color} title={s.feel.label} />
                      ) : (
                        <span className={styles.mNoFeel} aria-hidden="true" />
                      )}
                      <span className={styles.mText}>
                        <span className={styles.mSpot}>{s.spot.name}</span>
                        <span className={styles.mSub}>{sub}</span>
                      </span>
                      {s.moved ? (
                        <span
                          className={styles.diamond}
                          role="img"
                          aria-label="A trick moved up"
                          title="A trick moved up"
                        />
                      ) : null}
                      <Icon name="chevron" size={14} className={styles.mChev} />
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}
      <p className={styles.monthNote}>
        Bars are session lengths. The green diamond means a trick moved up that day.
      </p>
    </div>
  );
}
