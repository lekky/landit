import {
  DEFAULT_TIMEZONE,
  sessionDurationLabel,
  sessionFeelColor,
  sessionFeelLabel,
  spotSessionSummary,
} from '@landit/core';
import { listSessionsAtSpotForOwner, listTricks } from '@landit/db';
import { FeelFace, Icon, softFill } from '@landit/ui-web';
import Link from 'next/link';
import { Suspense } from 'react';

import { sessionDateLabels, spotBlockBadge, trickChipLabel } from '@/lib/sessionDetail';
import { sessionHref, sessionsHref } from '@/lib/sessionRoutes';
import type { RiderSession } from '@/lib/session';

import { riderFor } from './rider';
import styles from './blocks.module.css';

/** How many of the rider's sessions at a spot the block lists before "All N →". */
const SHOWN = 4;

export interface SpotSessionsBlockProps {
  /** The spot's record id. */
  readonly spotId: string;
  /** The page's rider, when it has one: `null` signed out, omitted to look it up. */
  readonly session?: RiderSession | null;
}

/**
 * "Your sessions here" on a spot page (T39; design 1f desktop, 2d phone).
 *
 * **Only the signed-in rider's own sessions**, by the `…ForOwner` read with
 * their own id, and the block says so in a sentence: no other rider's sessions
 * show here and theirs do not show on anybody else's (the design's stance, and
 * §6.1's — the product stores a spot's location, never who is at it).
 *
 * **Nothing at all for a signed-out visitor, and no read.** Streamed behind its
 * own `Suspense`, so a signed-in rider's page never waits on it either; a read
 * that fails renders nothing rather than breaking a public page.
 */
export function SpotSessionsBlock(props: SpotSessionsBlockProps) {
  return (
    <Suspense fallback={null}>
      <SpotSessions {...props} />
    </Suspense>
  );
}

async function SpotSessions({ spotId, session }: SpotSessionsBlockProps) {
  const viewer = await riderFor(session);
  if (!viewer) return null;

  const { client, rider } = viewer;
  let data;
  try {
    const [sessions, tricks] = await Promise.all([
      listSessionsAtSpotForOwner(client, { userId: rider.id, spotId }),
      listTricks(client).catch(() => []),
    ]);
    data = { sessions, tricks };
  } catch {
    return null;
  }

  const summary = spotSessionSummary(data.sessions, spotId);
  const timezone = rider.timezone || DEFAULT_TIMEZONE;
  const trickName = new Map(data.tricks.map((t) => [t.id, t.name]));

  return (
    <section className={styles.spot} aria-labelledby="spot-sessions-title">
      <div className={styles.spotHead}>
        <div className={styles.spotTitleRow}>
          <h2 id="spot-sessions-title" className={styles.spotTitle}>
            Your sessions here
          </h2>
          {summary.count ? (
            <span className={styles.badge}>{spotBlockBadge(summary.count, summary.minutes)}</span>
          ) : null}
        </div>
        {/*
          "Log a session here" is **on the spot page's hero now** (T52, review
          finding 5), as "Log here", the third of the three actions §3.10 puts
          under the band.

          It is a move rather than a second door. Both rendered
          `newSessionHref({ spot })` through `LogSessionLink` with
          `source: 'spot'`, so a rider covered by the sessions preview met two
          identical controls about 600px apart on one page and
          `session_log_opened` could not tell them apart — the spec paragraph
          and the PR body both said "goes where it went before", and this is
          what makes that true. This block is rendered on the spot page and
          nowhere else, so nothing else loses a link; `EventSessionsBlock` keeps
          its own, because no event page hero offers one.
        */}
      </div>

      {summary.sessions.slice(0, SHOWN).map((s) => {
        const feel = s.feel;
        return (
          <Link key={s.id} href={sessionHref(s.id)} className={styles.spotRow}>
            <span className={styles.spotDate}>
              {sessionDateLabels(s.startedAt, timezone).dayMonthYear}
            </span>
            <span className={styles.spotDur}>{sessionDurationLabel(s.durationMinutes)}</span>
            {feel ? (
              // A tint: the face carries the feel's colour itself (2026-09-14).
              <span
                className={styles.feelChip}
                style={{ background: softFill(sessionFeelColor(feel)) }}
              >
                <FeelFace feel={feel} size={13} />
                {sessionFeelLabel(feel)}
              </span>
            ) : null}
            <span className={styles.chips}>
              {s.trickEntries.map((entry) => (
                <span
                  key={entry.trickId}
                  className={`${styles.chip}${entry.stageTo ? ` ${styles.chipMoved}` : ''}`}
                >
                  {trickChipLabel(trickName.get(entry.trickId) ?? 'A trick', entry)}
                </span>
              ))}
            </span>
            <span className={styles.rowChev} aria-hidden="true">
              <Icon name="arrow-right" size={15} strokeWidth={2.2} />
            </span>
          </Link>
        );
      })}

      <div className={styles.spotFoot}>
        <p className={styles.footNote}>
          This is your own log. No other rider&rsquo;s sessions show here, and yours do not show on
          theirs.
        </p>
        {summary.count > SHOWN ? (
          <Link className={styles.allLink} href={sessionsHref()}>
            All {summary.count} &rarr;
          </Link>
        ) : null}
      </div>
    </section>
  );
}
