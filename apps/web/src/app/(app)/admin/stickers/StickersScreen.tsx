'use client';

import { Panel, SportChip, Tag } from '@landit/ui-web';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { useToast } from '@/providers/toast';

import { StaffEditor } from '../StaffEditor';
import { saveStickerAction, setStickerLiveAction } from '../content-actions';
import type { AdminStickerRow } from '../view';

import styles from '../admin.module.css';

/** The five hues the design pack uses for badges and banners. */
const HUES = [
  ['#FFC23F', 'Yellow'],
  ['#9CE05B', 'Lime'],
  ['#3AC0FF', 'Sky'],
  ['#FF3D78', 'Pink'],
  ['#8A3BE0', 'Violet'],
] as const;

/**
 * The sticker editor (`landit-admin.jsx`, `AdminStickers`).
 *
 * Two things on this screen are not in the prototype and both are the same
 * shape of honesty:
 *
 * - **A sticker with no rule says so.** The record is one half of an
 *   achievement; the condition is code. A row whose slug has no rule is a badge
 *   that will never be awarded to anybody, and the tab says that in the row
 *   rather than leaving it to be discovered by a rider who never gets it.
 * - **A threshold change is not retroactive.** The award hook runs on riding —
 *   a `trick_progress`, `clips`, `challenge_log` or `crew_members` write — so
 *   lowering a number gives the sticker to riders who already qualify the next
 *   time they track anything, not now (issue #103). The footnote says it, and
 *   the toast after an edit says it again, because "the change took effect for
 *   whoever rode this week" is a support ticket rather than a bug report.
 */
export function StickersScreen({ rows }: { rows: readonly AdminStickerRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<AdminStickerRow | null>(null);

  const onToggle = (row: AdminStickerRow) => {
    startTransition(async () => {
      const result = await setStickerLiveAction(row.id, !row.isLive);
      if (result.ok) toast(row.isLive ? `${row.name} hidden` : `${row.name} back on the wall`);
      else toast(result.message, 'var(--red)');
      router.refresh();
    });
  };

  return (
    <div className={styles.stack}>
      <Panel className={`${styles.table} ${pending ? styles.busy : ''}`}>
        <div className={`arow ${styles.tableHead}`}>
          <span className="lab">Sticker</span>
          <span className="lab">Sport</span>
          <span className="lab">Earned by</span>
          <span className="lab">Threshold</span>
          <span className="lab">Live</span>
          <span className="lab">Actions</span>
        </div>

        {rows.map((row) => (
          <div
            key={row.id}
            className={`arow ${styles.tableRow} ${row.isLive ? '' : styles.hiddenRow}`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: row.hue,
                  border: '2.5px solid var(--ink)',
                  flex: 'none',
                }}
              />
              <div className={styles.rowTitle}>
                <div className="cond" style={{ fontSize: 15 }}>
                  {row.name}
                </div>
                <div className={styles.rowId}>{row.slug}</div>
              </div>
            </div>

            <span>
              {row.sport ? (
                <SportChip sport={row.sport} small />
              ) : (
                <span className="lab" style={{ color: 'var(--ink-3)' }}>
                  Any
                </span>
              )}
            </span>

            <span className="cond" style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>
              {row.condition}
              {!row.hasRule && (
                <Tag color="var(--red)" style={{ fontSize: 10, marginLeft: 8, color: '#fff' }}>
                  No rule
                </Tag>
              )}
            </span>

            <span className="cond" style={{ fontSize: 14 }}>
              {row.threshold ?? 'Fixed rule'}
            </span>

            <button
              type="button"
              className="pill"
              disabled={pending}
              onClick={() => onToggle(row)}
              style={{
                fontSize: 11.5,
                padding: '5px 10px',
                background: row.isLive ? 'var(--lime)' : 'var(--ink-3)',
                color: row.isLive ? 'var(--ink)' : '#fff',
              }}
            >
              {row.isLive ? 'Live' : 'Hidden'}
            </button>

            <div className={styles.rowActions}>
              <button
                type="button"
                className="btn sm ghost"
                style={{ fontSize: 11, padding: '4px 9px' }}
                onClick={() => setEditing(row)}
              >
                Edit
              </button>
            </div>
          </div>
        ))}

        {!rows.length && <div className={styles.noRows}>No stickers yet.</div>}
      </Panel>

      <p className={styles.footnote}>
        Thresholds are editable where the rule counts something; the rest are tied to a specific
        trick and need a developer. A sticker marked <strong>no rule</strong> has a record and no
        condition behind it, so nobody can earn it however it is configured. Hiding a sticker stops
        it being awarded and takes it off the wall — the record of who already earned it is kept, so
        switching it back on returns it to them.
      </p>
      <p className={styles.footnote}>
        A threshold change is not retroactive: stickers are awarded when a rider logs something, so
        riders who already qualify get it the next time they track a trick, a clip or a challenge
        (issue #103).
      </p>

      {editing && (
        <StaffEditor
          key={editing.id}
          title={`Edit ${editing.name}`}
          value={{
            name: editing.name,
            cond: editing.cond,
            n: editing.threshold === null ? '' : String(editing.threshold),
            hue: editing.hue,
          }}
          fields={[
            { k: 'name', label: 'Name', wide: true },
            {
              k: 'cond',
              label: 'Earned by',
              wide: true,
              hint:
                editing.threshold === null
                  ? 'Reads on its own.'
                  : 'The threshold is printed in front of this, so write it to read after a number.',
            },
            ...(editing.threshold === null
              ? []
              : ([
                  {
                    k: 'n',
                    label: 'Threshold',
                    inputType: 'number' as const,
                    hint: 'Takes effect on each rider’s next logged trick, not immediately.',
                  },
                ] as const)),
            { k: 'hue', label: 'Colour', type: 'colour' as const, choices: HUES, wide: true },
          ]}
          onSave={async (value) => {
            const raw = String(value.n ?? '').trim();
            const result = await saveStickerAction(editing.id, {
              name: String(value.name ?? ''),
              cond: String(value.cond ?? ''),
              threshold: editing.threshold === null || raw === '' ? null : Number(raw),
              hue: String(value.hue ?? ''),
            });
            if (result.ok) {
              toast(`${String(value.name)} updated — riders see it on their next log`, editing.hue);
              router.refresh();
            }
            return result;
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
