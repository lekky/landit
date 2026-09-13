import { TRICKS, isTrickLocked, trickById } from '@landit/core';

import { SUPERUSER_EMAIL, SUPERUSER_PASSWORD } from './fixtures';
import { POCKETBASE_URL, ensureSuperuser } from './seed-library';

/**
 * Put a staff-picked tutorial on one trick in the e2e database (T35).
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
 * The two tricks the spec works with — **reserved for this fixture, and pinned
 * by slug on purpose.**
 *
 * The first version of this file took "the first free scooter trick", which is
 * `bunny-hop`. So does `video-links.spec.ts`, by the same expression. Giving it
 * a tutorial put a **second** Play button on that page, and three of that
 * spec's tests broke on the strict-mode collision — including the one that
 * proves nothing reaches Google before a press, which is the most load-bearing
 * assertion in the suite. Only CI could catch it (issue #450 stops e2e running
 * in a web session), and it cost a red run on the PR that added this.
 *
 * Two rules came out of it, and both are the reason for the shape below:
 *
 *  - **A fixture that writes to a shared database picks its rows by name, not
 *    by position.** An index is a claim about every other spec's choices, made
 *    silently and re-evaluated whenever the free-tier rules move.
 *  - **These two slugs are reserved.** Nothing else in `e2e/` may `goto` them,
 *    and this fixture may not move onto a trick something else does. BMX
 *    because every trick-page spec that picks by expression picks scooter, and
 *    these two specifically because no spec names them.
 *
 * Both are free, so a signed-out visitor gets the whole page rather than the
 * locked one — asserted below rather than assumed, since "free" is a rule that
 * has already moved once (T27's twenty per sport).
 */
function reserved(slug: string) {
  const trick = trickById(slug, TRICKS);
  if (!trick) {
    throw new Error(`The trick video fixture is pinned to ${slug}, which is no longer a trick.`);
  }
  if (isTrickLocked(trick, 'rookie')) {
    throw new Error(
      `The trick video fixture is pinned to ${slug}, which is now paid — a signed-out visitor ` +
        'would get the locked page and the spec would assert against the wrong screen.',
    );
  }
  return trick;
}

/** The one that gets the tutorial. */
export const VIDEO_TRICK = reserved('bmx-wheelie');

/** The one that must show no panel at all, and no trace that a panel exists. */
export const NO_VIDEO_TRICK = reserved('bmx-pump');

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
