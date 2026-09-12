import { describe, expect, it } from 'vitest';

import { isCacheableAsset, isCacheablePage, isImmutableAsset } from './offline';

/**
 * An allowlist is only worth testing on the things it must **refuse**, so most
 * of what follows is the no side.
 *
 * The test that stops a *future* screen joining the list by accident cannot
 * live here: the list of routes the product has is `apps/web/src/lib/routes.ts`,
 * and this package may not import the app. It lives beside that file instead,
 * as `apps/web/src/lib/offline.test.ts`, and walks every route through these
 * same functions.
 */

describe('isCacheablePage', () => {
  it('keeps the three read screens plan §2.3 promises', () => {
    expect(isCacheablePage('/library')).toBe(true);
    expect(isCacheablePage('/library/tailwhip')).toBe(true);
    expect(isCacheablePage('/progress')).toBe(true);
  });

  it('treats a trailing slash as the same screen', () => {
    expect(isCacheablePage('/library/')).toBe(true);
    expect(isCacheablePage('/progress/')).toBe(true);
    expect(isCacheablePage('/library/tailwhip/')).toBe(true);
  });

  it('refuses anything that names another rider, or a rider at all', () => {
    // Guarantee 1 is enforced by the API rules, not here — but a profile that
    // resolved once should not then be readable from a device's disk by whoever
    // picks the phone up next.
    expect(isCacheablePage('/riders/kaia')).toBe(false);
    expect(isCacheablePage('/crew')).toBe(false);
    expect(isCacheablePage('/coach')).toBe(false);
    expect(isCacheablePage('/account')).toBe(false);
    expect(isCacheablePage('/admin')).toBe(false);
    expect(isCacheablePage('/admin/riders')).toBe(false);
  });

  it('refuses the dashboard, whose numbers go stale rather than old', () => {
    expect(isCacheablePage('/home')).toBe(false);
    expect(isCacheablePage('/')).toBe(false);
  });

  it('does not sweep in a deeper route somebody adds under a trick', () => {
    expect(isCacheablePage('/library/tailwhip/clips')).toBe(false);
    expect(isCacheablePage('/library/tailwhip/anything/at/all')).toBe(false);
  });

  it('is not fooled by a path that merely starts with an allowed one', () => {
    expect(isCacheablePage('/libraryish')).toBe(false);
    expect(isCacheablePage('/progressive')).toBe(false);
  });

  it('refuses API routes and server-function targets outright', () => {
    expect(isCacheablePage('/api/health')).toBe(false);
    expect(isCacheablePage('/api/stripe/webhook')).toBe(false);
  });

  it('refuses the offline page itself, which is served from the worker', () => {
    // Not a rule so much as a fact worth pinning: the fallback is precached by
    // name at install, so letting the navigation handler cache it again would
    // mean two copies of it with different lifetimes.
    expect(isCacheablePage('/offline')).toBe(false);
  });
});

describe('isCacheableAsset', () => {
  it('keeps hashed build output, the avatars and the app icons', () => {
    expect(isCacheableAsset('/_next/static/chunks/main-abc123.js')).toBe(true);
    expect(isCacheableAsset('/_next/static/css/9f8e7d.css')).toBe(true);
    expect(isCacheableAsset('/avatars/helmet-land.png')).toBe(true);
    expect(isCacheableAsset('/icons/icon-512.png')).toBe(true);
    expect(isCacheableAsset('/manifest.webmanifest')).toBe(true);
  });

  it('refuses anything whose URL can stay the same while its content changes', () => {
    expect(isCacheableAsset('/_next/image?url=%2Favatars%2Fbolt.png')).toBe(false);
    expect(isCacheableAsset('/_next/data/build/library.json')).toBe(false);
    expect(isCacheableAsset('/api/health')).toBe(false);
  });

  it('refuses a path that only looks like one of the directories', () => {
    expect(isCacheableAsset('/_next/staticky/x.js')).toBe(false);
    expect(isCacheableAsset('/avatars-of-doom/x.png')).toBe(false);
    expect(isCacheableAsset('/icons')).toBe(false);
  });
});

describe('isImmutableAsset', () => {
  it('trusts hashed build output, which changes URL when it changes bytes', () => {
    expect(isImmutableAsset('/_next/static/chunks/main-abc123.js')).toBe(true);
    expect(isImmutableAsset('/_next/static/css/9f8e7d.css')).toBe(true);
  });

  /**
   * The regression #247 left behind: the app icons, the avatars and the manifest
   * all keep their paths across releases, so none of them may be answered from
   * disk while there is a network to ask. Cache-first on `/icons/` is what kept
   * showing the owner the pre-logo placeholder three weeks after it was deleted.
   */
  it('does not trust an asset whose URL survives a change to its content', () => {
    expect(isImmutableAsset('/icons/icon-192.png')).toBe(false);
    expect(isImmutableAsset('/icons/icon-maskable-512.png')).toBe(false);
    expect(isImmutableAsset('/avatars/helmet-land.png')).toBe(false);
    expect(isImmutableAsset('/manifest.webmanifest')).toBe(false);
  });

  it('is narrower than the store rule, never wider', () => {
    // Anything trusted must also be storable, or the worker would be trusting a
    // cache entry it never writes.
    for (const path of ['/_next/static/chunks/a.js', '/icons/icon-512.png', '/api/health']) {
      if (isImmutableAsset(path)) expect(isCacheableAsset(path)).toBe(true);
    }
  });

  it('refuses a path that only looks hashed', () => {
    expect(isImmutableAsset('/_next/staticky/x.js')).toBe(false);
    expect(isImmutableAsset('/_next/image?url=%2Favatars%2Fbolt.png')).toBe(false);
  });
});
