'use client';

import { Empty, Panel, Pill, Tag } from '@landit/ui-web';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { useToast } from '@/providers/toast';
import { runAction } from '@/lib/runAction';

import { Pager, useTableNav } from '../Pager';
import { setSuggestionTriageAction } from '../content-actions';
import type { AdminSuggestionRow, AdminSuggestionStatus } from '../view';

import styles from '../admin.module.css';

/**
 * The ideas queue.
 *
 * The moderation screen's card, because a suggestion has the same shape as a
 * report — a paragraph somebody typed, and a decision about it — and a table
 * row is the wrong shape for a paragraph. The detail is boxed and `pre-wrap`
 * for the same reason it is there: so it cannot be mistaken for the product's
 * own copy.
 *
 * **The note is read back by the rider who sent the idea**, which is the one
 * way this differs from moderation's `outcome`. A moderator's outcome is
 * evidence for an appeal and is written for staff; this is written for a
 * fourteen year old who asked for something. The field label says so, because
 * a placeholder is not where a rule like that survives.
 */

const STATUS_LOOK: Readonly<Record<AdminSuggestionStatus, { label: string; color: string }>> = {
  new: { label: 'New', color: 'var(--sky)' },
  reviewing: { label: 'Reading', color: 'var(--yellow)' },
  accepted: { label: 'Taking it on', color: 'var(--green)' },
  declined: { label: 'Not for now', color: 'var(--ink-3)' },
};

const STATUSES: readonly AdminSuggestionStatus[] = ['new', 'reviewing', 'accepted', 'declined'];

export function SuggestionsScreen({
  rows,
  counts,
  status,
  page,
  totalPages,
  totalItems,
}: {
  rows: readonly AdminSuggestionRow[];
  counts: Readonly<Record<string, number>>;
  status: string;
  page: number;
  totalPages: number;
  totalItems: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { pending: navigating, params, setFilter, goToPage } = useTableNav();
  // Two transitions, as on Moderation: a slow triage should not disable the
  // pager, and vice versa — but both dim the same cards.
  const [saving, startTransition] = useTransition();
  const pending = navigating || saving;

  // Keyed by suggestion id: staff can have a note half-typed on one card and
  // open another without the two sharing a box.
  const [notes, setNotes] = useState<Record<string, string>>({});

  const onFilter = (value: string) => {
    const next = params();
    if (value === 'all') next.delete('status');
    else next.set('status', value);
    setFilter(next);
  };

  const triage = (row: AdminSuggestionRow, to: AdminSuggestionStatus) => {
    startTransition(async () => {
      const note = notes[row.id] ?? row.note;
      const result = await runAction('admin_save', () =>
        setSuggestionTriageAction(row.id, to, note),
      );
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
                  {row.topicLabel}
                </span>
                <span className="lab" style={{ marginLeft: 'auto', color: 'var(--ink-3)' }}>
                  {row.sent}
                </span>
              </div>

              <div className={styles.reportBody}>
                {row.detail ? (
                  <p className={styles.reportDetail}>{row.detail}</p>
                ) : (
                  <p className={styles.quiet}>Nothing was written.</p>
                )}

                <div className={styles.reportMeta}>
                  <span>Last touched {row.updated}</span>
                </div>

                <div className={styles.triage}>
                  <div className={`field ${styles.triageField}`}>
                    <label htmlFor={`note-${row.id}`}>
                      What we said back (the rider reads this)
                    </label>
                    <textarea
                      id={`note-${row.id}`}
                      rows={2}
                      value={notes[row.id] ?? row.note}
                      placeholder="Plain words. “Good shout, it is on the list” beats a status update."
                      onChange={(e) => setNotes((prev) => ({ ...prev, [row.id]: e.target.value }))}
                    />
                  </div>

                  {/*
                    "Mark …", not the bare status word — the same rule the
                    moderation queue learned the hard way. The filter row above
                    carries those four words as buttons, and staff scanning a
                    long queue should never have to work out which control
                    changes a record and which changes what they are looking at.
                  */}
                  <div className={styles.rowActions}>
                    {STATUSES.filter((s) => s !== row.status).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={s === 'accepted' ? 'btn sm ink' : 'btn sm ghost'}
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
          icon="bolt"
          title={status === 'all' ? 'No ideas yet' : 'Nothing at that status'}
          sub="What riders send from the library and the account menu lands here, newest first."
        />
      )}

      <Pager
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        noun="idea"
        nounPlural="ideas"
        onPage={goToPage}
        busy={pending}
      />

      <p className={styles.footnote}>
        This queue is not the moderation queue, and the two must not be merged. Reports are the
        Online Safety Act route with its own rate limit and its own one-working-day promise; if
        ideas shared that limit, a rider who sent a few suggestions could not then report something
        unsafe. Anything here that turns out to be a safeguarding matter belongs on Moderation — ask
        the rider to file it at /report rather than moving it by hand.
      </p>
    </div>
  );
}
