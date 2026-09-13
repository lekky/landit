import { Icon } from '@landit/ui-web';
import Link from 'next/link';

import { ROUTES } from '@/lib/routes';

import type { SessionsSidebarView } from './types';
import styles from './sessionsList.module.css';

/**
 * The desktop sidebar's four cards (1a): this month, the quota, where you ride
 * and the Legend insights teaser.
 *
 * **The insights card is a static teaser.** It computes nothing and reads
 * nothing about the rider: session insights are Legend's, and only for a rider
 * who turned them on (plan §6.4 standard 12). No profiling happens to draw it.
 *
 * The quota card is only drawn for a plan with a monthly cap; an unlimited
 * plan has nothing to count, so the card is absent rather than saying
 * "unlimited" at a rider who never asked.
 */
export function SessionsSidebar({ sidebar }: { sidebar: SessionsSidebarView }) {
  return (
    <aside className={styles.sidebar} aria-label="Your month">
      <section className={styles.monthCard}>
        <h2 className={styles.monthEyebrow}>{sidebar.monthName} so far</h2>
        <dl className={styles.stats}>
          <div>
            <dd className={styles.statN}>{sidebar.sessions}</dd>
            <dt className={styles.statL}>{sidebar.sessions === 1 ? 'session' : 'sessions'}</dt>
          </div>
          <div>
            <dd className={styles.statN}>{sidebar.time}</dd>
            <dt className={styles.statL}>on the board</dt>
          </div>
          <div>
            <dd className={styles.statN}>{sidebar.stageMoves}</dd>
            <dt className={styles.statL}>
              {sidebar.stageMoves === 1 ? 'stage move' : 'stage moves'}
            </dt>
          </div>
          <div>
            <dd className={styles.statN}>{sidebar.spotsRidden}</dd>
            <dt className={styles.statL}>
              {sidebar.spotsRidden === 1 ? 'spot ridden' : 'spots ridden'}
            </dt>
          </div>
        </dl>
        <p className={styles.streak}>
          <Icon name="flame" size={19} fill="var(--yellow)" strokeWidth={0} />
          <span className={styles.streakText}>
            Logging a session keeps the streak.{' '}
            <span className={styles.streakN}>{sidebar.streakLabel}.</span>
          </span>
        </p>
      </section>

      {sidebar.quota ? (
        <section className={styles.quotaCard}>
          <h2 className={styles.quotaHead}>
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 8v5M12 16.5v.2" />
              <circle cx="12" cy="12" r="9.2" />
            </svg>
            <span className={styles.quotaTitle}>{sidebar.quota.line}</span>
          </h2>
          <div className={styles.quotaPips} aria-hidden="true">
            {sidebar.quota.pips.map((pip, i) => (
              <i key={i} className={pip === 'used' ? styles.quotaPipUsed : styles.quotaPipFree} />
            ))}
          </div>
          <p className={styles.quotaCopy}>{sidebar.quota.copy}</p>
          <Link href={ROUTES.plans} className={styles.quotaLink}>
            See the plans →
          </Link>
        </section>
      ) : null}

      {sidebar.topSpots.length ? (
        <section className={styles.spotsCard}>
          <h2 className={styles.cardEyebrow}>Where you ride</h2>
          <ol className={styles.spotList}>
            {sidebar.topSpots.map((spot) => {
              const inner = (
                <>
                  <span className={styles.spotN}>{spot.count}</span>
                  <span className={styles.spotName}>{spot.name}</span>
                  <span className={styles.spotBar} style={{ width: spot.bar }} aria-hidden="true" />
                </>
              );
              return (
                <li key={spot.spotId}>
                  {spot.href ? (
                    <Link href={spot.href} className={styles.spotRow}>
                      {inner}
                    </Link>
                  ) : (
                    <span className={styles.spotRow}>{inner}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      <section className={styles.insights}>
        <h2 className={styles.insightsHead}>
          <Icon name="chart" size={17} />
          <span className={styles.insightsTitle}>Session insights</span>
        </h2>
        <p className={styles.insightsCopy}>
          Which day of the week you land most, how long a good session runs, the spots that move you
          up a stage. Legend only, and only if you turn it on.
        </p>
      </section>
    </aside>
  );
}
