'use client';

import type { LatLng } from '@landit/core';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The rider's own position, asked for on their say-so, kept nowhere.
 *
 * This hook is the whole of Children's code standard 10 on the screens that use
 * it (plan §6.4), and every line of it is one of the four promises:
 *
 * - **The browser is never prompted unless the rider presses for it.** `ask()`
 *   is only ever called from a press, and the one path that reads a position
 *   without a press (`resumeWhenGranted`, below) first checks that the browser
 *   would not prompt. There is no setting in the account screen that would turn
 *   this into a standing permission of ours.
 * - **A visible indicator whenever it is live.** The state is `on` for exactly
 *   as long as a position is held, and the caller renders that; `forget()` is
 *   offered beside it, because an indicator you cannot act on is decoration.
 * - **It never persists across sessions.** React state and nothing else: no
 *   `localStorage`, no `sessionStorage`, no cookie, no query parameter. What
 *   can survive a reload is the *browser's* permission, which is the rider's
 *   own record in their own settings — never a position, and never anything of
 *   ours.
 * - **The position is never sent to the server.** It is used to sort a list and
 *   to draw one dot; no action, no fetch and no PocketBase write ever receives
 *   it. We store the spot's location, never the rider's.
 *
 * `getCurrentPosition`, deliberately, and not `watchPosition`: the product needs
 * "how far is this from me" once, and a watch is a live tracking session held
 * open on a child's device for as long as the tab is. `enableHighAccuracy` stays
 * off — a mile-scale distance does not need GPS, and asking for it is both
 * slower and more precise about a child than the feature warrants.
 *
 * ## `maximumAge` (Rachid, 2026-09-12, in chat)
 *
 * **A fix the device took in the last minute is good enough.** This was `0` —
 * the default — which forbids the browser from answering out of its own cache
 * and makes every press wait for a brand new fix: one to ten seconds on a
 * phone, and the largest single part of the wait the owner reported as "Spots
 * takes way too long to pick the location". A minute of slack means a rider who
 * pressed "Near me" on `/events` and then opened `/spots` is answered
 * immediately, and a rider who has moved far enough in sixty seconds for it to
 * change which park is nearest was travelling too fast to be at one.
 *
 * The reason it was `0` — "nothing served out of a cache the rider did not know
 * about" — was about *our* caches, and this is not one. The position comes from
 * the browser's own store, on the rider's own device, put there by a reading
 * the rider allowed; none of the four promises above mentions it, and none of
 * them changes. We still hold it in state and nowhere else, still show it while
 * it is held, still drop it on navigation, and still never send it anywhere.
 *
 * ## `resumeWhenGranted` (Rachid, 2026-08-30, in chat)
 *
 * The original rule was stricter than the four promises above: the hook asked
 * again on every visit even when the rider had already told their browser yes,
 * for good. That made "sort by nearest" a tap a rider had to repeat on every
 * single visit to `/spots`, which is the request this option answers.
 *
 * **What it does not do is prompt.** With the option on, the hook asks the
 * Permissions API what the browser would do, and reads a position only when the
 * answer is already `granted` — a state only the rider can put their browser
 * into, in their own settings, on a previous press of `ask()`. `prompt` and
 * `denied` both mean nothing happens: no dialog appears in front of a child who
 * has not asked for one, which is the pattern standard 10 is aimed at, and the
 * "Near me" control is still there for them.
 *
 * Three details carry that promise:
 *
 * - **No Permissions API means no resume.** Safari does not implement
 *   `permissions.query` for `'geolocation'` — it rejects, or throws outright.
 *   The fallback there is the old behaviour (press-only), never a speculative
 *   `getCurrentPosition`, because on that browser a speculative call *is* the
 *   prompt. `geolocationPermission` below is the whole of that check and is
 *   unit-tested; it answers `'unknown'` rather than guessing.
 * - **A silent read never becomes a visible error.** A rider who pressed
 *   nothing is told nothing: a resume that fails leaves the state at `off` with
 *   the "Near me" control in place, rather than putting a refusal message on a
 *   screen in answer to a question nobody asked.
 * - **`forget()` wins any race.** The permission query is async, so a rider can
 *   press "Turn off" — or "Near me" — while it is still in flight; `stale`
 *   below drops the resume's result on the floor when they have.
 *
 * The indicator and its "Turn off" are unchanged and are what makes this
 * defensible: the rider is told, in the same words as before, that their
 * location is in use, and can end it in one press.
 */

export type HerePermission = 'off' | 'asking' | 'on' | 'refused';

/**
 * How old a position the browser already holds may be and still be handed over
 * rather than measured again. See the `maximumAge` note above.
 */
const MAX_FIX_AGE_MS = 60_000;

export interface HereOnce {
  readonly state: HerePermission;
  /** The point, while it is held. Null in every other state. */
  readonly point: LatLng | null;
  /** Why the browser said no, in words worth showing. */
  readonly message: string;
  /**
   * Whether the position in hand came from a standing browser permission rather
   * than a press on this visit. For the caller's copy and its counters — never
   * a reason to show less than the full indicator.
   */
  readonly resumed: boolean;
  /**
   * Whether a reading is in flight right now — a press, or the silent resume.
   *
   * **For work a screen can start before the position lands, and nothing else.**
   * `/spots` has to download every live spot's point before it can sort by
   * distance, and it used to wait for the position first, so a rider on a phone
   * paid for the fix and the download one after the other. Both start together
   * now, and this is the signal that lets them: it says a position is *coming*,
   * which is all the screen needs to know to begin.
   *
   * **It is deliberately not `state`.** `state` is what the rider is shown, and
   * the silent resume must not show them anything — a rider who pressed nothing
   * is told nothing, which is the promise that makes the resume defensible.
   * This is the part of the same fact that the screen may act on without
   * putting it on screen, which is why it is a separate field rather than a
   * fifth `HerePermission`.
   */
  readonly reading: boolean;
  readonly ask: () => void;
  readonly forget: () => void;
}

export interface HereOnceOptions {
  /**
   * Read the rider's position on mount **when, and only when, their browser
   * already grants it** — no dialog, and nothing at all on a browser that would
   * show one. Off unless a screen asks for it.
   */
  readonly resumeWhenGranted?: boolean;
}

const REFUSALS: Readonly<Record<number, string>> = {
  1: 'Your browser said no to sharing your location. That is fine — the list still works.',
  2: 'Your device could not work out where it is right now.',
  3: 'That took too long. Try again in a moment.',
};

/** What the browser reports, plus the honest answer when it reports nothing. */
export type GeolocationPermission = PermissionState | 'unknown';

/**
 * What would happen if we asked for a position right now.
 *
 * Split out from the hook and exported so it can be tested without a browser,
 * because the case that matters is the one no CI browser exercises: a
 * `permissions` object that exists but refuses `'geolocation'` as a name. Every
 * failure — no API, a name it does not know, a rejection, a synchronous throw —
 * answers `'unknown'`, and the caller treats `'unknown'` exactly as it treats
 * `'prompt'`: do nothing, wait for a press.
 */
export async function geolocationPermission(
  nav: Pick<Navigator, 'permissions'> | undefined,
): Promise<GeolocationPermission> {
  try {
    const status = await nav?.permissions?.query({ name: 'geolocation' as PermissionName });
    return status?.state ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export function useHereOnce({ resumeWhenGranted = false }: HereOnceOptions = {}): HereOnce {
  const [state, setState] = useState<HerePermission>('off');
  const [point, setPoint] = useState<LatLng | null>(null);
  const [message, setMessage] = useState('');
  const [resumed, setResumed] = useState(false);
  const [reading, setReading] = useState(false);

  /**
   * Bumped by every press and by unmount. The resume reads it before it starts
   * and again when it lands: a rider who acted while the permission query was
   * in flight has had the last word, and a stale answer must not overwrite it.
   */
  const generation = useRef(0);

  const read = useCallback((silent: boolean) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      // Silent means the rider asked for nothing, so they are told nothing.
      if (!silent) {
        setState('refused');
        setMessage('This browser cannot work out where it is.');
      }
      return;
    }

    const mine = generation.current;
    if (!silent) setState('asking');
    /*
     * Raised here rather than when the resume's permission query starts,
     * which is the difference between "a position is coming" and "we are
     * finding out whether one is allowed". A rider whose browser answers
     * `prompt` gets no reading at all, and must not have a megabyte of spot
     * points fetched on their behalf for a press they never made.
     */
    setReading(true);

    const settle = () => {
      if (generation.current === mine) setReading(false);
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        settle();
        if (generation.current !== mine) return;
        setPoint({ lat: position.coords.latitude, lng: position.coords.longitude });
        setMessage('');
        setResumed(silent);
        setState('on');
      },
      (error) => {
        settle();
        if (generation.current !== mine) return;
        setPoint(null);
        if (silent) return;
        setMessage(REFUSALS[error.code] ?? 'We could not work out where you are.');
        setState('refused');
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: MAX_FIX_AGE_MS },
    );
  }, []);

  const ask = useCallback(() => {
    generation.current += 1;
    read(false);
  }, [read]);

  const forget = useCallback(() => {
    generation.current += 1;
    setPoint(null);
    setMessage('');
    setResumed(false);
    setReading(false);
    setState('off');
  }, []);

  /*
   * The silent resume. In an effect and not during render, because it is a
   * browser question with an async answer — and because the server has no
   * answer to it at all. The first paint is therefore the same markup for
   * everybody (`off`, "Near me" showing) and the indicator replaces it a beat
   * later; that is a deliberate ordering, not a flash to be designed away, and
   * it is what keeps the screen hydration-safe (LESSONS §5).
   */
  useEffect(() => {
    if (!resumeWhenGranted) return;
    if (typeof navigator === 'undefined') return;

    const mine = generation.current;
    void geolocationPermission(navigator).then((permission) => {
      if (permission !== 'granted') return;
      if (generation.current !== mine) return;
      read(true);
    });

    // Unmounting counts as the last word: a resume that lands afterwards is
    // dropped rather than setting state on a screen the rider has left.
    return () => {
      generation.current += 1;
    };
  }, [resumeWhenGranted, read]);

  return { state, point, message, resumed, reading, ask, forget };
}
