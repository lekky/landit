'use client';

import { Panel } from '@landit/ui-web';
import { useRef, useState, useTransition } from 'react';

import { useToast } from '@/providers/toast';

import { saveNoteAction } from '../actions';
import styles from './trick.module.css';

/**
 * Session notes: what went wrong, what to try next time.
 *
 * Private to the rider and deliberately not a channel — trick notes are
 * personal, and nothing in the product makes them reachable by another rider
 * (plan §6.1). Saved on blur, like the prototype, so there is no Save button to
 * forget: the last thing typed is the thing kept.
 */
export function NotesPanel({
  trickId,
  slug,
  initial,
}: {
  trickId: string;
  slug: string;
  initial: string;
}) {
  const { toast } = useToast();
  const [body, setBody] = useState(initial);
  const saved = useRef(initial);
  const [, startTransition] = useTransition();

  const save = () => {
    if (body === saved.current) return;
    const attempt = body;
    saved.current = attempt;
    startTransition(async () => {
      const result = await saveNoteAction({ trickId, slug, body: attempt });
      if (!result.ok) {
        saved.current = initial;
        toast(result.message, 'var(--red)');
      }
    });
  };

  return (
    <Panel flat className={styles.sidePanel}>
      <label className="lab" htmlFor="trick-note">
        Session notes
      </label>
      <textarea
        id="trick-note"
        rows={3}
        value={body}
        placeholder="What went wrong, what to try next time…"
        onChange={(event) => setBody(event.target.value)}
        onBlur={save}
        className={styles.notes}
      />
    </Panel>
  );
}
