'use client';

import { planUnlocksPaidTricks, type PlanId } from '@landit/core';
import { Button, Icon, Panel, Tag } from '@landit/ui-web';

import type { SheetRowView } from '@/app/(app)/progress/view';

import styles from './progress.module.css';

/**
 * The printable sheets panel, and the sheet it prints.
 *
 * The prototype's button fires a toast saying the sheet went to the printer,
 * because there was no sheet. This one prints: the panel's button opens the
 * browser's print dialogue over a print-only layout of the rider's *own* list,
 * four tricks a page, with a tick box beside each — the A4 tracker the panel
 * has always described. A button that says it prints something should print
 * something.
 *
 * The free-plan state is the upsell the design specifies, minus its link:
 * `/plans` is T15's route and does not exist yet, so the call to action renders
 * as a label rather than a link that cannot compile (LESSONS §3a).
 */

export type PrintableSheetsProps = {
  readonly plan: PlanId;
  readonly sportLabel: string;
  readonly rows: readonly SheetRowView[];
  readonly landed: number;
  readonly total: number;
};

export function PrintableSheets({ plan, sportLabel, rows, landed, total }: PrintableSheetsProps) {
  // Sheets ride with the paid tiers, the same entitlement the paid tricks use,
  // read from the plan record rather than compared against a plan id.
  const included = planUnlocksPaidTricks(plan);

  return (
    <>
      <Panel
        className={styles.sheets}
        style={{ background: included ? 'var(--lime)' : 'var(--paper-2)' }}
      >
        <span className={styles.sheetsIcon}>
          <Icon name="print" size={23} strokeWidth={2.2} />
        </span>
        <div className={styles.sheetsBody}>
          <div className={`d ${styles.sheetsTitle}`}>Printable sheets</div>
          <p className={styles.sheetsLede}>
            {included
              ? 'Print your current list as A4 tracker sheets, four tricks a page.'
              : 'Shredder riders can print their own list as the original A4 tracker sheets.'}
          </p>
        </div>
        {included ? (
          <Button onClick={() => window.print()} disabled={rows.length === 0}>
            {rows.length ? 'Print my sheets' : 'Nothing to print yet'}
          </Button>
        ) : (
          <span className={`cond ${styles.muted}`} aria-disabled="true">
            Part of Shredder
          </span>
        )}
      </Panel>

      {included && rows.length > 0 && (
        <div className={styles.sheet} aria-hidden="true">
          <h2 className={`d ${styles.sheetHead}`}>Land The Trick — {sportLabel} tracker</h2>
          <p className={styles.sheetSub}>
            {landed} of {total} landed. Tick one off when it is yours.
          </p>
          {rows.map((row) => (
            <div key={row.id} className={styles.sheetRow}>
              <Tag color={row.color} style={{ fontSize: 11 }}>
                {row.label}
              </Tag>
              <span className={`d ${styles.sheetName}`}>{row.name}</span>
              <span className={`lab ${styles.muted}`}>{row.stage}</span>
              <span className={styles.sheetTick} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
