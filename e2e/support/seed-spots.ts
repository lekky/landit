// Reached by path rather than by package name, for the reason `seed-library.ts`
// gives: `@landit/db` is not a dependency of the root manifest.
import { buildSeed, createSuperuserClient, seed } from '../../packages/db/src/index';

import { SUPERUSER_EMAIL, SUPERUSER_PASSWORD } from './fixtures';
import { POCKETBASE_URL, ensureSuperuser } from './seed-library';

/**
 * Put the live spots into the e2e PocketBase (T13).
 *
 * **Without this the spots spec would pass by finding nothing.** `spots` has no
 * client create path to `live` — only staff and the seed write one — so against
 * a fresh e2e database the screen renders an empty list, and "every live spot is
 * on the map" is true of zero spots. That is LESSONS §1's data trap and §5's
 * silent pass in one: the assertions below are worth nothing unless the
 * collection has rows in it, and the local database a session has been clicking
 * through is not the database CI runs against.
 *
 * Called from `global-setup.ts`, once, before any worker starts — never from a
 * spec. The guard here is a read then a write, which is not concurrency-safe
 * (issue #68).
 */

async function liveSpotCount(): Promise<number> {
  const response = await fetch(
    `${POCKETBASE_URL}/api/collections/spots/records?perPage=1&filter=${encodeURIComponent("status='live'")}`,
  );
  if (!response.ok) throw new Error(`PocketBase said ${response.status} to a spots read.`);
  const body = (await response.json()) as { totalItems?: number };
  return body.totalItems ?? 0;
}

export async function seedSpots(): Promise<void> {
  if ((await liveSpotCount()) > 0) return;

  ensureSuperuser();
  const client = await createSuperuserClient({
    url: POCKETBASE_URL,
    email: SUPERUSER_EMAIL,
    password: SUPERUSER_PASSWORD,
  });

  await seed(client, {
    tables: buildSeed().tables.filter((table) => table.collection === 'spots'),
  });

  if ((await liveSpotCount()) === 0) {
    throw new Error('The seed ran but there are still no live spots.');
  }
}
