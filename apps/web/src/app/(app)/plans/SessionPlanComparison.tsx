import { foregroundFor } from '@landit/ui-web';

import type { SessionPlanComparison as Comparison } from '@/lib/sessionPlanRows';

import styles from './plans.module.css';

const TITLE_ID = 'plans-sessions-title';

/**
 * "What each plan logs" (T40; screenshots 1g and 2e of the session-tracking
 * handoff): a table on desktop, three stacked cards on a phone. Both are in the
 * markup and CSS picks one at the handoff's 700px breakpoint, so nothing about
 * the layout is decided in the browser.
 *
 * Every word comes from `sessionPlanComparison` (`@/lib/sessionPlanRows`), and
 * the allowances in it from the plan records — see that module for why nothing
 * here is typed, and for the two places it departs from the design.
 */
export function SessionPlanComparison({ comparison }: { comparison: Comparison }) {
  const { columns, rows } = comparison;

  return (
    <section className={styles.sessions} aria-labelledby={TITLE_ID} data-sessions-comparison="">
      <div className={styles.sessionsHead}>
        <span className={styles.sessionsDiamond} aria-hidden="true" />
        <h2 id={TITLE_ID} className={`d ${styles.sessionsTitle}`}>
          What each plan logs
        </h2>
        <span className={styles.sessionsRule} aria-hidden="true" />
      </div>

      <div className={styles.sessionsTableWrap}>
        <table className={styles.sessionsTable}>
          <colgroup>
            <col className={styles.sessionsLabelCol} />
            {columns.map((column) => (
              <col key={column.slug} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <td className={styles.sessionsCorner} />
              {columns.map((column) => (
                <th
                  key={column.slug}
                  scope="col"
                  className={styles.sessionsPlanHead}
                  style={{
                    background: column.hue,
                    color: foregroundFor(column.hue) ?? 'var(--on-dark)',
                  }}
                >
                  <span className={`d ${styles.sessionsPlanName}`}>{column.name}</span>
                  <span className={`cond ${styles.sessionsPlanPrice}`}>{column.price}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={styles.sessionsRow} data-row={row.id}>
                <th scope="row" className={`cond ${styles.sessionsRowLabel}`}>
                  {row.label}
                </th>
                {row.cells.map((cell, i) => (
                  <td key={columns[i]!.slug} className={styles.sessionsCell} data-tone={cell.tone}>
                    {cell.text}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.sessionsCards}>
        {columns.map((column, i) => (
          <div key={column.slug} className={styles.sessionsCard} data-sessions-plan={column.slug}>
            <div
              className={styles.sessionsCardHead}
              style={{
                background: column.hue,
                color: foregroundFor(column.hue) ?? 'var(--on-dark)',
              }}
            >
              <h3 className={`d ${styles.sessionsPlanName}`}>{column.name}</h3>
              <span className={`cond ${styles.sessionsCardPrice}`}>{column.price}</span>
            </div>
            <dl className={styles.sessionsLines}>
              {rows.map((row) => (
                <div key={row.id} className={styles.sessionsLine}>
                  <dt className={`cond ${styles.sessionsLineLabel}`}>{row.phoneLabel}</dt>
                  <dd className={styles.sessionsLineValue} data-tone={row.cells[i]!.tone}>
                    {row.cells[i]!.phoneText}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {/*
        The design's closing line said "after the monthly four runs out". That
        is a number typed beside the one on the record, so it is said without
        one.
      */}
      <p className={styles.sessionsNote}>
        Nothing here sells a stage or a sticker. A session that moves a trick up moves it up on
        every plan — Rookie included, and after the monthly allowance runs out, because the ride and
        the stage are the achievement and the log is the record.
      </p>
    </section>
  );
}
