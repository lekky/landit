/**
 * One value, shared by every request this server process serves, refreshed in
 * the background once it is older than `ttlMs` (issue #393).
 *
 * Built for the spots map's point list: every live spot, the same for every
 * caller, and about four and a half seconds of PocketBase work to read at
 * thirty thousand rows. Reading it once per visitor made every map load wait
 * for it and put a full-table read on the shared box per visit; reading it once
 * every few minutes serves everyone from memory.
 *
 * **Stale while it refreshes.** Once the value is old, a caller still gets it at
 * once and a single read starts behind them, so only the very first request
 * after the server starts ever waits. Callers that arrive while a read is in
 * flight share that read rather than starting their own.
 *
 * **A failure is never cached.** A first read that fails rejects, and the next
 * caller tries again. A refresh that fails leaves the old value in place, so a
 * database blip does not empty the map, and the next caller tries again.
 *
 * Per process, in memory: the web app runs as one Node process, and a restart
 * (a deploy) starts it cold, which is the behaviour a deploy should have.
 */
export interface StaleCache<T> {
  /** The value: cached, or read now if there is none yet. */
  get(): Promise<T>;
  /** Forget the value, so the next `get` reads afresh. */
  clear(): void;
}

export interface StaleCacheOptions {
  /** How old the value may get before a `get` starts a refresh. */
  readonly ttlMs: number;
  /** The clock, for tests. */
  readonly now?: () => number;
}

export function staleWhileRevalidate<T>(
  load: () => Promise<T>,
  { ttlMs, now = Date.now }: StaleCacheOptions,
): StaleCache<T> {
  let value: { readonly data: T; readonly at: number } | null = null;
  let pending: Promise<T> | null = null;

  const refresh = (): Promise<T> => {
    pending ??= load().then(
      (data) => {
        value = { data, at: now() };
        pending = null;
        return data;
      },
      (error: unknown) => {
        pending = null;
        throw error;
      },
    );
    return pending;
  };

  return {
    get() {
      if (!value) return refresh();
      if (now() - value.at >= ttlMs) refresh().catch(() => {});
      return Promise.resolve(value.data);
    },
    clear() {
      value = null;
    },
  };
}
