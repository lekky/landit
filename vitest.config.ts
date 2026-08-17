import { defineConfig } from 'vitest/config';

/**
 * Each package owns its own Vitest config so that a session can change its
 * test environment (jsdom for `ui-web`, a live PocketBase for `db`) without
 * touching a file another session is also editing.
 *
 * `pocketbase` owns one too: its tests start the pinned PocketBase binary and
 * drive it over HTTP.
 *
 * `apps/web` joined in T15 with an `include` narrowed to `src/lib`. Screens are
 * still covered by Playwright (`playwright.config.ts`) and not by unit tests;
 * what the browser cannot reach is the Stripe webhook's signature check, which
 * is an assertion about a digest. See `apps/web/vitest.config.ts`.
 */
export default defineConfig({
  test: {
    projects: ['packages/*', 'pocketbase', 'apps/web'],
  },
});
