import { describe, expect, it } from 'vitest';

import { GATED_ROUTES, PUBLIC_ROUTES } from './publicRoutes';
import { ROUTES } from './routes';

/**
 * The sitemap's one rule, checked: it advertises only pages a visitor can read.
 *
 * The failure this exists to stop is quiet. A gated route in the sitemap does
 * not break a build or a screen; it sends a crawler to a redirect, repeatedly,
 * and the only symptom is a Search Console report nobody is reading yet.
 */
describe('PUBLIC_ROUTES', () => {
  it('advertises nothing that sends a signed-out visitor to sign in', () => {
    for (const route of GATED_ROUTES) {
      expect(PUBLIC_ROUTES).not.toContain(route);
    }
  });

  it('lists no route twice', () => {
    expect(new Set(PUBLIC_ROUTES).size).toBe(PUBLIC_ROUTES.length);
  });

  it('carries the pages the product actually sells itself on', () => {
    // The landing page and the library are the whole point: the library is the
    // corpus, and it was unreachable to a crawler before this.
    expect(PUBLIC_ROUTES).toContain(ROUTES.home);
    expect(PUBLIC_ROUTES).toContain(ROUTES.library);
    expect(PUBLIC_ROUTES).toContain(ROUTES.plans);
  });

  it('keeps the two lists honest — nothing is in both', () => {
    const overlap = PUBLIC_ROUTES.filter((r) => GATED_ROUTES.includes(r));
    expect(overlap).toEqual([]);
  });

  it('only lists paths, so `metadataBase` and the sitemap agree on the host', () => {
    for (const route of PUBLIC_ROUTES) expect(route.startsWith('/')).toBe(true);
  });
});
