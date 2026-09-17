'use client';

import { SESSION_FEELS, SPORTS, type SessionField } from '@landit/core';
import { FeelFace, Icon, SegmentedPicker, Tag } from '@landit/ui-web';
import { useState, type ReactNode } from 'react';

import type { SessionFormValues } from '@/lib/sessionForm';

import { ChevronRight, CloseGlyph, useKnownSpots } from './FullForm';
import styles from './form.module.css';
import { SpotSearchSheet } from './SpotSearchSheet';
import type { FormSpot, SessionFormData } from './types';

/**
 * The quick log (1d phone sheet, 2f desktop modal): when, where, how it felt,
 * "Log it". Three taps when the spot is already right. "Add tricks, clip and
 * notes →" opens the full form holding all three.
 */
export function QuickLog(props: {
  data: SessionFormData;
  values: SessionFormValues;
  errors: Partial<Record<SessionField, string>>;
  errorLine: string | null;
  warning: string | null;
  pending: boolean;
  onChange: (patch: Partial<SessionFormValues>) => void;
  onLog: () => void;
  onEscalate: () => void;
  onClose: () => void;
  after?: ReactNode;
}) {
  const { data, values } = props;
  const { spots, remember } = useKnownSpots(data);
  const [searching, setSearching] = useState(false);
  const [pickedHere, setPickedHere] = useState(false);
  const spot = spots.get(values.spotId);

  const origin = pickedHere
    ? 'Picked'
    : values.spotId && values.spotId === data.recentSpotIds[0] && !data.initial.eventId
      ? 'Your last spot'
      : values.spotId
        ? 'From the page you were on'
        : '';

  const pick = (next: FormSpot) => {
    remember(next);
    // A chosen spot clears anything typed: one answer to "where", not two.
    props.onChange({
      spotId: next.id,
      spotName: '',
      eventId: next.id === values.spotId ? values.eventId : '',
    });
    setPickedHere(true);
    setSearching(false);
  };

  /** A place the map does not have, typed in the sheet (owner, 2026-09-17). */
  const nameIt = (name: string) => {
    props.onChange({ spotId: '', spotName: name, eventId: '' });
    setPickedHere(true);
    setSearching(false);
  };

  return (
    <div className={styles.quick}>
      <span className={styles.grab} aria-hidden="true" />
      <div className={styles.quickHead}>
        {/*
          The words in one column, the Close in the other (owner, 2026-09-17:
          "log a session from homepage breaks a bit … the black header is
          malformed"). All four used to be siblings of one wrapping flex row, so
          at 375px the Close wrapped onto a line of its own and the bar became a
          tall black band with an X adrift in it. Two columns keep the X where a
          thumb expects it, and the words still wrap inside their own.
        */}
        <div className={styles.quickHeadText}>
          <span className={styles.quickTitle}>Rode just now</span>
          {/*
          The sport, as a `Tag` (rethink §3.10, T50).

          The quick log asks three questions and the sport is not one of them —
          it is taken from the top bar's chip and saved with the session, so
          until now the one thing a rider could not see before pressing "Log it"
          was which library the ride would land in. A tag states it without
          adding a fourth control: changing it is what "Add tricks, clip and
          notes →" is for.
        */}
          <Tag color={SPORTS[values.sport].color} className={styles.quickSport}>
            {SPORTS[values.sport].short}
          </Tag>
          <span className={styles.quickStamp}>{data.stamp}</span>
        </div>
        <button
          type="button"
          className={styles.quickClose}
          aria-label="Close"
          onClick={props.onClose}
        >
          <CloseGlyph />
        </button>
      </div>
      <div className={styles.quickBody}>
        <button type="button" className={styles.quickSpot} onClick={() => setSearching(true)}>
          <Icon name="map" size={22} style={{ color: '#ff5a1f' }} />
          <span className={styles.spotText}>
            {/*
              A spot from the map, or a place the rider typed because the map
              does not have it (owner, 2026-09-17). The typed one says so on its
              sub-line, because it is words rather than somewhere with a page.
            */}
            <span className={styles.quickSpotName}>
              {spot ? spot.name : values.spotName.trim() || 'Pick where you rode'}
            </span>
            <span className={styles.spotSub}>
              {spot ? (
                <>
                  {origin} · <span className={styles.touchWord}>tap</span>
                  <span className={styles.clickWord}>click</span> to change
                </>
              ) : values.spotName.trim() ? (
                'Not on the map — just a name'
              ) : (
                'Your spots and the map’s'
              )}
            </span>
          </span>
          <ChevronRight />
        </button>
        {props.errors.spotId ? (
          <p className={styles.fieldError} role="alert">
            {props.errors.spotId}
          </p>
        ) : null}

        <div>
          <div className={styles.label}>How was it</div>
          <SegmentedPicker
            label="How was it"
            options={SESSION_FEELS.map((f) => ({
              id: f.id,
              label: f.label,
              color: f.color,
              icon: <FeelFace feel={f.id} size={32} />,
            }))}
            value={values.feel}
            onChange={(feel) => props.onChange({ feel })}
            // As in the full form: the faces carry the feel's colour already.
            fill="soft"
            className={`${styles.seg} ${styles.faces} ${styles.quickFaces}`}
          />
          {props.errors.feel ? (
            <p className={styles.fieldError} role="alert">
              {props.errors.feel}
            </p>
          ) : null}
        </div>

        {props.errorLine ? (
          <p className={styles.errorLine} role="alert">
            {props.errorLine}
          </p>
        ) : null}
        {props.warning ? <p className={styles.warnLine}>{props.warning}</p> : null}

        <div className={styles.quickActions}>
          <button
            type="button"
            className={`btn ${styles.logBtn}`}
            onClick={props.onLog}
            disabled={props.pending}
          >
            {props.pending ? 'Logging…' : 'Log it'}
          </button>
          <button
            type="button"
            className={styles.escalate}
            onClick={props.onEscalate}
            disabled={props.pending}
          >
            Add tricks, clip and notes →
          </button>
          <span className={styles.escHint}>Esc to close</span>
        </div>
        {props.after}
      </div>

      {searching ? (
        <SpotSearchSheet
          recent={data.recentSpotIds.map((id) => spots.get(id)).filter((s): s is FormSpot => !!s)}
          onPick={pick}
          onName={nameIt}
          named={values.spotName}
          onClose={() => setSearching(false)}
        />
      ) : null}
    </div>
  );
}
