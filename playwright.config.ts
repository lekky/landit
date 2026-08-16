import { defineConfig, devices } from '@playwright/test';

import { SUPERUSER_EMAIL, SUPERUSER_PASSWORD } from './e2e/support/fixtures';

const PORT = 3000;
// `localhost`, not `127.0.0.1`: Next's dev server treats a different host as a
// cross-origin request and blocks its own dev resources.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

/**
 * The suite itself is T20. This config plus a handful of specs exists now so the
 * wiring is proven from the first commit rather than discovered late.
 *
 * **Two servers since T6.** The auth flows need a real PocketBase, so one is
 * started alongside Next on a port and a database of its own:
 *
 * - **8091, not 8090.** 8090 is what `pnpm pb:dev` uses, and attaching to a
 *   developer's own instance would mean e2e riders in the database they are
 *   working in — and, worse, assertions passing against whatever schema happens
 *   to be there. Same trap as port 3000, which LESSONS §1 was written about.
 * - **`.pb_e2e`, not `.pb_data`**, for the same reason (`POCKETBASE_DATA_DIR`).
 * - **`reuseExistingServer: false`** on the PocketBase entry even locally: a
 *   stale instance on 8091 is far more likely to be a leftover than something
 *   worth attaching to.
 *
 * The Next entry is told where PocketBase is, and an actual environment variable
 * beats a `.env.local`, so a developer's own URL does not leak into the run.
 */

const POCKETBASE_PORT = 8091;
const POCKETBASE_URL = `http://127.0.0.1:${POCKETBASE_PORT}`;

export default defineConfig({
  testDir: './e2e',
  /*
   * The trick library goes in once, here, rather than in each spec's
   * `beforeAll` — three of them raced each other on a fresh database and made
   * the first run in a new worktree fail for reasons no session had caused
   * (issue #68). `e2e/support/global-setup.ts` has the full account.
   */
  globalSetup: './e2e/support/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? // Pointing the run at a server you started yourself means you own both of
      // them — including PocketBase, via NEXT_PUBLIC_POCKETBASE_URL.
      undefined
    : [
        {
          command: 'node pocketbase/scripts/pocketbase.mjs serve',
          url: `${POCKETBASE_URL}/api/health`,
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            POCKETBASE_ADDR: `127.0.0.1:${POCKETBASE_PORT}`,
            POCKETBASE_DATA_DIR: '.pb_e2e',
          },
        },
        {
          command: 'pnpm --filter @landit/web dev',
          url: BASE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: {
            NEXT_PUBLIC_POCKETBASE_URL: POCKETBASE_URL,
            // T8's "I rode today" is a server action holding the superuser
            // client, so without these it fails softly and its two tests fail
            // on a button that never turns green (issue #62). CI has set them
            // since T8; locally nobody had, which made two more of a fresh
            // worktree's first-run failures nothing to do with the change under
            // test — the same complaint as issue #68, arriving by a different
            // route. The seed provisions exactly this pair in `.pb_e2e`.
            POCKETBASE_SUPERUSER_EMAIL: SUPERUSER_EMAIL,
            POCKETBASE_SUPERUSER_PASSWORD: SUPERUSER_PASSWORD,
            // The pre-launch gate (`apps/web/src/proxy.ts`) would serve the
            // holding page instead of the app. An unset flag already means
            // "live" outside production, so this is belt and braces — but the
            // suite should not depend on the default staying that way, and a
            // whole run failing on "expected the landing page, got Coming soon"
            // is an expensive way to rediscover a gate.
            LANDIT_SITE_LIVE: 'true',
          },
        },
      ],
});
