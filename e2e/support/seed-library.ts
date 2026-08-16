import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Reached by path rather than by package name: `@landit/db` is not a dependency
// of the root manifest (only `@landit/core` is), and adding one would mean a
// lockfile change for a single import in a test helper.
import { buildSeed, createSuperuserClient, seed } from '../../packages/db/src/index';

import { SUPERUSER_EMAIL, SUPERUSER_PASSWORD } from './fixtures';

/**
 * Put the trick library into the e2e PocketBase.
 *
 * Everything the suite tested before T7 was written *through the app* — a
 * sign-up creates its own rider — so the e2e database has never needed content
 * in it. The library screen is the first that reads a collection only staff can
 * write, and a locked-trick test against an empty `tricks` collection would
 * pass by finding nothing, which is the failure mode LESSONS §5 is about.
 *
 * Two constraints shape how this works:
 *
 * - **`plans` has to be seeded too.** The paywall hook resolves a rider's plan
 *   from that collection and fails *closed* when it is missing (plan §3), so an
 *   unseeded database refuses every trick to everyone — which would make the
 *   locked-trick assertions pass for entirely the wrong reason.
 * - **The seed needs a superuser, and the e2e instance may have none.**
 *   PocketBase only mints the first one from the CLI, so the CLI is what mints
 *   it, against the same data directory the running server is using. The
 *   credentials are the same fixed local pair `pocketbase/tests/instance.ts`
 *   uses: a throwaway database on a loopback port, and nothing here is a secret.
 *   Provisioning one is also what stops PocketBase treating the next start as a
 *   first run and opening its installer page in whoever's browser is to hand.
 *
 * **One caller, and it is `global-setup.ts`.** This is idempotent and skips
 * entirely when the library is already there, so a second run costs one HTTP
 * request — but idempotent is not the same as concurrency-safe, and the guard
 * below is a read then a write with a seed in between. Parallel callers all read
 * zero and all decide to seed (issue #68). Do not call this from a spec.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

/**
 * Where PocketBase is. The value `playwright.config.ts` hands the web server,
 * so a run driven by `PLAYWRIGHT_BASE_URL` seeds the instance that run is
 * actually using — set `NEXT_PUBLIC_POCKETBASE_URL` in that shell, as the
 * session-local instructions in `CLAUDE.md` do.
 */
export const POCKETBASE_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL ?? 'http://127.0.0.1:8091';

/** Matches `playwright.config.ts`'s `POCKETBASE_DATA_DIR`, and lets a local run override it. */
const dataDir = process.env.POCKETBASE_DATA_DIR ?? '.pb_e2e';

async function trickCount(): Promise<number> {
  const response = await fetch(`${POCKETBASE_URL}/api/collections/tricks/records?perPage=1`);
  if (!response.ok) throw new Error(`PocketBase said ${response.status} to a tricks read.`);
  const body = (await response.json()) as { totalItems?: number };
  return body.totalItems ?? 0;
}

/**
 * Mint the fixture superuser, if the instance has none.
 *
 * Exported because every seed helper needs it and only one of them may own it:
 * `seed-spots.ts` calls this rather than shelling out a second time.
 */
export function ensureSuperuser(): void {
  const result = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, 'pocketbase', 'scripts', 'pocketbase.mjs'),
      'superuser',
      'upsert',
      SUPERUSER_EMAIL,
      SUPERUSER_PASSWORD,
    ],
    { encoding: 'utf8', env: { ...process.env, POCKETBASE_DATA_DIR: dataDir } },
  );
  if (result.status !== 0) {
    throw new Error(
      `Could not create the e2e superuser in ${dataDir}:\n${result.stdout ?? ''}${result.stderr ?? ''}`,
    );
  }
}

/**
 * A superuser client against the e2e instance.
 *
 * Exported for the specs that have to write a collection with `createRule:
 * null` and cannot use the canonical seed — T12's, because the shipped
 * challenges carry fixed 2026 dates and "which week is live" has to be true on
 * the day the suite runs, not on the day the data was transcribed.
 */
export async function e2eSuperuser() {
  ensureSuperuser();
  return createSuperuserClient({
    url: POCKETBASE_URL,
    email: SUPERUSER_EMAIL,
    password: SUPERUSER_PASSWORD,
  });
}

export async function seedLibrary(): Promise<void> {
  if ((await trickCount()) > 0) return;

  const client = await e2eSuperuser();

  // What the content screens read. `stickers` joined in T10: the wall reads
  // that collection and `rider_stickers` is written by a hook that reads it
  // too, so against an empty one the whole screen renders "0 of 0" and every
  // assertion on it passes by finding nothing — the failure mode LESSONS §5 is
  // about. Spots, events and challenges belong to other tasks' tests. `seed`
  // writes the prerequisite edges either way, which the trick page's "built on"
  // pills need.
  const wanted = new Set(['plans', 'tricks', 'stickers']);
  await seed(client, { tables: buildSeed().tables.filter((t) => wanted.has(t.collection)) });

  if ((await trickCount()) === 0) throw new Error('The seed ran but the library is still empty.');
}
