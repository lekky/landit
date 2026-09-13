import { DEFAULT_TIMEZONE, stageMoveLabel, trickSessionSummary } from '@landit/core';
import { listSessionsForTrickForOwner } from '@landit/db';
import { Icon } from '@landit/ui-web';
import Link from 'next/link';
import { Suspense } from 'react';

import { sessionDateLabels, trickBlockMeta } from '@/lib/sessionDetail';
import { sessionHref } from '@/lib/sessionRoutes';
import type { RiderSession } from '@/lib/session';

import { riderFor, spotNames } from './rider';
import styles from './blocks.module.css';

/** Rows before the list stops. The whole diary is one tap away on Progress. */
const SHOWN = 6;

export interface TrickSessionsBlockProps {
  /** The trick's record id (not its slug). */
  readonly trickId: string;
  readonly trickName: string;
  /** The page's rider: `null` signed out, omitted to look it up. */
  readonly session?: RiderSession | null;
}

/**
 * "<Trick> in your sessions" on a trick page (T39; design 1f, 2d): the count,
 * the first day it was tried, and the sessions that worked it with their stage
 * moves marked.
 *
 * **Only the rider's own sessions**, **nothing and no read signed out**, and
 * **nothing at all before the first session that worked it** — an empty
 * "Tailwhip in your sessions" would be a box explaining its own emptiness on a
 * page that is already long. No CTA, as the design draws it; if one is added
 * it fires `session_log_opened` with `source: 'trick'` through
 * `LogSessionLink`.
 */
export function TrickSessionsBlock(props: TrickSessionsBlockProps) {
  return (
    <Suspense fallback={null}>
      <TrickSessions {...props} />
    </Suspense>
  );
}

async function TrickSessions({ trickId, trickName, session }: TrickSessionsBlockProps) {
  const viewer = await riderFor(session);
  if (!viewer) return null;

  const { client, rider } = viewer;
  const timezone = rider.timezone || DEFAULT_TIMEZONE;
  let summary;
  try {
    summary = trickSessionSummary(
      await listSessionsForTrickForOwner(client, { userId: rider.id, trickId }),
      trickId,
      timezone,
    );
  } catch {
    return null;
  }
  if (!summary.count) return null;

  const names = await spotNames(
    client,
    summary.sessions.map((s) => s.spotId),
  );

  return (
    <section className={styles.trick} aria-labelledby="trick-sessions-title">
      <div className={styles.trickHead}>
        <h2 id="trick-sessions-title" className={styles.trickTitle}>
          {trickName} in your sessions
        </h2>
        <span className={styles.trickMeta}>
          {trickBlockMeta(summary.count, summary.firstTriedOn)}
        </span>
      </div>
      <div className={styles.list}>
        {summary.sessions.slice(0, SHOWN).map((s) => {
          const entry = s.trickEntries.find((e) => e.trickId === trickId);
          const move = entry ? stageMoveLabel(entry) : '';
          return (
            <Link key={s.id} href={sessionHref(s.id)} className={styles.listRow}>
              <span className={`${styles.listDate} ${styles.trickDate}`}>
                {sessionDateLabels(s.startedAt, timezone).dayMonth}
              </span>
              <span className={styles.trickSpot}>{names.get(s.spotId) ?? 'A spot'}</span>
              {move ? <span className={styles.moveChip}>{move}</span> : null}
              <span className={styles.rowChev} aria-hidden="true">
                <Icon name="arrow-right" size={15} strokeWidth={2.2} />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
