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

import { editSessionAction, logSessionAction } from './actions';
import styles from './form.module.css';
import { FormHeader, FullForm } from './FullForm';
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
  const [stage, setStage] = useState<Stage>(data.mode === 'new' && data.quick ? 'quick' : 'full');
  const [values, setValues] = useState<SessionFormValues>(data.initial);
  const [baseline, setBaseline] = useState<SessionFormValues>(data.initial);
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
    setStage('full');
  };

  const show = (message: string, field: SessionField | null, from: Stage) => {
    if (field) {
      setErrors({ [field]: message });
      // The quick log has three fields; a problem with any other opens the full form.
      if (from === 'quick' && !['spotId', 'feel', 'startedAt'].includes(field)) setStage('full');
    } else {
      setErrorLine(message);
    }
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
    width = 560;
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
      <FullForm data={data} values={values} errors={errors} isEdit={isEdit} onChange={update} />
    );
  }

  const fullHeader =
    stage === 'full' ? (
      <FormHeader
        title={isEdit ? 'Edit session' : 'Log a session'}
        sub={data.mode === 'edit' ? data.dateTitle : data.stamp}
        saveLabel={isEdit ? 'Save' : 'Save'}
        pending={pending}
        onSave={() => submit(false)}
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
            <button
              type="button"
              className={`btn ${styles.saveBtn}`}
              onClick={() => submit(false)}
              disabled={pending}
            >
              {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Save session'}
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
