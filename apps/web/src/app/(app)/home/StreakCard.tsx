'use client';

import { Icon } from '@landit/ui-web';
import { useState, useTransition } from 'react';

import { useToast } from '@/providers/toast';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

import { rodeTodayAction } from './actions';
import type { StreakView } from './view';

import styles from './home.module.css';

/**
 * The streak card, and the one design call T8 was given (plan §7, T8).
 *
 * The prototype draws seven cells labelled M T W T F S S and fills one per day
 * of a daily streak. The streak became a **weekly target** on 2026-08-16 (plan
 * §1), so those cells now count the wrong thing. What replaces them: **one cell
 * per ride the week needs**, filled as rides land.
 *
 * Why not a strip of weeks. The data model deliberately stores no calendar
 * (plan §3) — one counter and two day keys — so week cells could only be drawn
 * from the streak number printed directly above them, and would tell a rider
 * nothing they can act on. And §6.4, Standard 13 is explicit: "a rider is shown
 * the rides they have made this week, never the streak they are about to lose."
 * A rides-this-week strip is that sentence rendered.
 *
 * The card keeps its silhouette against screenshot 06: same ink panel, same
 * orange flame block, same Anton headline, same segmented row in the same slot,
 * same full-width button under it. Only the unit moved, which is the point.
 */
export function StreakCard({ streak }: { streak: StreakView }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState(streak);
  const { toast } = useToast();

  // Reset when the server sends a fresh view (a revalidate, or a sport switch
  // that re-rendered the page). Derived-from-props state, keyed by the headline.
  const [seen, setSeen] = useState(streak.headline);
  if (seen !== streak.headline) {
    setSeen(streak.headline);
    setState(streak);
  }

  const done = state.rodeToday;

  function logRide() {
    if (done || pending) return;
    startTransition(async () => {
      const result = await rodeTodayAction();
      if (result.error) {
        toast(result.error, 'var(--red)');
        return;
      }
      if (result.streak) setState(result.streak);
      if (result.logged) {
        // Only when the server says it actually logged: tapping twice in a day
        // is a no-op, and counting it would make the streak look busier than
        // riders are. The streak length is a number about riding, not a rider.
        capture(ANALYTICS_EVENTS.rideLogged, {
          rides_this_week:
            (result.streak?.cells.filter(Boolean).length ?? 0) + (result.streak?.spare ?? 0),
          week_banked: result.streak?.encouragement === 'This week is banked.',
        });
        toast(
          result.streak?.encouragement === 'This week is banked.'
            ? 'Ride logged. This week is banked.'
            : 'Ride logged. Nice one.',
          'var(--lime)',
        );
      }
    });
  }

  return (
    <div className={`panel ${styles.streak}`}>
      <div className={styles.streakHead}>
        <span className={styles.flame}>
          <Icon name="flame" size={24} fill="var(--paper)" />
        </span>
        <div>
          <div className={`d ${styles.streakNumber}`}>{state.headline}</div>
          <div className={`lab ${styles.streakLabel}`}>Riding streak</div>
        </div>
      </div>

      <div className={styles.week}>
        <div className={styles.weekCells} role="img" aria-label={state.progressLabel}>
          {state.cells.map((filled, i) => (
            <span key={i} className={styles.weekCell} data-filled={filled || undefined} />
          ))}
          {state.spare > 0 && <span className={`lab ${styles.spare}`}>+{state.spare}</span>}
        </div>
        <div className={`lab ${styles.weekLabel}`}>{state.progressLabel}</div>
        <p className={styles.encouragement}>{state.encouragement}</p>
      </div>

      {/*
        `aria-disabled` once the day is logged, not `disabled`: the design's
        confirmed state is a solid green button (screenshot 06 shows the yellow
        one; the prototype turns it green), and `.btn:disabled` drops it to 45%
        opacity, which reads as broken rather than done. The click is a no-op
        either way — `logRide` returns early and the server would refuse a second
        ride the same day regardless.
      */}
      <button
        type="button"
        className="btn wide sm"
        onClick={logRide}
        disabled={pending}
        aria-disabled={done || undefined}
        style={{
          background: done ? 'var(--green)' : 'var(--yellow)',
          color: 'var(--ink)',
          ...(done ? { cursor: 'default' } : {}),
        }}
      >
        {done ? '✓ Rode today' : pending ? 'Logging…' : 'I rode today'}
      </button>
    </div>
  );
}
