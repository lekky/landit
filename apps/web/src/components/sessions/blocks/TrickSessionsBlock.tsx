import { DEFAULT_TIMEZONE, stageMoveLabel, trickSessionSummary } from '@landit/core';
import { Icon } from '@landit/ui-web';
import Link from 'next/link';
import { Suspense } from 'react';

import { sessionDateLabels, trickBlockMeta } from '@/lib/sessionDetail';
import { sessionHref } from '@/lib/sessionRoutes';
import type { RiderSession } from '@/lib/session';

import { PagedPanel } from '@/components/panels/PagedPanel';

import { riderFor, spotNames, trickSessionsForOwner } from './rider';
import styles from './blocks.module.css';

/**
 * Rows a page. It used to be where the list simply stopped, with nothing saying
 * there was more (2026-09-13); it now pages, so a rider who has worked a trick
 * forty times can reach all forty without leaving the trick.
 */
const SHOWN = 6;

export interface TrickSessionsBlockProps {
  /** The trick's record id (not its slug). */
  readonly trickId: string;
  readonly trickName: string;
  /** The page's rider: `null` signed out, omitted to look it up. */
  readonly session?: RiderSession | null;
  /**
   * Draw the block's own "<Trick> in your sessions" head, with the count and
   * the day it was first tried. `true` by default, which is every caller that
   * had one before.
   *
   * The trick page passes `false` since T49: the block sits inside a disclosure
   * row whose heading *is* that sentence and whose sub-line carries the same
   * meta, so drawing it again would be the same fact twice, a line apart.
   */
  readonly heading?: boolean;
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

async function TrickSessions({
  trickId,
  trickName,
  session,
  heading = true,
}: TrickSessionsBlockProps) {
  const viewer = await riderFor(session);
  if (!viewer) return null;

  const { client, rider } = viewer;
  const timezone = rider.timezone || DEFAULT_TIMEZONE;
  let summary;
  try {
    // `trickSessionsForOwner` is `cache`d, so a host page that has already
    // counted these rows to decide whether to draw the block at all does not
    // pay for them twice (T49).
    summary = trickSessionSummary(
      await trickSessionsForOwner(client, rider.id, trickId),
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
    <section
      className={styles.trick}
      aria-labelledby={heading ? 'trick-sessions-title' : undefined}
      aria-label={heading ? undefined : `${trickName} in your sessions`}
    >
      {heading && (
        <div className={styles.trickHead}>
          <h2 id="trick-sessions-title" className={styles.trickTitle}>
            {trickName} in your sessions
          </h2>
          <span className={styles.trickMeta}>
            {trickBlockMeta(summary.count, summary.firstTriedOn)}
          </span>
        </div>
      )}
      <PagedPanel
        panel="sessions"
        perPage={SHOWN}
        noun="sessions"
        className={styles.list}
        rows={summary.sessions.map((s) => {
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
      />
    </section>
  );
}
