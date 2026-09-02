'use client';

import { Empty, Panel, Pill, Tag } from '@landit/ui-web';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

import { useToast } from '@/providers/toast';

import { setReportTriageAction } from '../content-actions';
import type { AdminReportRow, AdminReportStatus } from '../view';

import styles from '../admin.module.css';

/**
 * The reports queue.
 *
 * One card per report rather than a table row, because the interesting part of
 * a report is a paragraph somebody typed and a table row is the wrong shape for
 * a paragraph. The detail is boxed and `pre-wrap`, so it cannot be mistaken for
 * the product's own copy — the same instinct as the crew feed, which is written
 * by the product and never from anything a person typed (plan §6.1).
 *
 * **Triage changes the report, never the subject.** Marking something actioned
 * records that staff acted; suspending the account or taking the spot down is
 * done on the tab that owns it, by somebody who has looked. Wiring the two
 * together would put a stranger's accusation one click from a child's account.
 */

const STATUS_LOOK: Readonly<Record<AdminReportStatus, { label: string; color: string }>> = {
  open: { label: 'Open', color: 'var(--red)' },
  reviewing: { label: 'Reviewing', color: 'var(--yellow)' },
  actioned: { label: 'Actioned', color: 'var(--green)' },
  dismissed: { label: 'Dismissed', color: 'var(--ink-3)' },
};

const STATUSES: readonly AdminReportStatus[] = ['open', 'reviewing', 'actioned', 'dismissed'];

export function ModerationScreen({
  rows,
  counts,
  status,
  page,
  totalPages,
  totalItems,
}: {
  rows: readonly AdminReportRow[];
  counts: Readonly<Record<string, number>>;
  status: string;
  page: number;
  totalPages: number;
  totalItems: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  // Keyed by report id: a moderator can have a note half-typed on one card and
  // open another without the two sharing a box.
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});

  const go = (next: URLSearchParams) => {
    next.delete('page');
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  };

  const onFilter = (value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === 'all') next.delete('status');
    else next.set('status', value);
    go(next);
  };

  const goToPage = (n: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('page', String(n));
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  };

  const triage = (row: AdminReportRow, to: AdminReportStatus) => {
    startTransition(async () => {
      const outcome = outcomes[row.id] ?? row.outcome;
      const result = await setReportTriageAction(row.id, to, outcome);
      if (result.ok) toast(`Marked ${STATUS_LOOK[to].label.toLowerCase()}`, STATUS_LOOK[to].color);
      else toast(result.message, 'var(--red)');
      router.refresh();
    });
  };

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <Pill on={status === 'all'} onClick={() => onFilter('all')}>
          Everything
        </Pill>
        {STATUSES.map((s) => (
          <Pill key={s} on={status === s} onClick={() => onFilter(s)}>
            {STATUS_LOOK[s].label} · {counts[s] ?? 0}
          </Pill>
        ))}
      </div>

      {rows.length ? (
        <div className={styles.column}>
          {rows.map((row) => (
            <Panel key={row.id} className={`${styles.reportCard} ${pending ? styles.busy : ''}`}>
              <div className={styles.reportHead}>
                <Tag color={STATUS_LOOK[row.status].color}>{STATUS_LOOK[row.status].label}</Tag>
                <span className="cond" style={{ fontSize: 15 }}>
                  {row.reasonLabel}
                </span>
                <span className="lab" style={{ color: 'var(--ink-3)' }}>
                  {row.subjectType}
                  {row.subjectId ? ` · ${row.subjectId}` : ''}
                </span>
                {row.complaintOf && <Tag color="var(--violet)">Appeal</Tag>}
                <span className="lab" style={{ marginLeft: 'auto', color: 'var(--ink-3)' }}>
                  {row.filed}
                </span>
              </div>

              <div className={styles.reportBody}>
                {row.detail ? (
                  <p className={styles.reportDetail}>{row.detail}</p>
                ) : (
                  <p className={styles.quiet}>No detail was given.</p>
                )}

                <div className={styles.reportMeta}>
                  <span>
                    {row.reporterEmail
                      ? `Reply to ${row.reporterEmail}`
                      : row.fromRider
                        ? 'Filed by a signed-in rider'
                        : 'Filed anonymously, no reply address'}
                  </span>
                  {row.complaintOf && <span>Appeals report {row.complaintOf}</span>}
                  <span>Last touched {row.updated}</span>
                </div>

                <div className={styles.triage}>
                  <div className={`field ${styles.triageField}`}>
                    <label htmlFor={`outcome-${row.id}`}>What was decided</label>
                    <textarea
                      id={`outcome-${row.id}`}
                      rows={2}
                      value={outcomes[row.id] ?? row.outcome}
                      placeholder="What you looked at and what you did."
                      onChange={(e) =>
                        setOutcomes((prev) => ({ ...prev, [row.id]: e.target.value }))
                      }
                    />
                  </div>

                  {/*
                    "Mark …", not the bare status word. The filter row at the top
                    of the screen is four buttons carrying those same four words,
                    and a moderator scanning a long queue should never have to
                    work out which of two identically-labelled controls changes a
                    report and which changes what they are looking at. It was a
                    Playwright selector that noticed first, by clicking the wrong
                    one — which is exactly what a tired human would have done.
                  */}
                  <div className={styles.rowActions}>
                    {STATUSES.filter((s) => s !== row.status).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={s === 'actioned' ? 'btn sm ink' : 'btn sm ghost'}
                        disabled={pending}
                        onClick={() => triage(row, s)}
                      >
                        Mark {STATUS_LOOK[s].label.toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <Empty
          icon="flag"
          title={status === 'all' ? 'Nothing reported' : 'Nothing at that status'}
          sub="Reports from riders and from the public land here, newest first."
        />
      )}

      <div className={styles.tableFoot}>
        <span className="cond">
          {totalItems === 1 ? '1 report' : `${totalItems} reports`}
          {totalPages > 1 && ` · page ${page} of ${totalPages}`}
        </span>
        {totalPages > 1 && (
          <div className={styles.pager}>
            <button
              type="button"
              className="btn sm ghost"
              disabled={page <= 1 || pending}
              onClick={() => goToPage(page - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn sm ghost"
              disabled={page >= totalPages || pending}
              onClick={() => goToPage(page + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>

      <p className={styles.footnote}>
        Triage records what staff decided about the report. It does not touch what was reported —
        suspending an account is on the Riders tab and taking a spot down is on Spots, both by
        somebody who has looked. What you write here is kept as the decision, and is what an appeal
        is answered against.
      </p>
    </div>
  );
}
