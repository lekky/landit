'use client';

import { SPORTS, SPORT_IDS } from '@landit/core';
import { Empty, Panel, Pill, SectionHead, SportChip, Tag } from '@landit/ui-web';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';

import { useToast } from '@/providers/toast';

import { StaffEditor, type EditorValue } from '../StaffEditor';
import {
  createSpotAction,
  saveSpotAction,
  setSpotStatusAction,
  type SpotForm,
} from '../content-actions';
import type { AdminSpotRow, AdminSpotStatus } from '../view';

import styles from '../admin.module.css';

/**
 * The spot queue and the live map's contents.
 *
 * The prototype's "Remove" took a spot off the map by splicing it out of an
 * array. Here nothing is deleted: a spot moves between `pending`, `live` and
 * `rejected`, and taking one down is a move to `rejected` rather than a
 * destruction. That is not caution for its own sake — the row is the record
 * that a human looked at a stranger's submission and decided, which is the
 * evidence the review queue exists to produce, and a rejected row is also the
 * only thing that could ever tell its submitter what happened (issue #107).
 */

const SPORT_CHOICES = SPORT_IDS.map((id) => [id, SPORTS[id].label] as const);

const STATUS_LOOK: Readonly<Record<AdminSpotStatus, { label: string; color: string }>> = {
  pending: { label: 'Waiting', color: 'var(--yellow)' },
  live: { label: 'On the map', color: 'var(--green)' },
  rejected: { label: 'Rejected', color: 'var(--ink-3)' },
};

const BLANK_ADD = {
  name: '',
  town: '',
  type: 'Street spot',
  tags: '',
  lat: '',
  lng: '',
  sports: [...SPORT_IDS] as string[],
};

export function SpotsScreen({
  rows,
  types,
}: {
  rows: readonly AdminSpotRow[];
  types: readonly string[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<AdminSpotRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(BLANK_ADD);

  const waiting = rows.filter((r) => r.status === 'pending');
  const live = rows.filter((r) => r.status === 'live');
  const rejected = rows.filter((r) => r.status === 'rejected');

  const move = (row: AdminSpotRow, status: AdminSpotStatus, said: string) => {
    startTransition(async () => {
      const result = await setSpotStatusAction(row.id, status);
      if (result.ok) toast(`${row.name} ${said}`, STATUS_LOOK[status].color);
      else toast(result.message, 'var(--red)');
      router.refresh();
    });
  };

  const typeOptions = types.map((t) => [t, t] as const);

  const spotFrom = (value: EditorValue): SpotForm => ({
    name: String(value.name ?? ''),
    town: String(value.town ?? ''),
    type: String(value.type ?? ''),
    tags: String(value.tags ?? ''),
    lat: String(value.lat ?? ''),
    lng: String(value.lng ?? ''),
    sports: Array.isArray(value.sports) ? value.sports : [],
  });

  const onAdd = () => {
    startTransition(async () => {
      const result = await createSpotAction({ ...form, sports: form.sports });
      if (result.ok) {
        toast(`${form.name.trim()} is on the map`, 'var(--green)');
        setForm(BLANK_ADD);
        setAdding(false);
      } else {
        toast(result.message, 'var(--red)');
      }
      router.refresh();
    });
  };

  const spotLine = (row: AdminSpotRow) =>
    [row.town, row.type, row.submittedBy ? `sent ${row.submitted}` : 'added by staff']
      .filter(Boolean)
      .join(' · ');

  const spotRow = (row: AdminSpotRow, actions: ReactNode) => (
    <div key={row.id} className={`arow ${styles.tableRow}`}>
      <div className={styles.rowTitle}>
        <div className="cond" style={{ fontSize: 15.5 }}>
          {row.name}
        </div>
        <div className={styles.rowId}>{spotLine(row)}</div>
      </div>
      <div className={styles.chipRow}>
        {row.tags.map((tag) => (
          <Tag key={tag} color="var(--ink-3)" style={{ fontSize: 10, color: '#fff' }}>
            {tag}
          </Tag>
        ))}
        {row.sportLooks.map((sport) => (
          <SportChip key={sport.label} sport={sport} small />
        ))}
      </div>
      <div className={styles.rowActions}>{actions}</div>
    </div>
  );

  return (
    <div className={styles.stack}>
      <div>
        <SectionHead>Waiting for review</SectionHead>
        {waiting.length ? (
          <Panel className={`${styles.table} ${pending ? styles.busy : ''}`}>
            {waiting.map((row) =>
              spotRow(
                row,
                <>
                  <button
                    type="button"
                    className="btn sm ink"
                    disabled={pending}
                    onClick={() => move(row, 'live', 'is on the map')}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn sm ghost"
                    disabled={pending}
                    onClick={() => setEditing(row)}
                  >
                    Edit first
                  </button>
                  <button
                    type="button"
                    className="btn sm ghost"
                    disabled={pending}
                    onClick={() => move(row, 'rejected', 'rejected')}
                  >
                    Reject
                  </button>
                </>,
              ),
            )}
          </Panel>
        ) : (
          <Empty
            icon="map"
            title="Queue is clear"
            sub="Rider submissions land here before they go on the map."
          />
        )}
      </div>

      <div>
        <SectionHead>Live spots</SectionHead>
        {live.length ? (
          <Panel className={`${styles.table} ${pending ? styles.busy : ''}`}>
            {live.map((row) =>
              spotRow(
                row,
                <>
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
                    onClick={() => move(row, 'rejected', 'is off the map')}
                  >
                    Take down
                  </button>
                </>,
              ),
            )}
          </Panel>
        ) : (
          <Empty
            icon="map"
            title="No spots on the map"
            sub="Approve one from the queue, or add one below."
          />
        )}
      </div>

      {rejected.length > 0 && (
        <div>
          <SectionHead>Rejected</SectionHead>
          <Panel className={`${styles.table} ${pending ? styles.busy : ''}`}>
            {rejected.map((row) =>
              spotRow(
                row,
                <button
                  type="button"
                  className="btn sm ghost"
                  disabled={pending}
                  style={{ fontSize: 11, padding: '4px 9px' }}
                  onClick={() => move(row, 'pending', 'is back in the queue')}
                >
                  Back to the queue
                </button>,
              ),
            )}
          </Panel>
        </div>
      )}

      <div>
        <SectionHead>Add a spot yourself</SectionHead>
        {adding ? (
          <Panel flat className={styles.addPanel}>
            <div className="field">
              <label htmlFor="add-spot-name">Name</label>
              <input
                id="add-spot-name"
                value={form.name}
                placeholder="Rampworx"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="add-spot-town">Town</label>
              <input
                id="add-spot-town"
                value={form.town}
                placeholder="Liverpool"
                onChange={(e) => setForm({ ...form, town: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="add-spot-type">Type</label>
              <select
                id="add-spot-type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {typeOptions.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="add-spot-tags">Tags, comma separated</label>
              <input
                id="add-spot-tags"
                value={form.tags}
                placeholder="Bowl, Ledges"
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="add-spot-lat">Latitude</label>
              <input
                id="add-spot-lat"
                value={form.lat}
                placeholder="53.4695"
                onChange={(e) => setForm({ ...form, lat: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="add-spot-lng">Longitude</label>
              <input
                id="add-spot-lng"
                value={form.lng}
                placeholder="-2.9877"
                onChange={(e) => setForm({ ...form, lng: e.target.value })}
              />
              <span className={styles.fieldHint}>
                A spot with no coordinate pair cannot be drawn on the map.
              </span>
            </div>
            <div className={`field ${styles.wide}`}>
              <label htmlFor="add-spot-sports">Good for</label>
              <div className={styles.editorChoices} id="add-spot-sports">
                {SPORT_CHOICES.map(([id, label]) => (
                  <Pill
                    key={id}
                    on={form.sports.includes(id)}
                    onClick={() =>
                      setForm({
                        ...form,
                        sports: form.sports.includes(id)
                          ? form.sports.filter((x) => x !== id)
                          : [...form.sports, id],
                      })
                    }
                  >
                    {label}
                  </Pill>
                ))}
              </div>
            </div>
            <div className={styles.wide} style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setAdding(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                disabled={pending || !form.name.trim()}
                style={{ marginLeft: 'auto' }}
                onClick={onAdd}
              >
                Publish spot
              </button>
            </div>
          </Panel>
        ) : (
          <button type="button" className="btn sm" onClick={() => setAdding(true)}>
            + Add a spot
          </button>
        )}
      </div>

      <p className={styles.footnote}>
        A rider&rsquo;s submission is invisible to everyone but them until it is approved. Taking a
        spot down marks it rejected rather than deleting it, so the queue keeps the record that
        somebody looked at it. A spot you add yourself goes straight on the map — you are the human
        the queue exists to put in the way.
      </p>

      {editing && (
        <StaffEditor
          key={editing.id}
          title={`Edit ${editing.name}`}
          value={{
            name: editing.name,
            town: editing.town,
            type: editing.type || 'Street spot',
            tags: editing.tags.join(', '),
            lat: String(editing.lat ?? ''),
            lng: String(editing.lng ?? ''),
            sports: [...editing.sports],
          }}
          fields={[
            { k: 'name', label: 'Name', wide: true },
            { k: 'town', label: 'Town' },
            { k: 'type', label: 'Type', type: 'select', options: typeOptions },
            { k: 'lat', label: 'Latitude' },
            { k: 'lng', label: 'Longitude' },
            { k: 'tags', label: 'Tags, comma separated', wide: true, placeholder: 'Bowl, Ledges' },
            { k: 'sports', label: 'Good for', type: 'sports', choices: SPORT_CHOICES, wide: true },
          ]}
          onSave={async (value) => {
            const result = await saveSpotAction(editing.id, spotFrom(value));
            if (result.ok) {
              toast(`${String(value.name)} updated`);
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
