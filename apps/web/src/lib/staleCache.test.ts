import { describe, expect, it } from 'vitest';

import { staleWhileRevalidate } from './staleCache';

/** A loader that counts its calls and answers with the call number, or fails on demand. */
function loader() {
  const state = { calls: 0, fail: false };
  const load = async (): Promise<number> => {
    state.calls += 1;
    if (state.fail) throw new Error('database down');
    return state.calls;
  };
  return { state, load };
}

/** Let a background refresh settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('staleWhileRevalidate', () => {
  it('reads once, however many callers arrive together', async () => {
    const { state, load } = loader();
    const cache = staleWhileRevalidate(load, { ttlMs: 1000, now: () => 0 });
    expect(await Promise.all([cache.get(), cache.get(), cache.get()])).toEqual([1, 1, 1]);
    expect(state.calls).toBe(1);
  });

  it('serves from memory while the value is fresh', async () => {
    let clock = 0;
    const { state, load } = loader();
    const cache = staleWhileRevalidate(load, { ttlMs: 1000, now: () => clock });
    await cache.get();
    clock = 999;
    expect(await cache.get()).toBe(1);
    expect(state.calls).toBe(1);
  });

  it('answers with the old value at once when it is stale, and refreshes behind it', async () => {
    let clock = 0;
    const { state, load } = loader();
    const cache = staleWhileRevalidate(load, { ttlMs: 1000, now: () => clock });
    await cache.get();
    clock = 1000;
    // Two callers on a stale value: both answered from memory, one refresh between them.
    expect(await Promise.all([cache.get(), cache.get()])).toEqual([1, 1]);
    await settle();
    expect(state.calls).toBe(2);
    expect(await cache.get()).toBe(2);
  });

  it('never caches a failed first read', async () => {
    const { state, load } = loader();
    const cache = staleWhileRevalidate(load, { ttlMs: 1000, now: () => 0 });
    state.fail = true;
    await expect(cache.get()).rejects.toThrow('database down');
    state.fail = false;
    expect(await cache.get()).toBe(2);
  });

  it('keeps the old value when a refresh fails, and tries again next time', async () => {
    let clock = 0;
    const { state, load } = loader();
    const cache = staleWhileRevalidate(load, { ttlMs: 1000, now: () => clock });
    await cache.get();
    clock = 5000;
    state.fail = true;
    expect(await cache.get()).toBe(1);
    await settle();
    expect(await cache.get()).toBe(1);
    await settle();
    state.fail = false;
    expect(await cache.get()).toBe(1);
    await settle();
    expect(await cache.get()).toBe(4);
  });

  it('reads afresh after clear', async () => {
    const { state, load } = loader();
    const cache = staleWhileRevalidate(load, { ttlMs: 1000, now: () => 0 });
    await cache.get();
    cache.clear();
    expect(await cache.get()).toBe(2);
    expect(state.calls).toBe(2);
  });
});
