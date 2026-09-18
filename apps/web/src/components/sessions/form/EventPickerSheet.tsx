'use client';

import { Modal } from '@landit/ui-web';

import styles from './form.module.css';
import type { FormEvent } from './types';

/**
 * "Were you at an event?" — the picker under Where (issue raised by the owner,
 * 2026-09-18, in chat: "no way to log a session at an event").
 *
 * Until now an event only reached a session by being offered: either the rider
 * arrived from that event's page on its own day, or their spot happened to sit
 * within 1 km of the event's pin (`eventsAtSpotToday`). A jam in a car park the
 * map does not have, or one written up the next morning, could not be named at
 * all. This is the press that asks the question outright.
 *
 * It lists **one day's events** — the day the session is set to, not today —
 * because that is the only thing a session could have been at, and a day's
 * worth is short enough to read rather than search. Nearest to the chosen spot
 * first where there is one; both points are ours, a spot's and an event's,
 * never the rider's.
 */
export function EventPickerSheet(props: {
  /** The day's events, already ordered by `eventsOnDay`. */
  events: readonly FormEvent[];
  /** "Saturday 13 September" — the day being asked about, formatted upstream. */
  dayLabel: string;
  onPick: (event: FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <Modal onClose={props.onClose} width={520} title="Were you at an event?">
      <div className={styles.sheet}>
        <p className={styles.hint}>What was on, {props.dayLabel}.</p>
        <div className={styles.sheetList}>
          {props.events.length ? (
            props.events.map((e) => (
              <button
                key={e.id}
                type="button"
                className={styles.sheetRow}
                onClick={() => props.onPick(e)}
              >
                <span className={styles.quickSpotName}>{e.name}</span>
                <span className={styles.spotSub}>
                  {[e.venue, e.town].filter(Boolean).join(' · ') || 'On our calendar'}
                </span>
              </button>
            ))
          ) : (
            /*
              No link out to the calendar: leaving the form here would cost the
              rider everything they have typed into it.
            */
            <p className={styles.hint}>
              Nothing on our calendar that day. You can still log the session — it just will not be
              tied to an event.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
