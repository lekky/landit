'use client';

import type { SportId } from '@landit/core';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import {
  readScope,
  scopeOptions,
  scopeProperty,
  scopeSports,
  scopeStorageKey,
  type ScopeScreen,
  type SportScope,
} from '@/lib/sportScope';
import { useSport } from '@/providers/sport';

import styles from './shell.module.css';

/**
 * "Show: Your sport (Scooter)" — the one line under a list's header that says
 * which sports are in it (rethink §3.3, O1).
 *
 * **A dropdown, not a row of pills** (Rachid, 2026-09-16, in chat). The rows it
 * replaces were a multi-select over every sport, so a rider could ask for
 * "scooter and BMX"; O1 took that away on purpose. One sport is chosen once, in
 * the top bar, and a list either follows it, widens to everything, or is pointed
 * at one other sport by name. Three answers fit on one line at 320px where four
 * pills did not — which is the wrap in issue #465 — and a row that cannot
 * express a combination cannot disagree with the chip about what "your sport"
 * means.
 *
 * **The first option tracks the chip rather than copying it.** `'chip'` is
 * stored as the word, so a rider who switches sport in the top bar switches
 * this list with it and never finds a spots page still filtered to the sport
 * they rode last month. That is D5's promise — the sport is chosen once — and
 * it is why the stored value is not simply a sport id.
 *
 * **The choice is per screen and per device, and it is not rider data.** It
 * lives in `localStorage` under `landit.scope.<screen>`, the same standing the
 * sport chip's own choice has (`providers/sport.tsx`): which slice of a list
 * somebody was last looking at, not something about them. Nothing is written to
 * `users`, and nothing is sent to the server but the query itself.
 *
 * **The defaults follow the quality of the data** (O1): Spots opens on every
 * spot, because spot sport tags are thin and the 2026-09-12 decision to show
 * every spot stands; Events opens on the rider's own sport, because staff tag
 * every event. The screen passes its own default in, so neither is hidden here.
 */

/*
 * One store per screen key, `useSyncExternalStore` rather than state plus an
 * effect — the pattern `providers/sport.tsx` documents and for its reason.
 *
 * The server has no `localStorage`, so the stored choice cannot be read during
 * render; reading it in an effect and calling `setState` is a cascading render
 * and a hydration mismatch waiting to happen (LESSONS §3a: a mismatch does not
 * warn, it throws the tree away). This reads the screen's default on the server
 * and during hydration, the stored value immediately after, and React
 * reconciles the two itself.
 */
const stores = new Map<
  string,
  { value: string | null; read: boolean; listeners: Set<() => void> }
>();

function storeFor(key: string) {
  let store = stores.get(key);
  if (!store) {
    store = { value: null, read: false, listeners: new Set() };
    stores.set(key, store);
  }
  return store;
}

function subscribe(key: string, onChange: () => void): () => void {
  const store = storeFor(key);
  store.listeners.add(onChange);
  return () => {
    store.listeners.delete(onChange);
  };
}

function snapshot(key: string): string | null {
  const store = storeFor(key);
  if (!store.read) {
    try {
      store.value = window.localStorage.getItem(key);
    } catch {
      // Private mode, or storage disabled. The screen's default is fine.
    }
    store.read = true;
  }
  return store.value;
}

function remember(key: string, scope: SportScope): void {
  const store = storeFor(key);
  store.value = scope;
  store.read = true;
  try {
    window.localStorage.setItem(key, scope);
  } catch {
    // Not being able to remember a filter is not worth failing a change over.
  }
  for (const listener of store.listeners) listener();
}

export interface SportScopeState {
  /** The chosen scope, already reduced to something this build knows. */
  readonly scope: SportScope;
  /** What to filter by: a one-sport list, or empty for every sport. */
  readonly sports: readonly SportId[];
  /** The sport the chip is on, for the first option's words. */
  readonly chip: SportId;
  readonly setScope: (next: SportScope) => void;
}

/**
 * A screen's scope, and the setter that remembers it and counts the change.
 *
 * Separate from the component because the screen needs the *value* — it is the
 * query — several hundred lines before it draws the control, and threading it
 * back up through a callback would make the list's query depend on where the
 * row happened to be rendered.
 */
export function useSportScope(screen: ScopeScreen, fallback: SportScope): SportScopeState {
  const { sport: chip } = useSport();
  const key = scopeStorageKey(screen);

  const stored = useSyncExternalStore(
    useCallback((onChange: () => void) => subscribe(key, onChange), [key]),
    useCallback(() => snapshot(key), [key]),
    () => null,
  );
  const scope = readScope(stored, fallback);

  const setScope = useCallback(
    (next: SportScope) => {
      remember(key, next);
      /*
       * Catalogue facts only: which screen, and which of three fixed words.
       * Never the sport id behind an "other" choice — see `scopeProperty`, and
       * the catalogue entry that says the same thing.
       */
      capture(ANALYTICS_EVENTS.sportScopeSet, { screen, scope: scopeProperty(next) });
    },
    [key, screen],
  );

  const sports = useMemo(() => scopeSports(scope, chip), [scope, chip]);

  return { scope, sports, chip, setScope };
}

export function SportScopeSelect({
  state,
  everyLabel,
  label,
  className,
}: {
  readonly state: SportScopeState;
  /** The screen's words for "all" — "Every spot", "All sports". */
  readonly everyLabel: string;
  /** Accessible name for the control, e.g. "Show spots for". */
  readonly label: string;
  readonly className?: string;
}) {
  const options = useMemo(() => scopeOptions(state.chip, everyLabel), [state.chip, everyLabel]);

  return (
    <label className={`${styles.scopePick} ${className ?? ''}`.trim()}>
      <span className="lab">Show</span>
      <select
        className="cond"
        value={state.scope}
        onChange={(event) => state.setScope(event.target.value as SportScope)}
        aria-label={label}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
