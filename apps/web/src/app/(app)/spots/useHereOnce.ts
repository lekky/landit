'use client';

import type { LatLng } from '@landit/core';
import { useCallback, useState } from 'react';

/**
 * The rider's own position, asked for once, kept nowhere.
 *
 * This hook is the whole of Children's code standard 10 on this screen
 * (plan §6.4), and every line of it is one of the four promises:
 *
 * - **Off by default and opt-in per use.** `ask()` is only ever called from a
 *   press. There is no auto-locate on mount, no "remember this" and no setting
 *   in the account screen that would turn it into a standing permission — the
 *   next visit starts at `off` again, whatever the browser remembers about the
 *   site's permission.
 * - **A visible indicator whenever it is live.** The state is `on` for exactly
 *   as long as a position is held, and the caller renders that; `forget()` is
 *   offered beside it, because an indicator you cannot act on is decoration.
 * - **It never persists across sessions.** React state and nothing else: no
 *   `localStorage`, no `sessionStorage`, no cookie, no query parameter. A
 *   reload is `off`.
 * - **The position is never sent to the server.** It is used to sort a list and
 *   to draw one dot; no action, no fetch and no PocketBase write ever receives
 *   it. We store the spot's location, never the rider's.
 *
 * `getCurrentPosition`, deliberately, and not `watchPosition`: the product needs
 * "how far is this from me" once, and a watch is a live tracking session held
 * open on a child's device for as long as the tab is. `maximumAge` is left at
 * the default so nothing is served out of a cache the rider did not know about,
 * and `enableHighAccuracy` stays off — a mile-scale distance does not need GPS,
 * and asking for it is both slower and more precise about a child than the
 * feature warrants.
 */

export type HerePermission = 'off' | 'asking' | 'on' | 'refused';

export interface HereOnce {
  readonly state: HerePermission;
  /** The point, while it is held. Null in every other state. */
  readonly point: LatLng | null;
  /** Why the browser said no, in words worth showing. */
  readonly message: string;
  readonly ask: () => void;
  readonly forget: () => void;
}

const REFUSALS: Readonly<Record<number, string>> = {
  1: 'Your browser said no to sharing your location. That is fine — the list still works.',
  2: 'Your device could not work out where it is right now.',
  3: 'That took too long. Try again in a moment.',
};

export function useHereOnce(): HereOnce {
  const [state, setState] = useState<HerePermission>('off');
  const [point, setPoint] = useState<LatLng | null>(null);
  const [message, setMessage] = useState('');

  const ask = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState('refused');
      setMessage('This browser cannot work out where it is.');
      return;
    }

    setState('asking');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPoint({ lat: position.coords.latitude, lng: position.coords.longitude });
        setMessage('');
        setState('on');
      },
      (error) => {
        setPoint(null);
        setMessage(REFUSALS[error.code] ?? 'We could not work out where you are.');
        setState('refused');
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }, []);

  const forget = useCallback(() => {
    setPoint(null);
    setMessage('');
    setState('off');
  }, []);

  return { state, point, message, ask, forget };
}
