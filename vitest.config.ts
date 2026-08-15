import { defineConfig } from 'vitest/config';

/**
 * Each package owns its own Vitest config so that a session can change its
 * test environment (jsdom for `ui-web`, a live PocketBase for `db`) without
 * touching a file another session is also editing.
 *
 * `apps/web` is deliberately absent: screens are covered by Playwright
 * (`playwright.config.ts`), not by unit tests.
 */
export default defineConfig({
  test: {
    projects: ['packages/*'],
  },
});
