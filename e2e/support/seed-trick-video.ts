import { TRICKS, isTrickLocked, tricksFor } from '@landit/core';

import { SUPERUSER_EMAIL, SUPERUSER_PASSWORD } from './fixtures';
import { POCKETBASE_URL, ensureSuperuser } from './seed-library';

/**
 * Put a staff-picked tutorial on one trick in the e2e database (T34).
 *
 * **Without this the whole spec would pass by finding nothing.** The video
 * columns are database-only on purpose — they are not in the canonical `TRICKS`
 * data and `seed()` never writes them, so that a seed run cannot revert a
 * curation pass (issue #273). The consequence for the e2e database is that
 * *every* trick arrives with no video, the panel never renders anywhere, and
 * "the panel is absent on a trick with no video" is true of a page that could
 * not draw one under any circumstances. That is LESSONS §5's silent pass
 * exactly: the interesting assertions are only worth something once one trick
 * in the database actually has a video.
 *
 * So this writes one, through the superuser API — the same door the staff
 * portal uses, so the tricks hook runs and the id is parsed on the way in.
 *
 * Called from `global-setup.ts`, once, before any worker starts, never from a
 * spec. Idempotent: a database that already carries it is left alone.
 */

/**
 * The two tricks the spec works with, picked here so the fixture and the
 * assertions cannot disagree about which one has a video.
 *
 * Both are free scooter tricks, so a signed-out visitor gets the whole page
 * rather than the locked one, and they are taken in the library's own order so
 * the pair is stable across runs rather than whatever `find` happened to hit.
 */
const FREE_SCOOTER = tricksFor('scooter', TRICKS).filter((t) => !isTrickLocked(t, 'rookie'));

/** The one that gets the tutorial. */
export const VIDEO_TRICK = FREE_SCOOTER[0]!;

/** The one that must show no panel at all, and no trace that a panel exists. */
export const NO_VIDEO_TRICK = FREE_SCOOTER[1]!;

/** A real YouTube id. Never fetched — the player is mounted, never played. */
export const TRICK_VIDEO_ID = 'dQw4w9WgXcQ';
export const TRICK_VIDEO_TITLE = 'How to land it, step by step';
export const TRICK_VIDEO_CHANNEL = 'Land The Trick Tests';

async function superuserToken(): Promise<string> {
  // The e2e instance may have no superuser at all on a fresh worktree; the
  // library seed mints the fixture one, and this makes sure of it before
  // authenticating rather than reading a 400 as a broken database.
  ensureSuperuser();

  const response = await fetch(`${POCKETBASE_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: SUPERUSER_EMAIL, password: SUPERUSER_PASSWORD }),
  });
  if (!response.ok) throw new Error(`PocketBase said ${response.status} to a superuser auth.`);
  return ((await response.json()) as { token: string }).token;
}

/** Give `slug` the fixture tutorial. Throws rather than warning if it does not take. */
export async function seedTrickVideo(slug: string): Promise<void> {
  const token = await superuserToken();

  const found = await fetch(
    `${POCKETBASE_URL}/api/collections/tricks/records?perPage=1&filter=${encodeURIComponent(
      `slug='${slug}'`,
    )}`,
    { headers: { authorization: token } },
  );
  if (!found.ok) throw new Error(`PocketBase said ${found.status} to a tricks read.`);
  const row = ((await found.json()) as { items: { id: string; video_id?: string }[] }).items[0];
  if (!row)
    throw new Error(`No trick with slug ${slug} to put a video on — is the library seeded?`);
  if (row.video_id === TRICK_VIDEO_ID) return;

  const saved = await fetch(`${POCKETBASE_URL}/api/collections/tricks/records/${row.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: token },
    body: JSON.stringify({
      video_id: TRICK_VIDEO_ID,
      video_title: TRICK_VIDEO_TITLE,
      video_channel: TRICK_VIDEO_CHANNEL,
    }),
  });
  if (!saved.ok) {
    throw new Error(`PocketBase refused the fixture video: ${saved.status} ${await saved.text()}`);
  }
}
