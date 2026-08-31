import { describe, expect, it } from 'vitest';

import { geolocationPermission } from './useHereOnce';

/**
 * The one part of `useHereOnce` a browser test cannot reach.
 *
 * `/spots` reads a position on load only when the browser already grants it
 * (plan §6.4 standard 10, as amended 2026-08-30) — so everything rests on this
 * function answering `'granted'` when, and only when, that is true. The cases
 * that matter are the ones no CI browser produces: Safari, which has a
 * `permissions` object but does not know `'geolocation'` as a name and rejects
 * or throws; and any browser without the API at all. Both must answer
 * `'unknown'`, because the caller treats `'unknown'` as "wait for a press" and
 * an optimistic guess there is a permission dialog in front of a child.
 */
describe('geolocationPermission', () => {
  const nav = (query: (name: { name: string }) => unknown) =>
    ({ permissions: { query } }) as unknown as Pick<Navigator, 'permissions'>;

  it('reports what the browser says', async () => {
    for (const state of ['granted', 'prompt', 'denied'] as const) {
      await expect(geolocationPermission(nav(async () => ({ state })))).resolves.toBe(state);
    }
  });

  it('asks about geolocation and nothing else', async () => {
    const asked: string[] = [];
    await geolocationPermission(
      nav(async ({ name }) => {
        asked.push(name);
        return { state: 'granted' };
      }),
    );
    expect(asked).toEqual(['geolocation']);
  });

  it('says unknown when there is no Permissions API', async () => {
    await expect(geolocationPermission(undefined)).resolves.toBe('unknown');
    await expect(
      geolocationPermission({} as unknown as Pick<Navigator, 'permissions'>),
    ).resolves.toBe('unknown');
  });

  it('says unknown when the browser refuses the question', async () => {
    // Safari, both ways round: a rejected promise and a synchronous throw.
    await expect(
      geolocationPermission(nav(() => Promise.reject(new TypeError('unsupported')))),
    ).resolves.toBe('unknown');
    await expect(
      geolocationPermission(
        nav(() => {
          throw new TypeError('unsupported');
        }),
      ),
    ).resolves.toBe('unknown');
  });
});
