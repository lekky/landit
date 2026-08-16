'use client';

import { SPORT_IDS, type SportId } from '@landit/core';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

/**
 * Which sport the rider is looking at, globally.
 *
 * "Sport switching is global state, not per page. Switching on any page
 * switches everywhere" (handoff, Interactions). The prototype held it in the
 * one big blob it kept in `localStorage`; here it is a context so any screen
 * can read it without threading it through props.
 *
 * The list of sports is whatever the rider tracks. Until T6 has a signed-in
 * rider that is every sport there is — `SPORT_IDS`, two today and three the day
 * T21 lands BMX. Nothing here counts them.
 *
 * The choice persists on the device. It is a display preference, not rider
 * data: `users.sports` records what someone rides, and this is only which tab
 * they were last looking at.
 */

const STORAGE_KEY = 'landit.sport';

/*
 * A `useSyncExternalStore` store rather than state plus an effect.
 *
 * The server has no `localStorage`, so the stored choice cannot be read during
 * render, and reading it in an effect and calling `setState` is both a
 * cascading render and a hydration mismatch waiting to happen. This reads
 * `null` on the server, the stored value on the client, and React reconciles
 * the two itself.
 *
 * No `storage` event listener: a second tab changing the sport is not worth the
 * wiring, and the value is per-device anyway.
 */
const listeners = new Set<() => void>();
let snapshot: string | null = null;
let read = false;

function getSnapshot(): string | null {
  if (!read) {
    try {
      snapshot = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Private mode, or storage disabled. The default sport is fine.
    }
    read = true;
  }
  return snapshot;
}

function getServerSnapshot(): string | null {
  return null;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function store(id: SportId): void {
  snapshot = id;
  read = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Not being able to remember the choice is not worth failing a click over.
  }
  for (const listener of listeners) listener();
}

type SportContextValue = {
  /** The sports available to switch between, in offer order. */
  sports: readonly SportId[];
  /** The one being looked at. Always a member of `sports`. */
  sport: SportId;
  setSport: (id: SportId) => void;
};

const SportContext = createContext<SportContextValue | null>(null);

export function SportProvider({
  children,
  sports = SPORT_IDS,
}: {
  children: ReactNode;
  /** Override for a rider who tracks a subset. Defaults to every sport. */
  sports?: readonly SportId[];
}) {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Derived, not stored: a rider who drops a sport, or a stale value left by an
  // older build, falls back to the first sport instead of showing an empty tab.
  const sport: SportId =
    stored && sports.includes(stored as SportId)
      ? (stored as SportId)
      : (sports[0] ?? SPORT_IDS[0]);

  const setSport = useCallback((id: SportId) => store(id), []);

  const value = useMemo(() => ({ sports, sport, setSport }), [sports, sport, setSport]);
  return <SportContext.Provider value={value}>{children}</SportContext.Provider>;
}

export function useSport(): SportContextValue {
  const value = useContext(SportContext);
  if (!value) {
    throw new Error('useSport must be used inside <SportProvider>, which AppShell sets up.');
  }
  return value;
}
