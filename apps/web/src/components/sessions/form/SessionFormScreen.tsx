'use client';

import type { SessionField } from '@landit/core';
import { Modal } from '@landit/ui-web';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';

import { DeleteSessionDialog } from '@/components/sessions/DeleteSessionDialog';
import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { runAction } from '@/lib/runAction';
import {
  escalateQuickLog,
  formIsDirty,
  formProblems,
  refusalField,
  sessionQuotaWarning,
  type SavedRide,
  type SessionFormValues,
} from '@/lib/sessionForm';
import { sessionHref, sessionsHref } from '@/lib/sessionRoutes';
import { useSport } from '@/providers/sport';

import { editSessionAction, logSessionAction } from './actions';
import styles from './form.module.css';
import { FormHeader, FullForm, SESSION_STEPS, stepForField, type SessionStepId } from './FullForm';
import { QuickLog } from './QuickLog';
import { SavedState, type FreshSection } from './SavedState';
import { SessionWall } from './SessionWall';
import type { SessionFormData } from './types';

/**
 * The session form (T38): the quick log, the full form, edit mode, the saved
 * state and the fifth-session wall, as one piece of client state in two shells.
 *
 * - `shell="page"` is `/progress/sessions/new` and `/progress/sessions/<id>/edit`
 *   opened directly — a phone, a shared link, a refresh.
 * - `shell="modal"` is the same screens intercepted over the Sessions list on a
 *   soft navigation (`@modal/(.)new`, `@modal/(.)[id]/edit`), so a rider never
 *   loses their place (handoff, "Decisions"). Closing goes back.
 *
 * Every write goes through `runAction`, so a request that never reaches the
 * server is said out loud rather than lost (issue #433). Analytics fires only on
 * what the server said.
 */

type Stage = 'quick' | 'full' | 'saved' | 'wall';

interface Saved {
  readonly sessionId: string;
  readonly ride: SavedRide;
  readonly form: 'quick' | 'full';
  /** The "while it's fresh" prompts reopened it and the rider saved changes. */
  readonly added: boolean;
}

export interface SessionFormScreenProps {
  readonly data: SessionFormData;
  readonly shell: 'page' | 'modal';
}

export function SessionFormScreen({ data, shell }: SessionFormScreenProps) {
  const router = useRouter();
  const { sport: chipSport } = useSport();
  const [stage, setStage] = useState<Stage>(data.mode === 'new' && data.quick ? 'quick' : 'full');
  /** Which of the full form's three steps is open (rethink §3.10, T50). */
  const [step, setStep] = useState<SessionStepId>('when');
  const [rawValues, setValues] = useState<SessionFormValues>(data.initial);
  const [rawBaseline, setBaseline] = useState<SessionFormValues>(data.initial);
  /** The rider answered "What you rode" themselves, so the chip stops leading. */
  const [sportPicked, setSportPicked] = useState(false);
  /** The session a save writes to: the edited one, or the one the quick log just saved. */
  const [editingId, setEditingId] = useState<string | null>(data.sessionId);
  const [errors, setErrors] = useState<Partial<Record<SessionField, string>>>({});
  const [errorLine, setErrorLine] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [wall, setWall] = useState<{ grace: boolean; rideCounted: boolean } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /** The section a "while it's fresh" prompt asked for, scrolled to once the form is drawn. */
  const focusSection = useRef<FreshSection | null>(null);
  const [pending, startTransition] = useTransition();
  const opened = useRef(false);

  // `session_log_opened` once per form, with where it was opened from. Never
  // which spot, event or trick (analytics.ts).
  useEffect(() => {
    if (opened.current || data.mode !== 'new') return;
    opened.current = true;
    capture(ANALYTICS_EVENTS.sessionLogOpened, { source: data.source });
  }, [data.mode, data.source]);

  /**
   * A new session's sport follows the top bar's chip (D5, §3.10, T50).
   *
   * The server cannot decide this: the chip is a `localStorage` display
   * preference (`providers/sport.tsx`), so `newSessionValues` can only reach
   * for the rider's *first* sport — and a rider who switched the chip to BMX
   * last week then met a form pre-set to scooter, with their BMX tricks not
   * even offered, because `TricksField` filters by `values.sport`. "The sport
   * is chosen once" is what D5 promises, and this is the form keeping it.
   *
   * **Derived, not an effect.** Reading the chip in an effect and calling
   * `setState` is a cascading render and the shape LESSONS §3a warns about;
   * `useSport` is a `useSyncExternalStore`, so the answer is available during
   * render and this is a `?:` rather than a round trip through the reconciler.
   * `baseline` gets the same treatment, so an untouched form is not "dirty"
   * and closing it does not ask about changes nobody made.
   *
   * Four conditions, each one a case where the chip is the wrong answer: edit
   * mode, where the saved sport is the rider's own; a link that named a sport
   * (`sportFromLink`), because arriving from a skateboard trick means
   * skateboard whatever the chip says; a chip on a sport this rider does not
   * track; and the rider having answered "What you rode" here, which is the
   * Change link's whole point and the one answer that outranks the chip.
   */
  const followChip =
    data.mode === 'new' && !data.sportFromLink && !sportPicked && data.sports.includes(chipSport);
  const values = followChip ? { ...rawValues, sport: chipSport } : rawValues;
  const baseline = followChip ? { ...rawBaseline, sport: chipSport } : rawBaseline;

  // The rider has been shown the wall: the denominator for whether it converts.
  useEffect(() => {
    if (stage === 'wall') capture(ANALYTICS_EVENTS.sessionQuotaWallSeen, { plan: data.plan });
  }, [stage, data.plan]);

  // A "while it's fresh" prompt lands the rider on the section it named.
  useEffect(() => {
    if (stage !== 'full' || !focusSection.current) return;
    document.getElementById(`session-${focusSection.current}`)?.scrollIntoView({ block: 'start' });
    focusSection.current = null;
  }, [stage]);

  const isEdit = editingId !== null;
  const dirty = formIsDirty(values, baseline);

  const close = () => {
    if (shell === 'modal') {
      router.back();
      return;
    }
    router.push(editingId && data.mode === 'edit' ? sessionHref(editingId) : sessionsHref());
  };

  /**
   * Every way out that is not Save comes through here: Esc, the scrim, the
   * header's Close and Cancel. A form with changes in it asks first — the
   * pattern `StaffEditor` set for issue #372 — and asking twice backs out of the
   * question. Nothing closes while a save is in flight.
   */
  const requestClose = () => {
    if (pending) return;
    if (stage === 'saved' || stage === 'wall' || !dirty) {
      close();
      return;
    }
    setConfirming((asking) => !asking);
  };

  const update = (patch: Partial<SessionFormValues>) => {
    // Answering "What you rode" here stops the chip leading: a rider who
    // pressed Change means it, and a control that reverted on the next render
    // would be one that cannot be used.
    if (patch.sport !== undefined) setSportPicked(true);
    setValues((current) => ({ ...current, ...patch }));
    setConfirming(false);
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) {
        const field = (key === 'tricks' ? 'tricks' : key) as SessionField;
        delete next[field];
      }
      return next;
    });
  };

  const escalate = () => {
    capture(ANALYTICS_EVENTS.sessionLogOpened, { source: 'quick_log_escalate' });
    setValues((current) => escalateQuickLog(current));
    setErrors({});
    setErrorLine(null);
    /*
     * Onto "What", not back to the beginning. The control that got here reads
     * "Add tricks, clip and notes →", and the quick log has already asked for
     * the whole of step one — where, when and how it felt — so opening on it
     * would answer a press for more with a screenful the rider just filled in.
     */
    setStep('what');
    setStage('full');
  };

  const show = (message: string, field: SessionField | null, from: Stage) => {
    if (field) {
      setErrors({ [field]: message });
      // The quick log has three fields; a problem with any other opens the full form.
      if (from === 'quick' && !['spotId', 'feel', 'startedAt'].includes(field)) setStage('full');
      // …and the full form is three steps, so the refusal lands on the one
      // that can fix it rather than on whichever the rider happens to be on.
      setStep(stepForField(field));
    } else {
      setErrorLine(message);
    }
  };

  const stepIndex = SESSION_STEPS.findIndex((s) => s.id === step);
  const lastStep = stepIndex === SESSION_STEPS.length - 1;

  /**
   * Next: the current step's own problems, then forward.
   *
   * Validating here as well as on Save is what stops a rider filling three
   * steps and being thrown back to the first one for a spot they never picked.
   * `formProblems` runs over the whole values object either way — it is the one
   * place that knows the rules — and this only keeps the answers that belong to
   * the step the rider is looking at.
   */
  const next = () => {
    if (pending) return;
    const problems = formProblems(
      values,
      { now: Date.now(), timezone: data.timezone },
      { clipAllowed: data.clip.allowed || values.clip === baseline.clip },
    );
    const here = Object.entries(problems).filter(
      ([field]) => stepForField(field as SessionField) === step,
    );
    if (here.length) {
      setErrors(Object.fromEntries(here) as Partial<Record<SessionField, string>>);
      return;
    }
    setErrors({});
    setErrorLine(null);
    const ahead = SESSION_STEPS[stepIndex + 1];
    if (ahead) setStep(ahead.id);
  };

  const submit = (useGrace = false) => {
    if (pending) return;
    const from = stage;
    const formKind: 'quick' | 'full' = from === 'quick' ? 'quick' : 'full';
    setErrors({});
    setErrorLine(null);

    const problems = formProblems(
      values,
      { now: Date.now(), timezone: data.timezone },
      { clipAllowed: data.clip.allowed || values.clip === baseline.clip },
    );
    const first = Object.entries(problems)[0];
    if (first && !useGrace) {
      setErrors(problems);
      if (from === 'quick' && !['spotId', 'feel', 'startedAt'].includes(first[0])) {
        setStage('full');
      }
      // The step holding the first problem, so the message is beside the
      // control that answers it (T50).
      setStep(stepForField(first[0] as SessionField));
      return;
    }

    startTransition(async () => {
      if (editingId) {
        const result = await runAction('session_edit', () =>
          editSessionAction({ sessionId: editingId, values }),
        );
        if (!result.ok) {
          const view = 'view' in result ? result.view : undefined;
          show(
            result.message,
            view?.kind === 'field' ? view.field : refusalField(result.message),
            from,
          );
          return;
        }
        capture(ANALYTICS_EVENTS.sessionEdited);
        if (data.mode === 'edit') {
          if (shell === 'modal') {
            router.back();
            router.refresh();
          } else {
            router.push(sessionHref(editingId));
          }
          return;
        }
        // Reopened from the saved state: back to it, saying the rest was added.
        setBaseline(values);
        setSaved((current) => (current ? { ...current, added: true } : current));
        setStage('saved');
        return;
      }

      const result = await runAction('session_log', () => logSessionAction({ values, useGrace }));
      if (!result.ok) {
        const view = 'view' in result ? result.view : undefined;
        const rideCounted = 'rideCounted' in result ? result.rideCounted === true : false;
        if (view?.kind === 'wall') {
          setWall({ grace: view.grace, rideCounted });
          setStage('wall');
          return;
        }
        if (from === 'wall') {
          // A grace save refused for another reason goes back to the form that can fix it.
          setStage('full');
        }
        show(
          result.message,
          view?.kind === 'field' ? view.field : null,
          from === 'wall' ? 'full' : from,
        );
        return;
      }

      capture(ANALYTICS_EVENTS.sessionLogged, { form: formKind, has_clip: result.hasClip });
      if (useGrace) capture(ANALYTICS_EVENTS.sessionGraceUsed, { plan: data.plan });
      if (result.ride.changed) {
        capture(ANALYTICS_EVENTS.rideLogged, {
          rides_this_week: result.ride.ridesThisWeek,
          week_banked: result.ride.ridesThisWeek >= result.ride.target,
        });
      }
      const savedValues: SessionFormValues = { ...values, when: 'pick', pickedAt: result.pickedAt };
      setValues(savedValues);
      setBaseline(savedValues);
      setSaved({ sessionId: result.sessionId, ride: result.ride, form: formKind, added: false });
      setWall(null);
      setStage('saved');
      router.refresh();
    });
  };

  const openFresh = (section: FreshSection) => {
    if (!saved) return;
    setEditingId(saved.sessionId);
    focusSection.current = section;
    setStage('full');
  };

  const warning = data.mode === 'new' && !isEdit ? sessionQuotaWarning(data.quota) : null;

  /* --------------------------------------------------------- the stages -- */

  const discardAsk = confirming ? (
    <div className={styles.ask} role="alert">
      <span>Discard your changes?</span>
      <button type="button" className="btn ghost sm" onClick={close}>
        Discard
      </button>
      <button type="button" className="btn sm" onClick={() => setConfirming(false)} autoFocus>
        Keep editing
      </button>
    </div>
  ) : null;

  let body: ReactNode;
  let width = 940;
  let wide = true;

  if (stage === 'quick') {
    // 640, not 560 (§3.10, T50): the quick log's five feel faces and its spot
    // row had the narrowest modal in the product to sit in, and the faces were
    // the thing that gave. Same number the wall already uses.
    width = 640;
    wide = false;
    body = (
      <QuickLog
        data={data}
        values={values}
        errors={errors}
        errorLine={errorLine}
        warning={warning}
        pending={pending}
        onChange={update}
        onLog={() => submit(false)}
        onEscalate={escalate}
        onClose={requestClose}
        after={discardAsk}
      />
    );
  } else if (stage === 'saved' && saved) {
    width = 560;
    wide = false;
    body = (
      <SavedState
        ride={saved.ride}
        showPrompts={saved.form === 'quick' && !saved.added}
        added={saved.added}
        sessionId={saved.sessionId}
        onOpen={openFresh}
        onDone={close}
      />
    );
  } else if (stage === 'wall' && wall) {
    width = 640;
    wide = false;
    body = (
      <SessionWall
        data={data}
        grace={wall.grace}
        rideCounted={wall.rideCounted}
        pending={pending}
        errorLine={errorLine}
        onGrace={() => submit(true)}
        onClose={close}
      />
    );
  } else {
    body = (
      <FullForm
        data={data}
        values={values}
        errors={errors}
        isEdit={isEdit}
        onChange={update}
        step={step}
        onStep={setStep}
      />
    );
  }

  const fullHeader =
    stage === 'full' ? (
      <FormHeader
        title={isEdit ? 'Edit session' : 'Log a session'}
        sub={data.mode === 'edit' ? data.dateTitle : data.stamp}
        // The header's button follows the footer's: Next until the last step,
        // where it saves. Two primaries that said different things would be a
        // form arguing with itself.
        saveLabel={lastStep ? 'Save' : 'Next'}
        pending={pending}
        onSave={() => (lastStep ? submit(false) : next())}
        onClose={requestClose}
      />
    ) : null;

  const fullFooter =
    stage === 'full' ? (
      <div className={styles.footInner}>
        {errorLine ? (
          <p className={styles.errorLine} role="alert">
            {errorLine}
          </p>
        ) : null}
        {discardAsk}
        {!confirming ? (
          <div className={styles.footRow}>
            {data.mode === 'edit' && data.deleteInfo ? (
              <>
                <button
                  type="button"
                  className={`btn ghost sm ${styles.deleteBtn}`}
                  onClick={() => setDeleting(true)}
                  disabled={pending}
                >
                  Delete session
                </button>
                <span className={styles.footNote}>Tricks you moved up stay where they are</span>
              </>
            ) : warning ? (
              <span className={styles.footNote}>{warning}</span>
            ) : null}
            <span className={styles.footSpacer} />
            <button
              type="button"
              className={`btn ghost ${styles.cancelBtn}`}
              onClick={requestClose}
              disabled={pending}
            >
              Cancel
            </button>
            {/*
              Next / Save (§3.10). The last step saves; the two before it move
              on, taking their own problems with them rather than storing them
              up for the end.
            */}
            <button
              type="button"
              className={`btn ${styles.saveBtn}`}
              onClick={() => (lastStep ? submit(false) : next())}
              disabled={pending}
            >
              {pending ? 'Saving…' : lastStep ? (isEdit ? 'Save changes' : 'Save session') : 'Next'}
            </button>
          </div>
        ) : null}
      </div>
    ) : null;

  const deleteDialog =
    deleting && data.sessionId && data.deleteInfo ? (
      <DeleteSessionDialog
        session={{
          id: data.sessionId,
          spotName: data.deleteInfo.spotName,
          dateLabel: data.deleteInfo.dateLabel,
        }}
        onClose={() => setDeleting(false)}
        onDeleted={() => {
          router.replace(sessionsHref());
          router.refresh();
        }}
      />
    ) : null;

  if (shell === 'modal') {
    return (
      <div className={wide ? styles.fullHost : styles.quickHost}>
        <Modal
          onClose={close}
          onRequestClose={requestClose}
          width={width}
          label={
            stage === 'full'
              ? isEdit
                ? 'Edit session'
                : 'Log a session'
              : stage === 'wall'
                ? 'Session limit'
                : stage === 'saved'
                  ? 'Session logged'
                  : 'Rode just now'
          }
          footer={fullFooter}
        >
          {fullHeader}
          {body}
        </Modal>
        {deleteDialog}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div
        className={`${styles.panel} ${wide ? styles.panelWide : styles.panelNarrow}`}
        role="region"
        aria-label={stage === 'full' ? (isEdit ? 'Edit session' : 'Log a session') : undefined}
      >
        {fullHeader}
        {body}
        {fullFooter ? <div className={styles.pageFoot}>{fullFooter}</div> : null}
      </div>
      {deleteDialog}
    </div>
  );
}
