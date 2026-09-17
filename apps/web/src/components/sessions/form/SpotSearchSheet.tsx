'use client';

import { SESSION_LIMITS, distanceKm } from '@landit/core';
import { Modal } from '@landit/ui-web';
import { useEffect, useId, useMemo, useState } from 'react';

import { runActionOr } from '@/lib/runAction';
import { fetchSpotNames, fetchSpotPoints } from '@/lib/spotsFetch';
import { mergePoints, type SpotNamesBody, type SpotPointsBody } from '@/lib/spotsWire';
import { useHereOnce } from '@/lib/useHereOnce';

import styles from './form.module.css';
import type { FormSpot } from './types';

const SHOWN = 20;

/**
 * The spot picker behind "Change". **Not designed** — the handoff lists it
 * under "To decide" — so it is kept plain: a search over every live spot, the
 * rider's recent spots when the box is empty, and "Near me".
 *
 * It reuses the spots screen's two halves (`/api/spots/points` and
 * `/api/spots/names`) rather than a new endpoint, and the position rules are
 * `useHereOnce`'s, unchanged (plan §6.4 standard 10): a position is read only on
 * the rider's press, or silently when their browser already grants it; the
 * ordering happens here in the browser over the compact points; nothing sends
 * or stores it; and while it is held the indicator says so, with Turn off.
 */
export function SpotSearchSheet(props: {
  recent: readonly FormSpot[];
  onPick: (spot: FormSpot) => void;
  /**
   * Keep the place as words, because the map does not have it (owner, Rachid,
   * 2026-09-17, in chat: "need a 'custom' or can't find it and let them type
   * free text, and free text ones obviously don't link to a page after").
   */
  onName: (name: string) => void;
  /** What the rider typed last time, so re-opening the sheet does not lose it. */
  named: string;
  onClose: () => void;
}) {
  const here = useHereOnce({ resumeWhenGranted: true });
  const [points, setPoints] = useState<SpotPointsBody | null>(null);
  const [names, setNames] = useState<SpotNamesBody | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  /** `null` until the rider asks to name the place themselves. */
  const [custom, setCustom] = useState<string | null>(null);
  const inputId = useId();
  const customId = useId();

  useEffect(() => {
    let live = true;
    void runActionOr<SpotPointsBody | string>('spots_points', fetchSpotPoints, (m) => m).then(
      (body) => {
        if (!live) return;
        if (typeof body === 'string') setError(body);
        else setPoints(body);
      },
    );
    void runActionOr<SpotNamesBody | string>('spots_names', fetchSpotNames, (m) => m).then(
      (body) => {
        if (!live) return;
        if (typeof body === 'string') setError(body);
        else setNames(body);
      },
    );
    return () => {
      live = false;
    };
  }, []);

  const merged = useMemo(() => (points ? mergePoints(points, names) : null), [points, names]);

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!merged) return [];
    let list = merged.spots;
    if (q.length >= 2) {
      if (!merged.named) return [];
      list = list.filter(
        (s) => s.name.toLowerCase().includes(q) || s.town.toLowerCase().includes(q),
      );
    } else if (!here.point) {
      return [];
    }
    if (here.point) {
      const point = here.point;
      return list
        .map((s) => ({ s, km: distanceKm(point, s) }))
        .sort((a, b) => a.km - b.km)
        .slice(0, SHOWN);
    }
    return list.slice(0, SHOWN).map((s) => ({ s, km: null as number | null }));
  }, [merged, q, here.point]);

  const choose = (s: { id: string; name: string; town: string; lat: number; lng: number }) =>
    props.onPick({ id: s.id, name: s.name, town: s.town, lat: s.lat, lng: s.lng });

  const showRecent = q.length < 2 && !here.point;

  /*
   * "Can't find it?" — the way out of a search that cannot succeed.
   *
   * 36,391 spots is a lot of skateparks and still not every wall, bank and car
   * park a rider actually rides, and until now the form simply refused to save
   * without one: the only route was to submit the place as a new spot and wait
   * for it to be approved, which is right for somewhere other riders should
   * find and far too much ceremony for "behind the leisure centre".
   *
   * It is offered under the results rather than above them, because it is the
   * answer to "none of these", and it takes what the rider already typed in the
   * search box as its starting text — they have usually just typed the name.
   */
  const typedName = (custom ?? props.named ?? '').trim() || query.trim();

  return (
    <Modal onClose={props.onClose} width={520} title="Where did you ride?">
      <div className={styles.sheet}>
        <label htmlFor={inputId} className={styles.srOnly}>
          Search spots
        </label>
        <input
          id={inputId}
          type="search"
          className={styles.input}
          placeholder="Search by spot or town"
          autoComplete="off"
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
        />

        {here.state === 'on' ? (
          <div className={styles.hereOn} role="status">
            <span>Using your location to sort these. It stays on this device.</span>
            <button type="button" className={styles.miniBtn} onClick={here.forget}>
              Turn off
            </button>
          </div>
        ) : (
          <div className={styles.hereRow}>
            <button
              type="button"
              className={styles.miniBtn}
              onClick={here.ask}
              disabled={here.state === 'asking'}
            >
              {here.state === 'asking' ? 'Finding you…' : 'Near me'}
            </button>
            {here.state === 'refused' ? <span className={styles.hint}>{here.message}</span> : null}
          </div>
        )}

        {error ? (
          <p className={styles.errorLine} role="alert">
            {error}
          </p>
        ) : null}

        <div className={styles.sheetList}>
          {showRecent ? (
            props.recent.length ? (
              <>
                <div className={styles.label}>Your recent spots</div>
                {props.recent.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={styles.sheetRow}
                    onClick={() => choose(s)}
                  >
                    <span className={styles.quickSpotName}>{s.name}</span>
                    <span className={styles.spotSub}>{s.town}</span>
                  </button>
                ))}
              </>
            ) : (
              <p className={styles.hint}>Type a spot or a town, or press Near me.</p>
            )
          ) : !merged || (q.length >= 2 && !merged.named) ? (
            <p className={styles.hint}>Loading spots…</p>
          ) : results.length ? (
            results.map(({ s, km }) => (
              <button
                key={s.id}
                type="button"
                className={styles.sheetRow}
                onClick={() => choose(s)}
              >
                <span className={styles.quickSpotName}>{s.name || 'Unnamed spot'}</span>
                <span className={styles.spotSub}>
                  {s.town}
                  {km !== null ? ` · ${km < 10 ? km.toFixed(1) : Math.round(km)} km` : ''}
                </span>
              </button>
            ))
          ) : (
            <p className={styles.hint}>No spot by that name. Try the town it is in.</p>
          )}
        </div>

        {/*
          The way out when the map does not have the place (owner, 2026-09-17).

          A disclosure rather than a permanent field: naming a place yourself is
          the exception, and a text box sitting under every search would invite
          it over the spot that has a page, a map pin and other riders' sessions
          on it. Opening it carries whatever is already in the search box across,
          because by this point the rider has usually typed the name twice.
        */}
        {custom === null ? (
          <button
            type="button"
            className={styles.customOpen}
            onClick={() => setCustom(props.named || query.trim())}
          >
            Can&rsquo;t find it? Type where it was
          </button>
        ) : (
          <div className={styles.customBox}>
            <label htmlFor={customId} className={styles.label}>
              Where was it?
            </label>
            <input
              id={customId}
              className={styles.input}
              placeholder="The bank behind the leisure centre"
              maxLength={SESSION_LIMITS.spotNameMax}
              value={custom}
              autoFocus
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                if (typedName) props.onName(typedName);
              }}
            />
            <p className={styles.hint}>
              Just a name on your session — it gets no page, and nobody else sees it unless you
              share the session.
            </p>
            <div className={styles.customActions}>
              <button type="button" className={styles.miniBtn} onClick={() => setCustom(null)}>
                Back to search
              </button>
              <button
                type="button"
                className="btn sm"
                disabled={!typedName}
                onClick={() => props.onName(typedName)}
              >
                Use this name
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
