'use client';

import { SPORTS, SPORT_IDS } from '@landit/core';
import { Empty, Icon, Panel, Pill, SectionHead, SportChip, Tag } from '@landit/ui-web';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';

import { useToast } from '@/providers/toast';
import { runAction } from '@/lib/runAction';

import { Pager, useTableNav } from '../Pager';
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
 *
 * **One paged table with a status filter, where there were three sections.**
 * The sections could not survive paging — three lists on one screen have no
 * single page number between them — and the collection outgrew them anyway
 * (see `page.tsx`). The filter pills carry the counts the headings used to
 * carry, which is the part that mattered: staff need to see there are twelve
 * spots waiting without first going to look.
 *
 * Row actions come off `row.status` rather than off which list the row was in.
 * That is the same three sets of buttons as before, decided per row, so a
 * mixed "Everything" page offers each spot exactly what its own status allows.
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
  /*
   * A spot staff add by hand starts outdoors and unverified, which is the
   * honest default rather than a convenient one: nobody has looked yet. Both
   * are set afterwards in the editor, where the two selects live.
   */
  indoor: false,
  operating: 'unknown',
};

/** The editor's yes/no pair for `indoor`, which has no boolean field type. */
const INDOOR_OPTIONS = [
  ['no', 'Outdoor, or not known'],
  ['yes', 'Indoor — under a roof'],
] as const;

/*
 * Deliberately worded as claims a human is making, not as bare states. A staff
 * member picking "Open" is asserting the park is there; the default says only
 * that nobody has checked, which is what almost every seeded row means.
 */
const OPERATING_OPTIONS = [
  ['unknown', 'Not checked'],
  ['open', 'Open — confirmed there'],
  ['closed', 'Closed — do not send riders'],
] as const;

/** The pills, in the order a spot travels through them. */
const STATUSES: readonly AdminSpotStatus[] = ['pending', 'live', 'rejected'];

export function SpotsScreen({
  rows,
  types,
  counts,
  query,
  status,
  page,
  totalPages,
  totalItems,
}: {
  rows: readonly AdminSpotRow[];
  types: readonly string[];
  counts: Readonly<Record<string, number>>;
  query: string;
  status: string;
  page: number;
  totalPages: number;
  totalItems: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { pending: navigating, params, setFilter, goToPage } = useTableNav();
  // Two transitions, deliberately: one is "the table is being re-fetched", the
  // other is "a spot is being moved". They dim the same rows, so the screen
  // reads from `pending`, but keeping them apart means a slow approval does not
  // disable the pager and a slow page does not disable Approve.
  const [saving, startSaving] = useTransition();
  const pending = navigating || saving;
  const [editing, setEditing] = useState<AdminSpotRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(BLANK_ADD);

  const [text, setText] = useState(query);

  // Re-synced only when the *server's* idea of the query changes under it — a
  // back button, a shared link — never on every render, which would fight the
  // person typing. Adjusted during render rather than in an effect, so there is
  // no flash of the stale value and no second commit (see `RidersScreen`).
  const [lastQuery, setLastQuery] = useState(query);
  if (lastQuery !== query) {
    setLastQuery(query);
    setText(query);
  }

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => (debounce.current ? clearTimeout(debounce.current) : undefined), []);

  const onSearch = (value: string) => {
    setText(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const next = params();
      if (value.trim()) next.set('q', value.trim());
      else next.delete('q');
      setFilter(next);
    }, 300);
  };

  const onStatusFilter = (value: string) => {
    const next = params();
    if (value === 'all') next.delete('status');
    else next.set('status', value);
    setFilter(next);
  };

  const move = (row: AdminSpotRow, to: AdminSpotStatus, said: string) => {
    startSaving(async () => {
      const result = await runAction('admin_save', () => setSpotStatusAction(row.id, to));
      if (result.ok) toast(`${row.name} ${said}`, STATUS_LOOK[to].color);
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
    // The editor has no boolean field type, so `indoor` round-trips as the
    // string the select holds and is narrowed back to a boolean here.
    indoor: String(value.indoor ?? 'no') === 'yes',
    operating: String(value.operating ?? 'unknown'),
  });

  const onAdd = () => {
    startSaving(async () => {
      const result = await runAction('admin_save', () =>
        createSpotAction({ ...form, sports: form.sports }),
      );
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

  /*
   * On a phone each spot is a card — name first, its buttons last and full
   * width — rather than a row that scrolls sideways (issue #371; "Tables on a
   * phone" in `admin.module.css`). There is no header to pin, and a queue whose
   * rows exist to be approved should not keep Approve off the edge of the screen.
   */
  const spotRow = (row: AdminSpotRow, actions: ReactNode) => (
    <div key={row.id} className={`arow ${styles.tableRow} ${styles.cardRow}`}>
      <div className={styles.rowTitle}>
        <div className="cond" style={{ fontSize: 15.5 }}>
          {row.name}
        </div>
        <div className={styles.rowId}>{spotLine(row)}</div>
      </div>
      {/*
        The status on the row, which it never needed when the section heading
        above it said so. "Everything" mixes all three, and a row whose buttons
        are the only clue to its state asks staff to read the buttons backwards
        to find out what they are looking at.
      */}
      <span>
        <Tag color={STATUS_LOOK[row.status].color} style={{ fontSize: 10 }}>
          {STATUS_LOOK[row.status].label}
        </Tag>
      </span>
      <div className={styles.chipRow}>
        {row.tags.map((tag) => (
          <Tag key={tag} color="var(--ink-3)" style={{ fontSize: 10 }}>
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

  /** What a row may do, decided by its own status rather than by its section. */
  const actionsFor = (row: AdminSpotRow): ReactNode => {
    if (row.status === 'pending') {
      return (
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
        </>
      );
    }

    if (row.status === 'live') {
      return (
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
        </>
      );
    }

    return (
      <button
        type="button"
        className="btn sm ghost"
        disabled={pending}
        style={{ fontSize: 11, padding: '4px 9px' }}
        onClick={() => move(row, 'pending', 'is back in the queue')}
      >
        Back to the queue
      </button>
    );
  };

  const emptyCopy =
    query || status !== 'all'
      ? { title: 'Nothing matches that', sub: 'Try another search, or a different status.' }
      : {
          title: 'No spots yet',
          sub: 'Rider submissions land here before they go on the map.',
        };

  return (
    <div className={styles.stack}>
      <div className={styles.filters}>
        <div className="search" style={{ flex: 1, minWidth: 220, padding: '9px 12px' }}>
          <Icon name="search" size={17} strokeWidth={2.6} />
          <input
            value={text}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Name or town…"
            aria-label="Search spots by name or town"
          />
        </div>
        <Pill on={status === 'all'} onClick={() => onStatusFilter('all')}>
          Everything
        </Pill>
        {STATUSES.map((s) => (
          <Pill key={s} on={status === s} onClick={() => onStatusFilter(s)}>
            {STATUS_LOOK[s].label} · {counts[s] ?? 0}
          </Pill>
        ))}
      </div>

      <div>
        {/* The heading names what is on screen, because the pills changed it.
            Three sections used to say so by being three sections. */}
        <SectionHead>
          {status === 'all' ? 'Every spot' : STATUS_LOOK[status as AdminSpotStatus].label}
        </SectionHead>
        {rows.length ? (
          <Panel className={`${styles.table} ${pending ? styles.busy : ''}`}>
            {rows.map((row) => spotRow(row, actionsFor(row)))}
          </Panel>
        ) : (
          <Empty icon="map" title={emptyCopy.title} sub={emptyCopy.sub} />
        )}
      </div>

      <Pager
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        noun="spot"
        nounPlural="spots"
        onPage={goToPage}
        busy={pending}
      />

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
            indoor: editing.indoor ? 'yes' : 'no',
            operating: editing.operating || 'unknown',
          }}
          fields={[
            { k: 'name', label: 'Name', wide: true },
            { k: 'town', label: 'Town' },
            { k: 'type', label: 'Type', type: 'select', options: typeOptions },
            { k: 'lat', label: 'Latitude' },
            { k: 'lng', label: 'Longitude' },
            { k: 'tags', label: 'Tags, comma separated', wide: true, placeholder: 'Bowl, Ledges' },
            { k: 'sports', label: 'Good for', type: 'sports', choices: SPORT_CHOICES, wide: true },
            {
              k: 'indoor',
              label: 'Cover',
              type: 'select',
              options: INDOOR_OPTIONS.map(([v, l]) => [v, l] as const),
            },
            {
              k: 'operating',
              label: 'Still there?',
              type: 'select',
              options: OPERATING_OPTIONS.map(([v, l]) => [v, l] as const),
            },
          ]}
          onSave={async (value) => {
            const result = await runAction('admin_save', () =>
              saveSpotAction(editing.id, spotFrom(value)),
            );
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
