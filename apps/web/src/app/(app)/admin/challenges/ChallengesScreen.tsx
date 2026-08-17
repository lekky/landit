'use client';

import { SPORTS, SPORT_IDS, type SportId } from '@landit/core';
import { Panel, Pill, Tag } from '@landit/ui-web';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { useToast } from '@/providers/toast';

import { StaffEditor, type EditorValue } from '../StaffEditor';
import {
  challengeLogCountAction,
  createChallengeAction,
  deleteChallengeAction,
  saveChallengeAction,
  type ChallengeForm,
} from '../content-actions';
import type { AdminChallengeRow, AdminChallengeState } from '../view';

import styles from '../admin.module.css';

/**
 * The weekly challenge schedule (`landit-admin.jsx`, `AdminChallenges`).
 *
 * Two things the prototype could not do, both because it had no server:
 *
 * - **A save can be refused.** "One live challenge per sport" is enforced in a
 *   PocketBase model hook, so scheduling a week that overlaps another is turned
 *   back wherever the write comes from — and the hook's message names the week
 *   it clashes with. `StaffEditor` shows it and keeps the form open.
 * - **Delete counts what it destroys first.** `challenge_log` cascades, so
 *   deleting a week takes every rider entry logged against it. The confirm asks
 *   the server how many that is before it asks the question, because "riders
 *   lose any progress logged against it" means nothing without a number.
 */

const STATE_LOOK: Readonly<Record<AdminChallengeState, { label: string; color: string }>> = {
  live: { label: 'Live', color: 'var(--green)' },
  upcoming: { label: 'Scheduled', color: 'var(--sky)' },
  past: { label: 'Finished', color: 'var(--ink-3)' },
};

const STATE_FILTERS = [
  ['all', 'All weeks'],
  ['live', 'Live'],
  ['upcoming', 'Scheduled'],
  ['past', 'Finished'],
] as const;

const GOAL_OPTIONS = [1, 2, 3, 4, 5].map(
  (n) => [String(n), `${n} logged trick${n === 1 ? '' : 's'}`] as const,
);

const HUES = [
  ['#3AC0FF', 'Sky'],
  ['#9CE05B', 'Lime'],
  ['#FFC23F', 'Yellow'],
  ['#FF3D78', 'Pink'],
  ['#8A3BE0', 'Violet'],
] as const;

const FIELDS = [
  { k: 'week', label: 'Label', placeholder: 'Week 36' },
  { k: 'title', label: 'Title', placeholder: 'Switch Week' },
  { k: 'starts', label: 'Starts', inputType: 'date' as const },
  { k: 'ends', label: 'Ends', inputType: 'date' as const },
  { k: 'goal', label: 'Target', type: 'select' as const, options: GOAL_OPTIONS },
  { k: 'verb', label: 'Button says', placeholder: 'Log a switch trick' },
  { k: 'reward', label: 'Reward', placeholder: 'Switch Hitter sticker' },
  { k: 'ridersCopy', label: 'Riders line', placeholder: 'Opens Monday' },
  { k: 'hue', label: 'Colour', type: 'colour' as const, choices: HUES, wide: true },
  { k: 'blurb', label: 'Brief', type: 'text' as const, rows: 3, wide: true },
];

const BLANK: EditorValue = {
  week: '',
  title: '',
  starts: '',
  ends: '',
  goal: '3',
  verb: 'Log a trick',
  reward: '',
  ridersCopy: 'Opens Monday',
  hue: '#3AC0FF',
  blurb: '',
};

export function ChallengesScreen({ rows }: { rows: readonly AdminChallengeRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const [sport, setSport] = useState<SportId>(SPORT_IDS[0]);
  const [state, setState] = useState<string>('all');
  const [editing, setEditing] = useState<AdminChallengeRow | null>(null);
  const [adding, setAdding] = useState(false);

  const forSport = rows.filter((r) => r.sport === sport);
  const list = forSport.filter((r) => state === 'all' || r.state === state);
  const featured =
    forSport.find((r) => r.state === 'live') ?? forSport.find((r) => r.state === 'upcoming');

  const challengeFrom = (value: EditorValue): ChallengeForm => ({
    week: String(value.week ?? ''),
    title: String(value.title ?? ''),
    blurb: String(value.blurb ?? ''),
    starts: String(value.starts ?? ''),
    ends: String(value.ends ?? ''),
    goal: Number(value.goal ?? 3),
    reward: String(value.reward ?? ''),
    hue: String(value.hue ?? '#3AC0FF'),
    ridersCopy: String(value.ridersCopy ?? ''),
    verb: String(value.verb ?? ''),
  });

  const valueOf = (row: AdminChallengeRow): EditorValue => ({
    week: row.week,
    title: row.title,
    starts: row.starts,
    ends: row.ends,
    goal: String(row.goal || 3),
    verb: row.verb,
    reward: row.reward,
    ridersCopy: row.ridersCopy,
    hue: row.hue,
    blurb: row.blurb,
  });

  const onDelete = (row: AdminChallengeRow) => {
    startTransition(async () => {
      // Asked of the server rather than trusted from the row: the table may have
      // been on screen a while, and a number that is stale in the one sentence
      // warning about data loss is worse than no number.
      const logged = await challengeLogCountAction(row.id);
      const warning = logged
        ? `Delete ${row.week || row.title}? ${logged} rider ${logged === 1 ? 'entry' : 'entries'} logged against it will go with it, and that cannot be undone.`
        : `Delete ${row.week || row.title}? Nothing has been logged against it yet.`;
      if (!confirm(warning)) return;

      const result = await deleteChallengeAction(row.id);
      if (result.ok) toast(`${row.title} deleted`, 'var(--red)');
      else toast(result.message, 'var(--red)');
      router.refresh();
    });
  };

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        {SPORT_IDS.map((id) => (
          <Pill key={id} on={sport === id} onClick={() => setSport(id)}>
            {SPORTS[id].label} · {rows.filter((r) => r.sport === id).length}
          </Pill>
        ))}
        <span className={styles.toolbarSplit} />
        {STATE_FILTERS.map(([k, label]) => (
          <Pill key={k} on={state === k} onClick={() => setState(k)}>
            {label}
            {k !== 'all' ? ` · ${forSport.filter((r) => r.state === k).length}` : ''}
          </Pill>
        ))}
        <button
          type="button"
          className={`btn sm ${styles.toolbarEnd}`}
          onClick={() => setAdding(true)}
        >
          + Schedule a week
        </button>
      </div>

      {featured && (
        <Panel style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              background: featured.hue,
              padding: '16px 18px',
              borderBottom: '3px solid var(--ink)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <Tag color="var(--ink)">{featured.state === 'live' ? 'Live now' : 'Next up'}</Tag>
            <span className="d" style={{ fontSize: 22 }}>
              {[featured.week, featured.title].filter(Boolean).join(' · ')}
            </span>
            <span className="lab" style={{ marginLeft: 'auto', color: 'var(--ink)' }}>
              {featured.range}
            </span>
          </div>
          <div
            style={{
              padding: '14px 18px',
              display: 'flex',
              gap: 18,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <p style={{ margin: 0, fontSize: 14.5, color: 'var(--ink-2)', flex: 1, minWidth: 220 }}>
              {featured.blurb}
            </p>
            <span className="lab" style={{ color: 'var(--ink-3)' }}>
              Target {featured.goal} · {featured.reward || 'no reward set'}
            </span>
            <button type="button" className="btn sm ghost" onClick={() => setEditing(featured)}>
              Edit this week
            </button>
          </div>
        </Panel>
      )}

      <Panel className={`${styles.table} ${pending ? styles.busy : ''}`}>
        <div className={`arow ${styles.tableHead}`}>
          <span className="lab">Week</span>
          <span className="lab">Runs</span>
          <span className="lab">Target</span>
          <span className="lab">Reward</span>
          <span className="lab">State</span>
          <span className="lab">Actions</span>
        </div>

        {list.map((row) => (
          <div key={row.id} className={`arow ${styles.tableRow}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span className={styles.rowStripe} style={{ background: row.hue }} />
              <div className={styles.rowTitle}>
                <div className="cond" style={{ fontSize: 15 }}>
                  {row.title}
                </div>
                <div className={styles.rowId}>
                  {row.week || row.slug}
                  {row.logged > 0 && ` · ${row.logged} logged`}
                </div>
              </div>
            </div>

            <span className="cond" style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>
              {row.range}
            </span>

            <span className="cond" style={{ fontSize: 14 }}>
              {row.goal} logged
            </span>

            <span className="cond" style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>
              {row.reward || '—'}
            </span>

            <span>
              <Tag color={STATE_LOOK[row.state].color} style={{ fontSize: 10 }}>
                {STATE_LOOK[row.state].label}
              </Tag>
            </span>

            <div className={styles.rowActions}>
              <button
                type="button"
                className="btn sm ghost"
                style={{ fontSize: 11, padding: '4px 9px' }}
                onClick={() => setEditing(row)}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn sm"
                disabled={pending}
                style={{ fontSize: 11, padding: '4px 9px', background: 'var(--red)' }}
                onClick={() => onDelete(row)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        {!list.length && <div className={styles.noRows}>No weeks match that filter.</div>}
      </Panel>

      <p className={styles.footnote}>
        Dates decide everything. A week goes live at midnight on its start date and closes at the
        end of its last day; riders see one live challenge per sport plus whatever is scheduled
        after it. Two weeks of the same sport cannot overlap — the server refuses it and says which
        week is in the way.
      </p>
      <p className={styles.footnote}>
        Delete is the one thing in this portal that destroys rider data: a week takes every entry
        logged against it. There is no hide, because whether a week is running is derived from its
        dates and a stored flag could only disagree with them.
      </p>

      {editing && (
        <StaffEditor
          key={editing.id}
          title={`Edit ${editing.week || editing.title}`}
          fields={FIELDS}
          value={valueOf(editing)}
          onSave={async (value) => {
            const result = await saveChallengeAction(editing.id, challengeFrom(value));
            if (result.ok) {
              toast(`${String(value.title)} updated`, String(value.hue));
              router.refresh();
            }
            return result;
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {adding && (
        <StaffEditor
          title={`Schedule a ${SPORTS[sport].label.toLowerCase()} week`}
          eyebrow="Staff add"
          saveLabel="Schedule week"
          fields={FIELDS}
          value={BLANK}
          onSave={async (value) => {
            const result = await createChallengeAction(sport, challengeFrom(value));
            if (result.ok) {
              toast('Week scheduled', String(value.hue));
              router.refresh();
            }
            return result;
          }}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}
