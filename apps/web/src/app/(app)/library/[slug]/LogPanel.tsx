'use client';

import {
  STAGE,
  type SportId,
  type StageId,
  type VideoLink,
  type VideoLinkAllowance,
} from '@landit/core';
import { Button, Icon, Modal, Panel, foregroundFor } from '@landit/ui-web';
import { useOptimistic, useState, useTransition } from 'react';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { useToast } from '@/providers/toast';

import { addNoteAction, removeNoteAction, updateNoteAction } from '../actions';
import styles from './log.module.css';
import { Pager, pageIndex, pageOf } from './Pager';
import { VideosPanel } from './VideosPanel';

/** Notes per page on the notes tab — the handoff's count. */
const NOTES_PER_PAGE = 3;

/**
 * One note as the panel draws it. Built on the server: the date is formatted
 * there and passed down as a string, because a date rendered on both sides of
 * hydration is a mismatch that throws the tree away (LESSONS §3a).
 */
export interface NoteView {
  readonly id: string;
  readonly body: string;
  /** The stage the rider was at when it was written, or `null` for none. */
  readonly stage: StageId | null;
  /** "2 Sep 2026". The `.lab` class uppercases it on screen. */
  readonly dateLabel: string;
}

type Tab = 'notes' | 'videos';

/** What the optimistic list can be told before the server answers. */
type NoteChange =
  | { readonly kind: 'add'; readonly note: NoteView }
  | { readonly kind: 'edit'; readonly id: string; readonly body: string }
  | { readonly kind: 'remove'; readonly id: string };

/** An optimistic note's id, until the server hands back the real one. */
const PENDING = 'pending:';

/**
 * "Your log" — session notes and videos, one panel with two tabs (T30; trick
 * page enrichment handoff of 2026-09-07).
 *
 * Until now a rider had **one** note per trick, a single textarea saved on
 * blur. The owner decided (Rachid, 2026-09-07, in chat) that notes become a
 * **dated list**: every save is a new entry, stamped with the date and with
 * the stage the rider was at on the trick when they wrote it, and an entry can
 * be reworded or removed afterwards. The videos tab is `VideosPanel`, unchanged
 * in what it means and paged four at a time.
 *
 * Three things about this component are deliberate:
 *
 * - **Private, and it says so in the head.** A note is a rider writing to
 *   themselves — the single most private thing in the product — and nothing in
 *   the product makes one reachable by another rider at any privacy setting
 *   (plan §3 guarantee 1, §6.1). "Only you can see this" is not decoration; it
 *   is the one line a child reads before writing.
 * - **The list is optimistic and the server is the authority.** `useOptimistic`
 *   shows an add, an edit or a removal the instant it is asked for, and reverts
 *   on its own when the action fails — the rider sees the note they wrote,
 *   then a toast and the note gone, never a note that was never stored. On
 *   success the action's `revalidatePath` hands back the server's list, with
 *   the real id and the real date, and that replaces the guess.
 * - **The cap and the stage are the hook's.** Fifty notes per rider per trick
 *   and the five-stage vocabulary are enforced in `47_trick_notes.pb.js` on
 *   every write path; nothing here counts. What this does with a refusal is
 *   show it, in the hook's own sentence.
 *
 * Removing goes through a confirm. It is one tap on a child's own record and
 * there is no bin, so the modal says exactly that and quotes the note back.
 */
export function LogPanel({
  trickId,
  slug,
  sport,
  trickName,
  stage,
  notes: served,
  todayLabel,
  videos,
  allowance,
  heldTotal,
}: {
  /** The `tricks` record id — what `trick_notes` relates to. */
  trickId: string;
  slug: string;
  sport: SportId;
  trickName: string;
  /** The rider's stage on this trick right now — stamped on a new note. */
  stage: StageId | null;
  /** This rider's notes on this trick, newest first, from the server. */
  notes: readonly NoteView[];
  /** Today, formatted on the server in the rider's timezone, for the note
   * that is shown before the server has dated it. */
  todayLabel: string;
  videos: readonly VideoLink[];
  allowance: VideoLinkAllowance;
  heldTotal: number;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('notes');
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<{ id: string; draft: string } | null>(null);
  const [confirming, setConfirming] = useState<NoteView | null>(null);
  const [page, setPage] = useState(0);
  const [pending, startTransition] = useTransition();

  const [notes, change] = useOptimistic(
    served,
    (current: readonly NoteView[], next: NoteChange) => {
      switch (next.kind) {
        case 'add':
          return [next.note, ...current];
        case 'edit':
          return current.map((note) => (note.id === next.id ? { ...note, body: next.body } : note));
        case 'remove':
          return current.filter((note) => note.id !== next.id);
      }
    },
  );

  const facts = { slug, sport };

  const add = () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    setPage(0);
    startTransition(async () => {
      change({
        kind: 'add',
        note: { id: `${PENDING}${Date.now()}`, body, stage, dateLabel: todayLabel },
      });
      const result = await addNoteAction({ trickId, slug, body, stage });
      if (result.ok) {
        // After the write, never before it. The stage is a catalogue fact about
        // the ladder; the body never travels, nor its length.
        capture(ANALYTICS_EVENTS.noteSaved, { ...facts, stage: stage ?? 'none', how: 'added' });
        return;
      }
      // The optimistic entry reverts on its own; the words go back where the
      // rider can see them rather than vanishing with the refusal.
      setDraft(body);
      toast(result.message, 'var(--red)');
    });
  };

  const saveEdit = () => {
    if (!editing) return;
    const body = editing.draft.trim();
    if (!body) return;
    const { id } = editing;
    setEditing(null);
    startTransition(async () => {
      change({ kind: 'edit', id, body });
      const result = await updateNoteAction({ noteId: id, slug, body });
      if (result.ok) {
        capture(ANALYTICS_EVENTS.noteSaved, { ...facts, stage: 'unchanged', how: 'edited' });
        return;
      }
      setEditing({ id, draft: body });
      toast(result.message, 'var(--red)');
    });
  };

  const remove = (note: NoteView) => {
    setConfirming(null);
    if (editing?.id === note.id) setEditing(null);
    startTransition(async () => {
      change({ kind: 'remove', id: note.id });
      const result = await removeNoteAction({ noteId: note.id, slug });
      if (result.ok) {
        capture(ANALYTICS_EVENTS.noteRemoved, { ...facts, stage: note.stage ?? 'none' });
        return;
      }
      toast(result.message, 'var(--red)');
    });
  };

  const current = pageIndex(page, notes.length, NOTES_PER_PAGE);
  const shown = pageOf(notes, current, NOTES_PER_PAGE);

  return (
    <Panel flat className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.headRow}>
          <h2 className={`d ${styles.title}`}>Your log</h2>
          <span className={`lab ${styles.private}`}>
            <Icon name="lock" size={12} strokeWidth={2.6} />
            Only you can see this
          </span>
        </div>
        <div className={styles.tabs} role="tablist" aria-label="Your log">
          <button
            type="button"
            role="tab"
            id="log-tab-notes"
            aria-selected={tab === 'notes'}
            aria-controls="log-panel-notes"
            className={`${styles.tab}${tab === 'notes' ? ` ${styles.tabOn}` : ''}`}
            onClick={() => setTab('notes')}
          >
            Session notes<span className={styles.count}>{notes.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            id="log-tab-videos"
            aria-selected={tab === 'videos'}
            aria-controls="log-panel-videos"
            className={`${styles.tab}${tab === 'videos' ? ` ${styles.tabOn}` : ''}`}
            onClick={() => setTab('videos')}
          >
            Your videos<span className={styles.count}>{videos.length}</span>
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {tab === 'notes' ? (
          <div role="tabpanel" id="log-panel-notes" aria-labelledby="log-tab-notes">
            <div className={styles.compose}>
              <textarea
                id="trick-note"
                aria-label="Session note"
                rows={2}
                className={styles.textarea}
                placeholder="What went wrong, what to try next time…"
                value={draft}
                maxLength={2000}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  // Ctrl/Cmd+Enter saves; plain Enter is a new line, since a
                  // note is prose and not a search box.
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    add();
                  }
                }}
              />
              <Button
                size="sm"
                className={styles.composeSave}
                disabled={pending || draft.trim().length === 0}
                onClick={add}
              >
                Save
              </Button>
            </div>

            {notes.length > 0 ? (
              <div className={styles.list}>
                {shown.map((note) => {
                  const isEditing = editing?.id === note.id;
                  const isPending = note.id.startsWith(PENDING);
                  const look = note.stage ? STAGE[note.stage] : null;
                  return (
                    <div
                      key={note.id}
                      className={`${styles.note}${isEditing ? ` ${styles.noteEditing}` : ''}`}
                    >
                      <div className={styles.noteHead}>
                        <span className={`lab ${styles.date}`}>{note.dateLabel}</span>
                        {look && (
                          <span
                            className={styles.stage}
                            style={{ background: look.color, color: foregroundFor(look.color) }}
                          >
                            {look.label}
                          </span>
                        )}
                        <span className={styles.noteActions}>
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                className={`${styles.small} ${styles.smallOn}`}
                                disabled={pending || editing.draft.trim().length === 0}
                                onClick={saveEdit}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className={styles.small}
                                onClick={() => setEditing(null)}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className={styles.small}
                                disabled={pending || isPending}
                                onClick={() => setEditing({ id: note.id, draft: note.body })}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className={`${styles.small} ${styles.smallDanger}`}
                                disabled={pending || isPending}
                                onClick={() => setConfirming(note)}
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </span>
                      </div>
                      {isEditing ? (
                        <textarea
                          aria-label="Edit this note"
                          rows={2}
                          className={`${styles.textarea} ${styles.noteTextarea}`}
                          value={editing.draft}
                          maxLength={2000}
                          autoFocus
                          onChange={(event) =>
                            setEditing({ id: note.id, draft: event.target.value })
                          }
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                              event.preventDefault();
                              saveEdit();
                            }
                            if (event.key === 'Escape') setEditing(null);
                          }}
                        />
                      ) : (
                        <p className={styles.noteBody}>{note.body}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={styles.empty}>
                Nothing written yet. Notes are saved to this trick and nobody else can read them.
              </p>
            )}

            <Pager
              total={notes.length}
              perPage={NOTES_PER_PAGE}
              page={current}
              onPage={setPage}
              label="notes"
            />
          </div>
        ) : (
          <div role="tabpanel" id="log-panel-videos" aria-labelledby="log-tab-videos">
            <VideosPanel
              trickId={trickId}
              slug={slug}
              trickName={trickName}
              initial={videos}
              allowance={allowance}
              heldTotal={heldTotal}
            />
          </div>
        )}
      </div>

      {confirming && (
        <Modal onClose={() => setConfirming(null)} width={420} label="Remove this note?">
          <div className={styles.confirm}>
            <div className={styles.confirmHead}>
              <span className={styles.confirmMark} aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  width={20}
                  height={20}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 7h16" />
                  <path d="M9 7V4h6v3" />
                  <path d="M6 7l1 13h10l1-13" />
                </svg>
              </span>
              <h3 className={`d ${styles.confirmTitle}`}>Remove this note?</h3>
            </div>
            <div className={styles.confirmQuote}>
              <div className={`lab ${styles.confirmQuoteDate}`}>{confirming.dateLabel}</div>
              <p className={styles.confirmQuoteBody}>{confirming.body}</p>
            </div>
            <p className={styles.confirmCopy}>
              It goes for good. There is no bin to get it back from.
            </p>
            <div className={styles.confirmActions}>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                Keep it
              </Button>
              <Button size="sm" className={styles.danger} onClick={() => remove(confirming)}>
                Remove it
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Panel>
  );
}
