import {
  DEFAULT_TIMEZONE,
  eventSessions,
  sessionFeelLabel,
  type EventDateState,
} from '@landit/core';
import { listSessionsAtEventForOwner } from '@landit/db';
import { Icon } from '@landit/ui-web';
import Link from 'next/link';
import { Suspense } from 'react';

import { eventBlockState, loggedHereHeading, sessionDateLabels } from '@/lib/sessionDetail';
import { newSessionHref, sessionHref } from '@/lib/sessionRoutes';
import type { RiderSession } from '@/lib/session';

import { LogSessionLink } from './LogSessionLink';
import { riderFor, spotNames } from './rider';
import styles from './blocks.module.css';

export interface EventSessionsBlockProps {
  /** The event's record id. */
  readonly eventId: string;
  readonly eventName: string;
  /** The page's own date state (`view.state`), so the block and the band agree. */
  readonly state: EventDateState;
  /** "Saturday 26 September", as the page already formats it. */
  readonly dateLabel: string;
  /** The page's rider when it has one: `null` signed out, omitted to look it up. */
  readonly session?: RiderSession | null;
}

/**
 * The event page block (T39; design 1f, 2d), in two states.
 *
 * - **On the day**: "Riding it? Put it in your log." with the purple CTA,
 *   the event filled in.
 * - **Once it is over**: "You logged N sessions here", with the list — only
 *   when there is one (`eventBlockState`).
 *
 * **Only the rider's own sessions**, by `listSessionsAtEventForOwner` with
 * their own id. **Nothing and no read for a signed-out visitor**, streamed
 * behind its own `Suspense`, and silent on a failed read.
 *
 * **The CTA fills the event, not the spot.** The design's copy says "the spot
 * and the event fill themselves in", but an event here holds a town and a
 * venue name, not a spot record, so there is no spot id to pass. The copy says
 * what actually happens (flagged in the T39 plan entry).
 */
export function EventSessionsBlock(props: EventSessionsBlockProps) {
  return (
    <Suspense fallback={null}>
      <EventSessions {...props} />
    </Suspense>
  );
}

async function EventSessions({
  eventId,
  eventName,
  state,
  dateLabel,
  session,
}: EventSessionsBlockProps) {
  const viewer = await riderFor(session);
  if (!viewer) return null;

  const { client, rider } = viewer;
  let mine;
  try {
    mine = eventSessions(
      await listSessionsAtEventForOwner(client, { userId: rider.id, eventId }),
      eventId,
    );
  } catch {
    return null;
  }

  const which = eventBlockState(state, mine.length);
  if (!which) return null;

  if (which === 'live') {
    return (
      <section className={styles.event} aria-labelledby="event-sessions-title">
        <p className={styles.eyebrow}>{eventName} · on now</p>
        <h2 id="event-sessions-title" className={styles.eventTitle}>
          Riding it? Put it in your log.
        </h2>
        <p className={styles.eventCopy}>
          The event fills itself in. You add the spot and how it went.
        </p>
        <LogSessionLink
          href={newSessionHref({ event: eventId })}
          source="event"
          className={styles.purpleCta}
        >
          Log a session at this event
        </LogSessionLink>
      </section>
    );
  }

  const timezone = rider.timezone || DEFAULT_TIMEZONE;
  const names = await spotNames(
    client,
    mine.map((s) => s.spotId),
  );

  return (
    <section className={styles.event} aria-labelledby="event-sessions-title">
      <p className={styles.eyebrow}>
        {eventName} · {dateLabel}
      </p>
      <h2 id="event-sessions-title" className={styles.eventTitle}>
        {loggedHereHeading(mine.length)}
      </h2>
      <div className={styles.list}>
        {mine.map((s) => (
          <Link key={s.id} href={sessionHref(s.id)} className={styles.listRow}>
            <span className={styles.listDate}>
              {sessionDateLabels(s.startedAt, timezone).dayMonth}
            </span>
            <span className={styles.listLine}>
              {[names.get(s.spotId), sessionFeelLabel(s.feel).toLowerCase()]
                .filter(Boolean)
                .join(' · ')}
            </span>
            <span className={styles.rowChev} aria-hidden="true">
              <Icon name="arrow-right" size={15} strokeWidth={2.2} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
