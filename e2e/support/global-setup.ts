import { TRICKS } from '@landit/core';

import { seedLibrary } from './seed-library';
import { seedSpots } from './seed-spots';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

/**
 * Compile the heaviest routes once, before any test's 30s clock is running.
 *
 * Under Turbopack a route is compiled on its first request, and the trick page
 * — the biggest dynamic route in the app, over a 259-trick library — did not
 * finish inside one test's `page.goto` budget while several local workers
 * competed for the same dev server. Thirteen tests in five files went red at
 * once on a branch that touched none of them (issue #322); on a slow CI runner
 * the same thing landed on `/` and burned twelve of the job's twenty minutes in
 * retries. A fetch here pays the compile once, outside anybody's timeout.
 *
 * Best effort on purpose: a warm-up that fails is a slower suite, not a broken
 * one, so nothing here throws.
 */
async function warm(paths: readonly string[]): Promise<void> {
  for (const path of paths) {
    try {
      await fetch(`${BASE_URL}${path}`, { signal: AbortSignal.timeout(180_000) });
    } catch (error) {
      process.stderr.write(`warm-up of ${path} failed: ${String(error)}
`);
    }
  }
}

/**
 * Seed the e2e database once, before any worker starts.
 *
 * **Why this is a global setup and not a `beforeAll`** (issue #68). Three spec
 * files need the trick library, and each used to ask for it in its own
 * `beforeAll`. `fullyParallel` with `workers: undefined` gives a local run one
 * worker per core, so those three hooks fired at the same moment against an
 * empty database: every one of them read zero tricks, every one of them decided
 * to seed, and they collided. The failure that came back was
 * `403 Only superusers can perform this action` from inside `seed()` — which is
 * a lie about the cause, since the fixture superuser is fine and the library did
 * in fact get written. Re-running passed, because by then the short-circuit at
 * the top of `seedLibrary` returned early for everybody.
 *
 * That made exactly one run per new worktree untrustworthy: the first one, which
 * is the run a session uses to decide whether its change is sound, and the
 * failures landed in files the session had not touched. CI never saw it —
 * `workers: 1` there means the hooks were already serialised.
 *
 * Playwright runs `webServer` entries as plugins during setup and global setups
 * after them, so PocketBase is listening by the time this is called. There is no
 * second caller left to race: the specs no longer seed, they assume.
 */
export default async function globalSetup(): Promise<void> {
  await seedLibrary();
  // The spots screen reads a collection with no client path to `live`, so the
  // same trap applies to it: an unseeded `spots` makes every assertion about
  // the map and the list pass by finding nothing (T13).
  await seedSpots();

  const trick = TRICKS.find((t) => t.isLive) ?? TRICKS[0];
  await warm(['/', `/library/${trick.id}`]);
}
