'use client';

import {
  SPORTS,
  SPORT_IDS,
  SPOT_SUBMISSION_MAX_PENDING,
  SPOT_TYPES,
  parseSpotLocation,
  spotLocationMessage,
  type SportId,
  type SpotSubmissionProblems,
} from '@landit/core';
import { Button, Panel, Pill } from '@landit/ui-web';
import { useState, useTransition } from 'react';

import { submitSpotAction } from './actions';
import styles from './spots.module.css';

/** A blank draft. `type` is a plain string so the select can hold anything the
 *  rider picks; `spotSubmissionProblems` is what decides whether it is one of
 *  the three. */
const EMPTY: { name: string; town: string; type: string; coords: string; tags: string } = {
  name: '',
  town: '',
  type: SPOT_TYPES[0],
  coords: '',
  tags: '',
};

/**
 * "+ Add a spot" (screenshot 19, the panel under the heading).
 *
 * Three things it says out loud, because a form that hides them teaches a rider
 * the wrong thing about what happens next:
 *
 * - **A person reads it before anyone else sees it.** The prototype's line, kept
 *   almost word for word: submitted spots are reviewed so people cannot just
 *   make places up (plan §6.1).
 * - **It needs a location.** The prototype's form did not insist; this one does,
 *   and says why in the field's own message rather than after a failed submit.
 * - **There is a limit.** A rider who has hit it is told so by the server, in a
 *   sentence, not by a silent failure.
 *
 * The validation is `@landit/core`'s, the same functions the server action calls
 * — so the message a rider gets while typing is the message the server would
 * have given, and there is no second copy of the rules to drift.
 */
export function AddSpotForm({
  signedIn,
  defaultSports,
  pendingCount,
  onDone,
}: {
  readonly signedIn: boolean;
  readonly defaultSports: readonly SportId[];
  readonly pendingCount: number;
  readonly onDone: () => void;
}) {
  const [form, setForm] = useState(EMPTY);
  const [sports, setSports] = useState<SportId[]>([...defaultSports]);
  const [problems, setProblems] = useState<SpotSubmissionProblems>({});
  const [message, setMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const location = parseSpotLocation(form.coords);
  const coordsHint =
    form.coords.trim() && !location.ok ? spotLocationMessage(location.reason) : null;

  const submit = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await submitSpotAction({ ...form, sports, tags: form.tags });
      if (result.ok) {
        setForm(EMPTY);
        setSports([...defaultSports]);
        setProblems({});
        setSent(true);
        return;
      }
      setProblems(result.problems ?? {});
      setMessage(result.message ?? null);
    });
  };

  if (!signedIn) {
    return (
      <Panel flat className={styles.form}>
        <p className={styles.formNote}>
          Spots come from riders. Sign in and you can put one forward — a person checks it before it
          goes on the map.
        </p>
      </Panel>
    );
  }

  if (sent) {
    return (
      <Panel flat className={styles.form}>
        <div className="d" style={{ fontSize: 20 }}>
          Sent for checking
        </div>
        <p className={styles.formNote}>
          It is in the list below, marked as waiting, and only you can see it there. Once somebody
          has checked it is a real place it goes on the map for everyone.
        </p>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Done
        </Button>
      </Panel>
    );
  }

  return (
    <Panel flat className={styles.form}>
      {message && <p className={styles.formError}>{message}</p>}

      <label className={styles.field}>
        <span className="lab">Spot name</span>
        <input
          className={styles.input}
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="Rampworx"
        />
        {problems.name && <span className={styles.fieldError}>{problems.name}</span>}
      </label>

      <label className={styles.field}>
        <span className="lab">Town</span>
        <input
          className={styles.input}
          value={form.town}
          onChange={(event) => setForm({ ...form, town: event.target.value })}
          placeholder="Liverpool"
        />
        {problems.town && <span className={styles.fieldError}>{problems.town}</span>}
      </label>

      <label className={styles.field}>
        <span className="lab">What kind of spot</span>
        <select
          className={styles.input}
          value={form.type}
          onChange={(event) => setForm({ ...form, type: event.target.value })}
        >
          {SPOT_TYPES.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className="lab">Tags, comma separated</span>
        <input
          className={styles.input}
          value={form.tags}
          onChange={(event) => setForm({ ...form, tags: event.target.value })}
          placeholder="Bowl, Ledges"
        />
      </label>

      <label className={styles.field}>
        <span className="lab">Where is it</span>
        <input
          className={styles.input}
          value={form.coords}
          onChange={(event) => setForm({ ...form, coords: event.target.value })}
          placeholder="Paste a Google Maps link, or 53.4084, -2.9916"
        />
        {(coordsHint ?? problems.coords) && (
          <span className={styles.fieldError}>{coordsHint ?? problems.coords}</span>
        )}
        {location.ok && (
          <span className={`cond ${styles.fieldOk}`}>
            Got it: {location.value.lat.toFixed(4)}, {location.value.lng.toFixed(4)}
          </span>
        )}
      </label>

      <div className={styles.field}>
        <span className="lab">Who&rsquo;s it good for?</span>
        <div className={styles.sportPills}>
          {SPORT_IDS.map((id) => (
            <Pill
              key={id}
              on={sports.includes(id)}
              onClick={() =>
                setSports((chosen) =>
                  chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id],
                )
              }
            >
              {SPORTS[id].label}
            </Pill>
          ))}
        </div>
        {problems.sports && <span className={styles.fieldError}>{problems.sports}</span>}
      </div>

      <Button variant="ink" size="sm" wide onClick={submit} disabled={pending}>
        {pending ? 'Sending…' : 'Submit spot'}
      </Button>

      <p className={styles.formNote}>
        Submitted spots are reviewed before they go on the map, so people can&rsquo;t just make
        places up. You can have {SPOT_SUBMISSION_MAX_PENDING} waiting at once
        {pendingCount > 0
          ? ` — ${pendingCount} of yours ${pendingCount === 1 ? 'is' : 'are'} in the queue now`
          : ''}
        .
      </p>
    </Panel>
  );
}
