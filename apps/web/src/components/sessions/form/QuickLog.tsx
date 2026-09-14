'use client';

import { SESSION_FEELS, type SessionField } from '@landit/core';
import { FeelFace, Icon, SegmentedPicker } from '@landit/ui-web';
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
    props.onChange({ spotId: next.id, eventId: next.id === values.spotId ? values.eventId : '' });
    setPickedHere(true);
    setSearching(false);
  };

  return (
    <div className={styles.quick}>
      <span className={styles.grab} aria-hidden="true" />
      <div className={styles.quickHead}>
        <span className={styles.quickTitle}>Rode just now</span>
        <span className={styles.quickStamp}>{data.stamp}</span>
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
            <span className={styles.quickSpotName}>{spot ? spot.name : 'Pick where you rode'}</span>
            <span className={styles.spotSub}>
              {spot ? (
                <>
                  {origin} · <span className={styles.touchWord}>tap</span>
                  <span className={styles.clickWord}>click</span> to change
                </>
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
          onClose={() => setSearching(false)}
        />
      ) : null}
    </div>
  );
}
