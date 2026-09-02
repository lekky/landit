'use client';

import { CATEGORY_IDS, CATS, SPORTS, SPORT_IDS, TIERS_LABEL, type SportId } from '@landit/core';
import { Difficulty, Icon, Panel, Pill, Tag } from '@landit/ui-web';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { useToast } from '@/providers/toast';

import { StaffEditor, type EditorValue } from '../StaffEditor';
import {
  createTrickAction,
  saveTrickAction,
  setTrickLiveAction,
  setTrickTierAction,
  type TrickForm,
} from '../content-actions';
import type { AdminTrickRow, TrickTier } from '../view';

import styles from '../admin.module.css';

/**
 * The trick library, as staff edit it.
 *
 * Three departures from the prototype, each because the database has a shape
 * `localStorage` did not:
 *
 * 1. **The plan chip has three states, not two.** `tricks.free_override` is a
 *    nullable select — free, paid, or empty meaning "inherit from the
 *    difficulty" — and that third state is the one the whole library ships in.
 *    A two-way toggle would have written an explicit value onto every trick it
 *    touched, quietly pinning tricks that were following the default and making
 *    a later change to `FREE_MAX_DIFF` a no-op on all of them. The chip cycles
 *    through all three and says which it is on.
 * 2. **"Remove" is a hide.** See `content-actions.ts` — deleting a trick
 *    cascades into every rider's `trick_progress` and `trick_log`.
 * 3. **Prerequisites are shown, not edited.** The graph has a same-sport
 *    invariant enforced in a hook and a shape (`trick_prereqs`) that is edges
 *    rather than a field, so editing it is a screen of its own rather than a
 *    column in this table.
 */

/** What each state of the tier chip looks like and what it means. */
const TIER_LOOK: Readonly<Record<TrickTier, { label: string; background: string; color: string }>> =
  {
    free: { label: 'Rookie', background: 'var(--lime)', color: 'var(--ink)' },
    paid: { label: 'Shredder', background: 'var(--violet)', color: 'var(--on-dark)' },
    inherit: { label: 'By difficulty', background: 'var(--paper-2)', color: 'var(--ink)' },
  };

/** Cycling order. Ends back at `inherit`, so nothing is a one-way door. */
const NEXT_TIER: Readonly<Record<TrickTier, TrickTier>> = {
  inherit: 'free',
  free: 'paid',
  paid: 'inherit',
};

const TIER_FIELD_OPTIONS = [
  ['', 'By difficulty (default)'],
  ['free', 'Included on Rookie'],
  ['paid', 'Shredder and up'],
] as const;

const CAT_OPTIONS = CATEGORY_IDS.map((id) => [id, CATS[id].label] as const);
const DIFF_OPTIONS = [1, 2, 3, 4, 5].map(
  (d) => [String(d), `${d} · ${TIERS_LABEL[d - 1]}`] as const,
);

const BLANK = {
  name: '',
  cat: 'flat',
  diff: '1',
  tier: '',
  about: '',
  tips: '',
};

export function TricksScreen({
  rows,
  defaultFreeTier,
}: {
  rows: readonly AdminTrickRow[];
  defaultFreeTier: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const [sport, setSport] = useState<SportId>(SPORT_IDS[0]);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState(BLANK);
  const [editing, setEditing] = useState<AdminTrickRow | null>(null);

  const needle = query.trim().toLowerCase();
  const list = rows.filter(
    (row) => row.sport === sport && (!needle || row.name.toLowerCase().includes(needle)),
  );

  const run = (work: () => Promise<{ ok: boolean; message?: string }>, done: string) => {
    startTransition(async () => {
      const result = await work();
      if (result.ok) toast(done);
      else toast(result.message ?? 'That did not save.', 'var(--red)');
      router.refresh();
    });
  };

  const onCycleTier = (row: AdminTrickRow) => {
    const next = NEXT_TIER[row.tier];
    run(
      () => setTrickTierAction(row.id, next === 'inherit' ? '' : next),
      `${row.name}: ${TIER_LOOK[next].label.toLowerCase()}`,
    );
  };

  const onToggleLive = (row: AdminTrickRow) => {
    if (
      row.isLive &&
      !confirm(
        `Take ${row.name} out of the library? Riders lose it from their lists — what they have logged against it is kept.`,
      )
    ) {
      return;
    }
    run(
      () => setTrickLiveAction(row.id, !row.isLive),
      row.isLive ? `${row.name} hidden` : `${row.name} back in the library`,
    );
  };

  const formFrom = (value: EditorValue, fallbackSport: SportId): TrickForm => ({
    name: String(value.name ?? ''),
    sport: fallbackSport,
    cat: String(value.cat ?? 'flat'),
    diff: Number(value.diff ?? 1),
    tier: (String(value.tier ?? '') || '') as TrickForm['tier'],
    about: String(value.about ?? ''),
    tips: String(value.tips ?? ''),
  });

  const onAdd = () => {
    startTransition(async () => {
      const result = await createTrickAction(formFrom(addForm, sport));
      if (result.ok) {
        toast(`${addForm.name.trim()} added to the library`, 'var(--lime)');
        setAddForm(BLANK);
        setAdding(false);
      } else {
        toast(result.message, 'var(--red)');
      }
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
        <div className="search" style={{ flex: 1, minWidth: 200, padding: '9px 12px' }}>
          <Icon name="search" size={17} strokeWidth={2.6} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a trick…"
            aria-label="Find a trick by name"
          />
        </div>
        <button type="button" className="btn sm" onClick={() => setAdding((v) => !v)}>
          {adding ? 'Cancel' : '+ Add trick'}
        </button>
      </div>

      {adding && (
        <Panel flat className={styles.addPanel}>
          <div className={`field ${styles.wide}`}>
            <label htmlFor="add-trick-name">Name</label>
            <input
              id="add-trick-name"
              value={addForm.name}
              placeholder="Nose Bonk"
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="add-trick-sport">Sport</label>
            <input
              id="add-trick-sport"
              value={SPORTS[sport].label}
              readOnly
              style={{ background: 'var(--wash)' }}
            />
          </div>
          <div className="field">
            <label htmlFor="add-trick-cat">Category</label>
            <select
              id="add-trick-cat"
              value={addForm.cat}
              onChange={(e) => setAddForm({ ...addForm, cat: e.target.value })}
            >
              {CAT_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="add-trick-diff">Difficulty</label>
            <select
              id="add-trick-diff"
              value={addForm.diff}
              onChange={(e) => setAddForm({ ...addForm, diff: e.target.value })}
            >
              {DIFF_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="add-trick-tier">Free plan</label>
            <select
              id="add-trick-tier"
              value={addForm.tier}
              onChange={(e) => setAddForm({ ...addForm, tier: e.target.value })}
            >
              {TIER_FIELD_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className={`field ${styles.wide}`}>
            <label htmlFor="add-trick-about">The lowdown</label>
            <textarea
              id="add-trick-about"
              rows={2}
              value={addForm.about}
              placeholder="What the trick actually is."
              onChange={(e) => setAddForm({ ...addForm, about: e.target.value })}
            />
          </div>
          <div className={`field ${styles.wide}`}>
            <label htmlFor="add-trick-tips">Tips</label>
            <textarea
              id="add-trick-tips"
              rows={2}
              value={addForm.tips}
              placeholder="How to get it."
              onChange={(e) => setAddForm({ ...addForm, tips: e.target.value })}
            />
          </div>
          <button
            type="button"
            className={`btn wide ${styles.wide}`}
            disabled={pending || !addForm.name.trim()}
            onClick={onAdd}
          >
            Publish to the library
          </button>
        </Panel>
      )}

      <Panel className={`${styles.table} ${pending ? styles.busy : ''}`}>
        <div className={`arow ${styles.tableHead}`}>
          <span className="lab">Trick</span>
          <span className="lab">Category</span>
          <span className="lab">Difficulty</span>
          <span className="lab">Builds on</span>
          <span className="lab">Free plan</span>
          <span className="lab">Actions</span>
        </div>

        {list.map((row) => (
          <div
            key={row.id}
            className={`arow ${styles.tableRow} ${row.isLive ? '' : styles.hiddenRow}`}
          >
            <div className={styles.rowTitle}>
              <div className="cond" style={{ fontSize: 15 }}>
                {row.name}
                {!row.isLive && ' · hidden'}
              </div>
              <div className={styles.rowId}>{row.slug}</div>
            </div>

            <span>
              <Tag color={row.catColor} style={{ fontSize: 10 }}>
                {row.catLabel}
              </Tag>
            </span>

            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Difficulty value={row.diff} small />
              <span className="lab" style={{ color: 'var(--ink-3)' }}>
                {row.tierLabel}
              </span>
            </span>

            <span className="cond" style={{ fontSize: 13, color: 'var(--ink-2)' }}>
              {row.buildsOn}
            </span>

            <button
              type="button"
              className="pill"
              disabled={pending}
              title={
                row.tier === 'inherit'
                  ? `Following the default: ${row.effectivelyFree ? 'free' : 'paid'} at difficulty ${row.diff}`
                  : 'Set explicitly by staff'
              }
              onClick={() => onCycleTier(row)}
              style={{
                fontSize: 11.5,
                padding: '5px 10px',
                background: TIER_LOOK[row.tier].background,
                color: TIER_LOOK[row.tier].color,
              }}
            >
              {TIER_LOOK[row.tier].label}
              {row.tier === 'inherit' && ` · ${row.effectivelyFree ? 'Rookie' : 'Shredder'}`}
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
              <button
                type="button"
                className="btn sm"
                disabled={pending}
                style={{
                  fontSize: 11,
                  padding: '4px 9px',
                  background: row.isLive ? 'var(--red)' : 'var(--green)',
                }}
                onClick={() => onToggleLive(row)}
              >
                {row.isLive ? 'Remove' : 'Restore'}
              </button>
            </div>
          </div>
        ))}

        {!list.length && <div className={styles.noRows}>No tricks match that.</div>}
      </Panel>

      <p className={styles.footnote}>
        Tapping a plan chip cycles a trick between the free tier, the paid tier and following its
        difficulty — by default anything above {defaultFreeTier} is paid. Removing a trick takes it
        out of every rider&rsquo;s library; what they logged against it is kept, so putting it back
        restores their progress with it.
      </p>

      {editing && (
        <StaffEditor
          key={editing.id}
          title={`Edit ${editing.name}`}
          value={{
            name: editing.name,
            cat: editing.cat,
            diff: String(editing.diff),
            tier: editing.tier === 'inherit' ? '' : editing.tier,
            about: editing.about,
            tips: editing.tips,
          }}
          fields={[
            { k: 'name', label: 'Name', wide: true },
            { k: 'cat', label: 'Category', type: 'select', options: CAT_OPTIONS },
            { k: 'diff', label: 'Difficulty', type: 'select', options: DIFF_OPTIONS },
            {
              k: 'tier',
              label: 'Free plan',
              type: 'select',
              options: TIER_FIELD_OPTIONS,
              hint: 'The default follows the difficulty. Either explicit value overrides it.',
            },
            { k: 'about', label: 'The lowdown', type: 'text', rows: 3, wide: true },
            { k: 'tips', label: 'Tips', type: 'text', rows: 3, wide: true },
          ]}
          onSave={async (value) => {
            const result = await saveTrickAction(
              editing.id,
              formFrom(value, editing.sport as SportId),
            );
            if (result.ok) {
              toast(`${String(value.name)} updated`, 'var(--lime)');
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
