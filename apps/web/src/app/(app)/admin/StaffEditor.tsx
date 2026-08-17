'use client';

import { Modal, Pill } from '@landit/ui-web';
import { useState, useTransition } from 'react';

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
  /** `input` when omitted. */
  readonly type?: 'input' | 'text' | 'select' | 'sports' | 'colour';
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
};

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

  const set = (k: string, next: string | string[]) => {
    setDraft((prev) => ({ ...prev, [k]: next }));
    setError(null);
  };

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
    <Modal onClose={onClose} width={580} label={title}>
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

        {error && (
          <p className={styles.editorError} role="alert">
            {error}
          </p>
        )}

        <div className={styles.editorActions}>
          <button type="button" className="btn ghost" disabled={pending} onClick={onClose}>
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
      </div>
    </Modal>
  );
}
