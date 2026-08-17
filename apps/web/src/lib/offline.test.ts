import { isCacheablePage } from '@landit/core';
import { describe, expect, it } from 'vitest';

import { ROUTES, riderHref, trickHref, joinHref, legalHref } from './routes';

/**
 * The offline cache allowlist, checked against the routes the product actually
 * has.
 *
 * The predicate and its own unit tests live in `@landit/core`
 * (`offline.ts`), which cannot import this app. What that leaves untested there
 * is the failure this file is for: **a later wave adds a screen, nobody thinks
 * about the cache, and it turns up on a rider's device.** Every destination in
 * `ROUTES` goes through the predicate here, and the expected answer is written
 * out in full — so adding a route turns this red until somebody has decided
 * which side of plan §2.3 the new screen is on.
 *
 * It is in `apps/web` and not in `e2e/` because it is an assertion about a pure
 * function over a constant, and a browser would add nothing to it. See
 * `apps/web/vitest.config.ts` on why that list is kept short.
 */

describe('the offline cache allowlist, over every route the app has', () => {
  it('keeps exactly the library, one trick and the rider’s own progress', () => {
    const cacheable = Object.values(ROUTES).filter(isCacheablePage);

    expect(cacheable.sort()).toEqual(['/library', '/progress']);
  });

  it('refuses every parameterised destination except a trick page', () => {
    // The href builders are the other half of `ROUTES`: a route that takes a
    // parameter is not in that object at all, so filtering it would miss them.
    expect(isCacheablePage(trickHref('tailwhip'))).toBe(true);

    expect(isCacheablePage(riderHref('kaia'))).toBe(false);
    expect(isCacheablePage(joinHref('ABC123'))).toBe(false);
    expect(isCacheablePage(legalHref('privacy'))).toBe(false);
  });

  it('cannot be walked out of with a slug full of slashes', () => {
    // `trickHref` percent-encodes, so a slug carrying its own path separators
    // stays **one** segment and the answer stays "a trick page" — which is the
    // safe answer, because the server has no such trick and the worker only
    // ever keeps a 200. The unsafe reading would be the encoding failing and
    // the path becoming `/library/../../account`, so this pins the encoding as
    // much as the predicate.
    const href = trickHref('tailwhip/../../account');

    expect(href).toBe('/library/tailwhip%2F..%2F..%2Faccount');
    expect(href.split('/').filter(Boolean)).toHaveLength(2);
    expect(isCacheablePage(href)).toBe(true);
  });
});
