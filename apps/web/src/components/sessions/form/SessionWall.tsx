'use client';

import { sessionQuotaLine, sessionQuotaStatus } from '@landit/core';
import { Icon } from '@landit/ui-web';
import Link from 'next/link';

import { ROUTES } from '@/lib/routes';
import { sessionWallPips } from '@/lib/sessionForm';

import { CloseGlyph } from './FullForm';
import styles from './form.module.css';
import type { SessionFormData } from './types';

/**
 * The fifth-session wall (1g desktop, 2e phone), shown when the hook refused a
 * session with `quota` or `grace_used`.
 *
 * It says first what was **not** lost: the ride and the streak were saved
 * before the session was asked for (D6), because paid plans sell capacity and
 * never achievements. The price and the plan name come from the plan record,
 * never from this file. "Save this one anyway" is the once-per-account grace,
 * and is only offered when the server has not already said it is spent.
 */
export function SessionWall(props: {
  data: SessionFormData;
  grace: boolean;
  rideCounted: boolean;
  pending: boolean;
  errorLine: string | null;
  onGrace: () => void;
  onClose: () => void;
}) {
  const { data } = props;
  const cap = data.quota?.cap ?? null;
  const full =
    cap !== null
      ? sessionQuotaStatus(
          { cap, unlimited: false },
          { usedThisMonth: cap, graceUsed: !props.grace },
        )
      : null;
  const title = full ? sessionQuotaLine(full) : 'That is all your sessions this month';
  const pips = full ? sessionWallPips(full) : [];
  const upgrade = data.upgrade;

  return (
    <div className={styles.wall}>
      <span className={styles.grab} aria-hidden="true" />
      <div className={styles.wallHead}>
        <span className={styles.wallLock} aria-hidden="true">
          <Icon name="lock" size={21} />
        </span>
        <div className={styles.wallTitles}>
          <div className={styles.wallTitle}>{title}</div>
          <div className={styles.wallSub}>
            {data.planName} resets {data.resets.label} · {data.resets.daysAway} day
            {data.resets.daysAway === 1 ? '' : 's'}
          </div>
        </div>
        <button
          type="button"
          className={styles.quickClose}
          aria-label="Close"
          onClick={props.onClose}
        >
          <CloseGlyph />
        </button>
      </div>

      {pips.length ? (
        <div className={styles.pips} aria-hidden="true">
          {pips.map((p, i) => (
            <i
              key={i}
              className={`${styles.pip} ${p === 'refused' ? styles.pipRefused : p === 'used' ? styles.pipUsed : ''}`}
            />
          ))}
        </div>
      ) : null}

      <p className={styles.wallCopy}>
        {props.rideCounted
          ? 'You rode today, so the ride and the streak are already saved — that part is never behind a plan.'
          : 'Your streak is untouched — that part is never behind a plan.'}{' '}
        What needs {upgrade?.name ?? 'a paid plan'} is keeping the rest: the spot, the tricks, the
        clip and the notes.
      </p>

      {props.errorLine ? (
        <p className={styles.errorLine} role="alert">
          {props.errorLine}
        </p>
      ) : null}

      <div className={styles.wallActions}>
        <Link href={ROUTES.plans} className={`btn ${styles.wallUpgrade}`}>
          {upgrade ? `Go ${upgrade.name} · ${upgrade.price} a month` : 'See the plans'}
        </Link>
        {props.grace ? (
          <>
            <button
              type="button"
              className={`btn ghost ${styles.wallGrace}`}
              onClick={props.onGrace}
              disabled={props.pending}
            >
              {props.pending ? 'Saving…' : 'Save this one anyway'}
            </button>
            <span className={styles.wallOnce}>One-off · you get this once</span>
          </>
        ) : (
          <span className={styles.wallOnce}>You have used your one-off save</span>
        )}
      </div>
    </div>
  );
}
