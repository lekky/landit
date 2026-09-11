'use client';

import { Modal, Pill } from '@landit/ui-web';
import { useEffect, useRef, useState, useTransition } from 'react';

import type { StaffWriteResult } from './actions';

import styles from './admin.module.css';

/**
 * The staff edit modal (`landit-admin.jsx`, `AdminEditor`).
 *
 * One component for every content tab, exactly as the prototype had it: a title,
 * a grid of fields described as data, Cancel and Save. Tricks, spots, events,
 * challenges, stickers and plans all edit through this, which is why a field is
 * a description rather than JSX — a tab adds a row to an array, not a form.
 *
 * **It differs from the prototype in one way that matters: saving can fail.**
 * The prototype wrote to `localStorage` and closed the modal in the same breath,
 * because nothing could refuse it. Here Save is a server action against a
 * PocketBase that has opinions — one live challenge per sport, a unique slug, a
 * date that parses — so the modal stays open while the write is in flight, and
 * on a refusal it keeps everything typed and shows what the server said. A modal
 * that closed on failure would look exactly like one that closed on success.
 */

export type EditorValue = Record<string, string | string[]>;

export type EditorField = {
  /** The key in the value object. */
  readonly k: string;
  readonly label: string;
  /**
   * `input` when omitted. `pairs` is a list of two-part rows — the trick
   * editor's common mistakes (T28) — held in the value as a flat `string[]`
   * of `[first, second, first, second, …]`, which is the one shape
   * `EditorValue` already has room for.
   */
  readonly type?: 'input' | 'text' | 'select' | 'sports' | 'colour' | 'pairs';
  /** Spans the whole grid. */
  readonly wide?: boolean;
  readonly placeholder?: string;
  /** `text` only. */
  readonly rows?: number;
  /** `select` only: `[value, label]` pairs. */
  readonly options?: readonly (readonly [string, string])[];
  /** `sports` and `colour` only: the choices, as `[id, label]` / hex strings. */
  readonly choices?: readonly (readonly [string, string])[];
  /** Shown under the control, for a field whose effect is not obvious. */
  readonly hint?: string;
  /** `input` only; renders a native date picker. */
  readonly inputType?: 'text' | 'date' | 'number';
  /** `pairs` only: the two column headings, and placeholders for an empty row. */
  readonly pairLabels?: readonly [string, string];
  readonly pairPlaceholders?: readonly [string, string];
  /** `pairs` only: Remove is disabled at the minimum, Add at the maximum. */
  readonly minPairs?: number;
  readonly maxPairs?: number;
};

/** A flat `[a, b, a, b, …]` as rows. */
function pairsOf(flat: readonly string[]): [string, string][] {
  const rows: [string, string][] = [];
  for (let i = 0; i < flat.length; i += 2) rows.push([flat[i] ?? '', flat[i + 1] ?? '']);
  return rows;
}

/**
 * Whether the draft still says what the record it was opened on says. A field
 * that was missing and one that is now empty are the same answer — ticking a
 * sport on and off again is not a change worth asking about.
 */
function sameValue(a: EditorValue, b: EditorValue): boolean {
  const plain = (v: string | string[] | undefined) =>
    JSON.stringify(v === undefined || (Array.isArray(v) && v.length === 0) ? '' : v);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].every(
    (k) => plain(a[k]) === plain(b[k]),
  );
}

export function StaffEditor({
  title,
  eyebrow = 'Staff edit',
  fields,
  value,
  saveLabel = 'Save changes',
  onSave,
  onClose,
}: {
  title: string;
  eyebrow?: string;
  fields: readonly EditorField[];
  value: EditorValue;
  saveLabel?: string;
  /** Resolves to the server's answer. The modal closes only on `ok`. */
  onSave: (value: EditorValue) => Promise<StaffWriteResult>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<EditorValue>(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const asked = useRef(false);

  const set = (k: string, next: string | string[]) => {
    setDraft((prev) => ({ ...prev, [k]: next }));
    setError(null);
    setConfirming(false);
  };

  /*
   * **A form with changes in it asks before it goes** (issue #372). On a phone
   * the scrim is the 20px gutter either side of the panel and the band above
   * it — exactly where a thumb lands reaching for the top of a tall form — and
   * one stray tap used to throw away a sixteen-field event. Every way out that
   * is not Save comes through here: the scrim, Escape, and Cancel, which sits
   * right beside Save in the bar.
   *
   * Asking twice backs out of the question rather than answering it: a second
   * tap on the scrim or a second Escape means "not that", so it returns to the
   * form. Discard is only ever a deliberate press. And nothing closes while a
   * save is in flight — a modal that closed then would hide the server's
   * refusal, which is the thing the paragraph above this component is about.
   */
  const requestClose = () => {
    if (pending) return;
    if (confirming) setConfirming(false);
    else if (sameValue(draft, value)) onClose();
    else setConfirming(true);
  };

  /*
   * Focus goes to "Keep editing" when the question appears, because it is the
   * answer that loses nothing and a screen reader should land on it; and back
   * to Cancel when the question goes, unless the rider has since moved focus
   * into a field themselves.
   */
  useEffect(() => {
    if (confirming) {
      asked.current = true;
      keepRef.current?.focus();
    } else if (asked.current) {
      asked.current = false;
      if (document.activeElement === document.body) cancelRef.current?.focus();
    }
  }, [confirming]);

  const text = (k: string): string => {
    const v = draft[k];
    return typeof v === 'string' ? v : '';
  };

  const many = (k: string): string[] => {
    const v = draft[k];
    return Array.isArray(v) ? v : [];
  };

  const submit = () => {
    startTransition(async () => {
      const result = await onSave(draft);
      if (result.ok) onClose();
      else setError(result.message);
    });
  };

  return (
    <Modal
      onClose={onClose}
      onRequestClose={requestClose}
      width={580}
      label={title}
      /*
       * Cancel and Save in the modal's footer, which stays on screen while the
       * form scrolls (issue #372). They used to sit at the bottom of a body up
       * to 1,400px tall — 2.4 screens down on a phone, and under the keyboard
       * the moment a field had focus.
       */
      footer={
        <>
          {error && (
            <p className={styles.editorError} role="alert">
              {error}
            </p>
          )}
          {confirming ? (
            <>
              <p className={styles.editorAsk} role="alert">
                Discard your changes?
              </p>
              <div className={styles.editorActions}>
                <button type="button" className="btn ghost" onClick={onClose}>
                  Discard
                </button>
                {/* Where Save was, so a second tap in the same place loses nothing. */}
                <button
                  ref={keepRef}
                  type="button"
                  className="btn"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => setConfirming(false)}
                >
                  Keep editing
                </button>
              </div>
            </>
          ) : (
            <div className={styles.editorActions}>
              <button
                ref={cancelRef}
                type="button"
                className="btn ghost"
                disabled={pending}
                onClick={requestClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                disabled={pending}
                style={{ marginLeft: 'auto' }}
                onClick={submit}
              >
                {pending ? 'Saving…' : saveLabel}
              </button>
            </div>
          )}
        </>
      }
    >
      <div className={styles.editor}>
        <div className="eyebrow">{eyebrow}</div>
        <h3 className={`d ${styles.editorTitle}`}>{title}</h3>

        <div className={styles.editorGrid}>
          {fields.map((field) => (
            <div
              key={field.k}
              className="field"
              style={field.wide ? { gridColumn: '1/-1' } : undefined}
            >
              <label htmlFor={`editor-${field.k}`}>{field.label}</label>

              {field.type === 'select' ? (
                <select
                  id={`editor-${field.k}`}
                  value={text(field.k)}
                  disabled={pending}
                  onChange={(e) => set(field.k, e.target.value)}
                >
                  {(field.options ?? []).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              ) : field.type === 'text' ? (
                <textarea
                  id={`editor-${field.k}`}
                  rows={field.rows ?? 2}
                  value={text(field.k)}
                  disabled={pending}
                  placeholder={field.placeholder}
                  onChange={(e) => set(field.k, e.target.value)}
                />
              ) : field.type === 'sports' ? (
                <div className={styles.editorChoices} id={`editor-${field.k}`}>
                  {(field.choices ?? []).map(([id, label]) => {
                    const on = many(field.k).includes(id);
                    return (
                      <Pill
                        key={id}
                        on={on}
                        onClick={() =>
                          set(
                            field.k,
                            on ? many(field.k).filter((x) => x !== id) : [...many(field.k), id],
                          )
                        }
                      >
                        {label}
                      </Pill>
                    );
                  })}
                </div>
              ) : field.type === 'pairs' ? (
                <div className={styles.pairs} id={`editor-${field.k}`}>
                  {(() => {
                    const rows = pairsOf(many(field.k));
                    const [firstLabel, secondLabel] = field.pairLabels ?? ['First', 'Second'];
                    const [firstHint, secondHint] = field.pairPlaceholders ?? ['', ''];
                    const min = field.minPairs ?? 0;
                    const max = field.maxPairs ?? Number.POSITIVE_INFINITY;
                    const write = (next: [string, string][]) => set(field.k, next.flat());
                    return (
                      <>
                        <div className={`${styles.pairRow} ${styles.pairHead}`}>
                          <span className="lab">{firstLabel}</span>
                          <span className="lab">{secondLabel}</span>
                          <span />
                        </div>
                        {rows.map(([first, second], i) => (
                          <div key={i} className={styles.pairRow}>
                            <input
                              aria-label={`${firstLabel} ${i + 1}`}
                              value={first}
                              disabled={pending}
                              placeholder={firstHint}
                              onChange={(e) =>
                                write(rows.map((r, j) => (j === i ? [e.target.value, r[1]] : r)))
                              }
                            />
                            <input
                              aria-label={`${secondLabel} ${i + 1}`}
                              value={second}
                              disabled={pending}
                              placeholder={secondHint}
                              onChange={(e) =>
                                write(rows.map((r, j) => (j === i ? [r[0], e.target.value] : r)))
                              }
                            />
                            <button
                              type="button"
                              className="btn sm ghost"
                              aria-label={`Remove row ${i + 1}`}
                              title={rows.length <= min ? `Keep at least ${min}` : 'Remove'}
                              disabled={pending || rows.length <= min}
                              onClick={() => write(rows.filter((_, j) => j !== i))}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <div>
                          <button
                            type="button"
                            className="btn sm ghost"
                            disabled={pending || rows.length >= max}
                            onClick={() => write([...rows, ['', '']])}
                          >
                            + Add another
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : field.type === 'colour' ? (
                <div className={styles.editorChoices} id={`editor-${field.k}`}>
                  {(field.choices ?? []).map(([hex, label]) => (
                    <button
                      key={hex}
                      type="button"
                      aria-label={label}
                      aria-pressed={text(field.k) === hex}
                      className={styles.swatch}
                      style={{
                        background: hex,
                        borderWidth: text(field.k) === hex ? 4 : 2.5,
                      }}
                      onClick={() => set(field.k, hex)}
                    />
                  ))}
                </div>
              ) : (
                <input
                  id={`editor-${field.k}`}
                  type={field.inputType ?? 'text'}
                  value={text(field.k)}
                  disabled={pending}
                  placeholder={field.placeholder}
                  onChange={(e) => set(field.k, e.target.value)}
                />
              )}

              {field.hint && <span className={styles.fieldHint}>{field.hint}</span>}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
