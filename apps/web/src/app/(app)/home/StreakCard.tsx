'use client';

import { Icon } from '@landit/ui-web';
import { useState, useTransition } from 'react';

import { useToast } from '@/providers/toast';

import { LogSessionLink } from '@/components/sessions/blocks/LogSessionLink';
import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { runActionOr } from '@/lib/runAction';
import { newSessionHref } from '@/lib/sessionRoutes';

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
 *
 * **"Log a session" leads the card, and "I rode today" sits under it**
 * (Rachid, 2026-09-14, in chat, answering the opening brief). Home was the one
 * screen with no way into the session logger — the Progress tab has one, and so
 * do the spot, event and trick blocks — while being the screen every rider
 * lands on. Saving a session banks the weekly ride itself
 * (`SessionFormScreen` fires `ride_logged` when the ride was new), so the two
 * buttons are the same act at two levels of effort, and the owner chose the
 * fuller one to lead. The tap that asks for nothing is still here, one line
 * below, because a rider who cannot face a form on a wet Tuesday should still
 * be able to bank the week.
 *
 * **It renders only for a rider the preview is open to** (plan §7, T41): the
 * server answers `sessionsEnabledFor` in `page.tsx` and hands the answer down
 * as `view.sessionsEnabled`. For everybody else this card is exactly what it
 * was — one yellow "I rode today" — and screenshot 06 still describes it.
 *
 * The link is `LogSessionLink`, the same component the spot, event and trick
 * blocks use, so the press is counted the way theirs are: `session_log_opened`
 * with `source: 'home'` and nothing else on it. It opens the **quick log**
 * (`?quick=1`) — when, where, how it felt, three taps — because a button on the
 * dashboard should cost about what the button beneath it costs.
 */
export function StreakCard({
  streak,
  sessionsEnabled,
}: {
  streak: StreakView;
  sessionsEnabled: boolean;
}) {
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
      // Reports a refusal as `{ error }`, so the thrown case is built the same
      // way — see `runAction.ts` for what used to happen instead (nothing).
      const result = await runActionOr('ride_logged', rodeTodayAction, (error) => ({ error }));
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

      {sessionsEnabled && (
        <LogSessionLink
          href={newSessionHref({ quick: true })}
          source="home"
          className={`btn wide sm ${styles.logSession}`}
        >
          Log a session
        </LogSessionLink>
      )}

      {/*
        `aria-disabled` once the day is logged, not `disabled`: the design's
        confirmed state is a solid green button (screenshot 06 shows the yellow
        one; the prototype turns it green), and `.btn:disabled` drops it to 45%
        opacity, which reads as broken rather than done. The click is a no-op
        either way — `logRide` returns early and the server would refuse a second
        ride the same day regardless.

        Demoted to an outline once there is a session link above it, because two
        filled buttons on one small ink card are two primaries and neither reads
        as the answer. The done state keeps its meaning and loses its shout: a
        lime rule and a lime tick rather than a solid green fill.
      */}
      <button
        type="button"
        className={`btn wide sm${sessionsEnabled ? ` ${styles.rode}` : ''}`}
        onClick={logRide}
        disabled={pending}
        aria-disabled={done || undefined}
        data-done={done || undefined}
        style={
          sessionsEnabled
            ? done
              ? { cursor: 'default' }
              : undefined
            : {
                background: done ? 'var(--green)' : 'var(--yellow)',
                color: 'var(--ink)',
                ...(done ? { cursor: 'default' } : {}),
              }
        }
      >
        {done ? '✓ Rode today' : pending ? 'Logging…' : 'I rode today'}
      </button>
    </div>
  );
}
