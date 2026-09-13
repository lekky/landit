'use client';

import { Empty, Panel, Tag } from '@landit/ui-web';
import { useState } from 'react';

import { Pager, useTableNav } from '../Pager';
import type { AdminVideoCheckRow } from '../view';

import styles from '../admin.module.css';

/**
 * The nightly tutorial check's history.
 *
 * **Read-only, and the only screen in the portal that is.** Every other tab is
 * somewhere staff change something; this one is a record of what a job did
 * while nobody was watching. A control here would be a second place to un-hide
 * a video, and the Trick library tab — where the link and the video actually
 * are — is the right one.
 *
 * A run that changed nothing still gets its row, saying "No changes" out loud.
 * That is the design: a page of quiet nights with a **gap** in the dates is how
 * a staff member sees the job stopped running, and a history that only recorded
 * changes could not show them that.
 *
 * The detail expands rather than sitting open, because the common row has
 * nothing under it. Rows that did something are the ones worth opening, and
 * they are the ones with a button.
 */
export function VideoChecksScreen({
  rows,
  page,
  totalPages,
  totalItems,
}: {
  rows: readonly AdminVideoCheckRow[];
  page: number;
  totalPages: number;
  totalItems: number;
}) {
  const { pending, goToPage } = useTableNav();
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <div className={styles.stack}>
      {rows.length ? (
        <Panel className={`${styles.table} ${pending ? styles.busy : ''}`}>
          <div className={`arow ${styles.tableHead} ${styles.cardHead} ${styles.checkRow}`}>
            <span className="lab">Ran</span>
            <span className="lab">Tutorials checked</span>
            <span className="lab">Result</span>
            <span className="lab">Detail</span>
          </div>

          {rows.map((row) => {
            const expanded = open[row.id] ?? false;
            const changed = row.changes.length > 0;

            return (
              <div key={row.id}>
                <div className={`arow ${styles.tableRow} ${styles.cardRow} ${styles.checkRow}`}>
                  <div className={styles.rowTitle}>
                    <div className="cond" style={{ fontSize: 15 }}>
                      {row.ran}
                    </div>
                  </div>

                  <span className="cond" style={{ fontSize: 13 }} data-label="Tutorials checked">
                    {row.checked}
                  </span>

                  <span data-label="Result">
                    {/*
                      A run that could not finish is the one thing on this page
                      that is wrong rather than merely uneventful, so it is the
                      only thing given the red.
                    */}
                    {row.note ? (
                      <Tag color="var(--red)" style={{ fontSize: 10 }}>
                        Did not finish
                      </Tag>
                    ) : changed ? (
                      <Tag color="var(--yellow)" style={{ fontSize: 10 }}>
                        {row.summary}
                      </Tag>
                    ) : (
                      <span className={styles.quiet}>No changes</span>
                    )}
                  </span>

                  <span data-label="Detail">
                    {changed ? (
                      <button
                        type="button"
                        className="btn sm ghost"
                        aria-expanded={expanded}
                        onClick={() => setOpen((prev) => ({ ...prev, [row.id]: !expanded }))}
                      >
                        {expanded ? 'Hide' : `Show ${row.changes.length}`}
                      </button>
                    ) : (
                      <span className={styles.quiet}>—</span>
                    )}
                  </span>
                </div>

                {row.note && <p className={styles.checkNote}>{row.note}</p>}

                {expanded && (
                  <ul className={styles.checkChanges}>
                    {row.changes.map((change) => (
                      <li key={`${row.id}-${change.slug}`} className={styles.checkChange}>
                        <Tag
                          color={change.action === 'off' ? 'var(--red)' : 'var(--green)'}
                          style={{ fontSize: 10 }}
                        >
                          {change.action === 'off' ? 'Switched off' : 'Back on'}
                        </Tag>
                        <span className="cond" style={{ fontSize: 14 }}>
                          {change.name}
                        </span>
                        <span className={styles.rowId}>{change.slug}</span>
                        {change.reason && <span className={styles.quiet}>{change.reason}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </Panel>
      ) : (
        <Empty
          icon="bolt"
          title="The check has not run yet"
          sub="Once the nightly job runs, every night it ran lands here — including the quiet ones, so a gap in the dates means it stopped."
        />
      )}

      <Pager
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        noun="run"
        nounPlural="runs"
        onPage={goToPage}
        busy={pending}
      />
    </div>
  );
}
