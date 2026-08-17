'use client';

import { SPORTS, SPORT_IDS } from '@landit/core';
import { Panel, SportChip, Tag } from '@landit/ui-web';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { useToast } from '@/providers/toast';

import { StaffEditor, type EditorValue } from '../StaffEditor';
import {
  createEventAction,
  saveEventAction,
  setEventLiveAction,
  type EventForm,
} from '../content-actions';
import type { AdminEventRow } from '../view';

import styles from '../admin.module.css';

/**
 * The events calendar, as staff edit it.
 *
 * "Remove" is a hide, like the library and the sticker wall, and the reason is
 * on the row: `event_attendance` cascades from `events`, so deleting a comp
 * erases the "I am going" of every rider who marked it. A cancelled event and
 * an event that never happened are different things, and only one of them
 * should take the riders' record of it with them.
 */

const SPORT_CHOICES = SPORT_IDS.map((id) => [id, SPORTS[id].label] as const);

const BLANK: EditorValue = {
  name: '',
  kind: 'Comp',
  date: '',
  venue: '',
  town: '',
  level: 'All levels',
  price: '',
  spotsCopy: '',
  blurb: '',
  sports: [...SPORT_IDS],
};

export function EventsScreen({
  rows,
  kinds,
}: {
  rows: readonly AdminEventRow[];
  kinds: readonly string[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<AdminEventRow | null>(null);
  const [adding, setAdding] = useState(false);

  const kindOptions = kinds.map((k) => [k, k] as const);

  const eventFrom = (value: EditorValue): EventForm => ({
    name: String(value.name ?? ''),
    kind: String(value.kind ?? 'Comp'),
    date: String(value.date ?? ''),
    venue: String(value.venue ?? ''),
    town: String(value.town ?? ''),
    level: String(value.level ?? ''),
    price: String(value.price ?? ''),
    spotsCopy: String(value.spotsCopy ?? ''),
    blurb: String(value.blurb ?? ''),
    sports: Array.isArray(value.sports) ? value.sports : [],
  });

  const fields = [
    { k: 'name', label: 'Name', wide: true },
    { k: 'kind', label: 'Type', type: 'select' as const, options: kindOptions },
    { k: 'date', label: 'Date', inputType: 'date' as const },
    { k: 'venue', label: 'Venue' },
    { k: 'town', label: 'Town' },
    { k: 'level', label: 'Who for', placeholder: 'All levels' },
    { k: 'price', label: 'Cost', placeholder: 'Free' },
    { k: 'spotsCopy', label: 'Places', placeholder: '40 places' },
    { k: 'sports', label: 'Good for', type: 'sports' as const, choices: SPORT_CHOICES, wide: true },
    { k: 'blurb', label: 'Details', type: 'text' as const, rows: 3, wide: true },
  ];

  const onToggleLive = (row: AdminEventRow) => {
    if (
      row.isLive &&
      row.attending > 0 &&
      !confirm(
        `${row.attending} ${row.attending === 1 ? 'rider is' : 'riders are'} marked as going to ${row.name}. Take it off the calendar? They keep the mark and get it back if you put the event back up.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await setEventLiveAction(row.id, !row.isLive);
      if (result.ok) {
        toast(row.isLive ? `${row.name} taken down` : `${row.name} back on the calendar`);
      } else {
        toast(result.message, 'var(--red)');
      }
      router.refresh();
    });
  };

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={`btn sm ${styles.toolbarEnd}`}
          onClick={() => setAdding(true)}
        >
          + Add event
        </button>
      </div>

      <Panel className={`${styles.table} ${pending ? styles.busy : ''}`}>
        <div className={`arow ${styles.tableHead}`}>
          <span className="lab">Event</span>
          <span className="lab">Type</span>
          <span className="lab">Date</span>
          <span className="lab">Where</span>
          <span className="lab">Good for</span>
          <span className="lab">Actions</span>
        </div>

        {rows.map((row) => (
          <div
            key={row.id}
            className={`arow ${styles.tableRow} ${row.isLive ? '' : styles.hiddenRow}`}
          >
            <div className={styles.rowTitle}>
              <div className="cond" style={{ fontSize: 15 }}>
                {row.name}
                {!row.isLive && ' · off the calendar'}
              </div>
              <div className={styles.rowId}>
                {[row.level, row.price, `${row.attending} going`].filter(Boolean).join(' · ')}
              </div>
            </div>

            <span>
              <Tag color={row.kindColor} style={{ fontSize: 10 }}>
                {row.kind || '—'}
              </Tag>
            </span>

            <span className="cond" style={{ fontSize: 13.5 }}>
              {row.when}
            </span>

            <span className="cond" style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>
              {[row.venue, row.town].filter(Boolean).join(', ') || '—'}
            </span>

            <div className={styles.chipRow}>
              {row.sportLooks.map((sport) => (
                <SportChip key={sport.label} sport={sport} small />
              ))}
            </div>

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

        {!rows.length && <div className={styles.noRows}>Nothing on the calendar.</div>}
      </Panel>

      <p className={styles.footnote}>
        Removing an event takes it off every rider&rsquo;s calendar and keeps who was going, so
        putting it back restores their mark with it. The number beside each event is how many riders
        have said they are coming.
      </p>

      {editing && (
        <StaffEditor
          key={editing.id}
          title={`Edit ${editing.name}`}
          fields={fields}
          value={{
            name: editing.name,
            kind: editing.kind || 'Comp',
            date: editing.date,
            venue: editing.venue,
            town: editing.town,
            level: editing.level,
            price: editing.price,
            spotsCopy: editing.spotsCopy,
            blurb: editing.blurb,
            sports: [...editing.sports],
          }}
          onSave={async (value) => {
            const result = await saveEventAction(editing.id, eventFrom(value));
            if (result.ok) {
              toast(`${String(value.name)} updated`);
              router.refresh();
            }
            return result;
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {adding && (
        <StaffEditor
          title="New event"
          eyebrow="Staff add"
          saveLabel="Publish event"
          fields={fields}
          value={BLANK}
          onSave={async (value) => {
            const result = await createEventAction(eventFrom(value));
            if (result.ok) {
              toast(`${String(value.name)} published`, 'var(--sky)');
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
