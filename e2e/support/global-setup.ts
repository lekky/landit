import { seedLibrary } from './seed-library';
import { seedSpots } from './seed-spots';

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
}
