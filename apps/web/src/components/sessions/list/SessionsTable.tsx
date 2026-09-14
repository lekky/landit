'use client';

import { Equipment, FeelFace, Icon, softFill } from '@landit/ui-web';
import Link from 'next/link';

import { Pager } from './Pager';
import type { SessionCardView } from './types';
import styles from './sessionsList.module.css';

type EquipmentName = Parameters<typeof Equipment>[0]['name'];

/** The three visibility glyphs at 14px, as the table's Media column draws them. */
const VIS_PATHS = {
  public:
    'M12 2.6a9.4 9.4 0 100 18.8 9.4 9.4 0 000-18.8M2.8 12h18.4M12 2.6c2.4 2.6 3.6 5.8 3.6 9.4s-1.2 6.8-3.6 9.4c-2.4-2.6-3.6-5.8-3.6-9.4s1.2-6.8 3.6-9.4',
  members:
    'M5.5 8a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0M2.5 20c1-3.6 3.4-5.2 6.5-5.2s5.5 1.6 6.5 5.2M16 5.2a3.5 3.5 0 0 1 0 6.6M18 20c-.4-2-1-3.4-2-4.4',
  private: 'M4.5 10.5h15v10h-15zM8 10.5V7a4 4 0 0 1 8 0v3.5',
} as const;

const HEAD = ['Date', 'Spot', 'Sport', 'Time', 'Tricks', 'Felt', 'Media', 'Actions'] as const;

/**
 * The desktop table (1b): eight columns at the handoff's exact template, a
 * black header, 2px rules, alternating paper rows, three 26px actions. It is
 * desktop only — the phone gets month accordions (2b), a decision the client
 * made over a sideways-scrolling table.
 */
export function SessionsTable({
  items,
  footLabel,
  page,
  totalPages,
  onPage,
  onDelete,
}: {
  items: readonly SessionCardView[];
  footLabel: string;
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  onDelete: (item: SessionCardView) => void;
}) {
  return (
    <>
      <div className={styles.table} role="table" aria-label="Your sessions">
        <div role="rowgroup">
          <div className={`${styles.tRow} ${styles.tHead}`} role="row">
            {HEAD.map((label) => (
              <div
                key={label}
                role="columnheader"
                className={label === 'Actions' ? styles.tHeadEnd : undefined}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
        <div role="rowgroup">
          {items.map((item) => (
            <div key={item.id} className={styles.tRow} role="row">
              <div role="cell" className={styles.tDate}>
                {item.dateLabel}
              </div>
              <div role="cell" className={styles.tSpot}>
                {item.spot.href ? (
                  <Link href={item.spot.href} className={styles.tSpotName}>
                    {item.spot.name}
                  </Link>
                ) : (
                  <span className={styles.tSpotName}>{item.spot.name}</span>
                )}
                {item.event ? (
                  <span
                    className={styles.eventSquare}
                    title={item.event.name}
                    role="img"
                    aria-label={`At ${item.event.name}`}
                  />
                ) : null}
              </div>
              <div role="cell" className={styles.tSport}>
                <Equipment name={item.sport.art as EquipmentName} size={16} title="" />
                {item.sport.label}
              </div>
              <div role="cell" className={styles.tDur}>
                {item.duration}
              </div>
              <div role="cell" className={styles.tTricks}>
                {item.tricks.map((trick) => (
                  <span
                    key={trick.key}
                    className={`${styles.tTrick} ${trick.move ? styles.tTrickMoved : ''}`}
                  >
                    {trick.move ? `${trick.name} ${trick.move}` : trick.name}
                  </span>
                ))}
              </div>
              <div role="cell" className={styles.tCell}>
                {/* A tint: the face carries the feel's colour itself. */}
                {item.feel ? (
                  <span className={styles.tFeel} style={{ background: softFill(item.feel.color) }}>
                    <FeelFace feel={item.feel.id} size={14} />
                    {item.feel.label}
                  </span>
                ) : null}
              </div>
              <div role="cell" className={styles.tMedia}>
                {item.clip ? (
                  <a
                    href={item.clip.href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    referrerPolicy="no-referrer"
                    className={styles.mediaSquare}
                    style={{ background: item.clip.color }}
                    title={item.clip.label}
                    aria-label={`Watch the clip on ${item.clip.label}`}
                  >
                    <svg viewBox="0 0 24 24" width="9" height="9" aria-hidden="true">
                      <path d="M7 4.5l12 7.5-12 7.5z" fill="#12100b" />
                    </svg>
                  </a>
                ) : null}
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  role="img"
                  aria-label={item.visibility.label}
                  className={styles.tVis}
                >
                  <title>{item.visibility.label}</title>
                  <path d={VIS_PATHS[item.visibility.id]} />
                </svg>
              </div>
              <div role="cell" className={styles.tActs}>
                <Link
                  href={item.viewHref}
                  className={styles.iconBtn}
                  title="View"
                  aria-label={`View the session at ${item.spot.name} on ${item.dateLabel}`}
                >
                  <Icon name="eye" size={14} />
                </Link>
                <Link
                  href={item.editHref}
                  className={styles.iconBtn}
                  title="Edit"
                  aria-label={`Edit the session at ${item.spot.name} on ${item.dateLabel}`}
                >
                  <Icon name="pencil" size={14} />
                </Link>
                <button
                  type="button"
                  className={`${styles.iconBtn} ${styles.iconDel}`}
                  title="Delete"
                  aria-label={`Delete the session at ${item.spot.name} on ${item.dateLabel}`}
                  onClick={() => onDelete(item)}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <Pager
          label={footLabel}
          page={page}
          totalPages={totalPages}
          onPage={onPage}
          className={styles.tFoot}
        />
      </div>
      <p className={styles.legend}>
        Purple square marks a session at an event. Trick chips are green where the session moved a
        stage.
      </p>
    </>
  );
}
