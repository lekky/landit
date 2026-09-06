'use client';

import { useState, useTransition } from 'react';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { useToast } from '@/providers/toast';

import { setAttendanceAction } from '../actions';
import styles from './event.module.css';

/**
 * "I'm going to this", on an event's own page.
 *
 * **The whole of this control is private, and the page says so beside it.**
 * `event_attendance` is `OWN_AND_CONSENTED`, so nobody can read anybody else's
 * row — not a rider, not this page, not a crawler. There is deliberately no
 * count, no list and no "12 going" anywhere on the screen, because a list of
 * children who will be at a park on Saturday is precisely the stranger-contact
 * surface this product does not have (plan §6.1). That is not a rendering
 * choice that could be reversed by a keener session: there is nothing to
 * render, by API rule.
 *
 * The client boundary is this button and nothing else. The page around it is a
 * server component and stays one — it is the crawlable half, and shipping it to
 * the browser to hold one boolean would undo the reason it exists.
 *
 * Optimistic, like the list's toggle: the state flips on press and is put back
 * if the write is refused, so a rider waiting on a guardian sees the refusal
 * rather than a button that silently did nothing.
 */
export function GoingToggle({
  slug,
  name,
  kindColor,
  initial,
}: {
  readonly slug: string;
  /** The event's name, for the toast. Never sent anywhere — it is copy on screen. */
  readonly name: string;
  readonly kindColor: string;
  /** Whether this rider is already down for it. Read on the server, per rider. */
  readonly initial: boolean;
}) {
  const [going, setGoing] = useState(initial);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const toggle = () => {
    const next = !going;
    setGoing(next);
    startTransition(async () => {
      const result = await setAttendanceAction(slug, next);
      if (result.error) {
        setGoing(!next);
        toast(result.error, 'var(--red)');
        return;
      }
      toast(next ? `You’re down for ${name}.` : `Taken off ${name}.`, kindColor);
      // After the write, never optimistically — a count of people who *tried*
      // to say they were going is a different number wearing this one's name.
      capture(ANALYTICS_EVENTS.eventAttendanceSet, { going: next });
    });
  };

  return (
    <button
      type="button"
      className={styles.toggle}
      aria-pressed={going}
      disabled={pending}
      onClick={toggle}
    >
      <span className={styles.toggleBox} aria-hidden="true" />
      <span>{going ? 'You’re going' : 'I’m going to this'}</span>
    </button>
  );
}
