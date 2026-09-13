#!/usr/bin/env node
/**
 * Load the automatic tutorial picks (#462) into a PocketBase instance.
 *
 *   pnpm --filter @landit/db video:import --dry-run   # say what would change
 *   pnpm --filter @landit/db video:import             # the local dev instance
 *   pnpm --filter @landit/db video:import --url https://…
 *
 * **High-confidence picks go live; the rest arrive switched off** (Rachid,
 * 2026-09-13, in chat). Every row is written with `video_source = 'auto'`,
 * which the staff portal shows as "Not checked" and can filter to, because
 * nobody watched any of these — they were matched from a search result's title
 * and channel. A staff member pressing "Mark checked" is what upgrades one.
 *
 * **It never overwrites a human.** A trick whose video a person chose or
 * confirmed (`video_source = 'staff'`) is left exactly as it is, and so is one
 * a person switched off. Re-running is therefore safe and is the intended way
 * to apply new picks: the pass can be extended and re-imported without undoing
 * a single staff decision. Nothing here is part of `seed`, deliberately — a
 * seed run must not be able to revert curation (issue #273, plan §7 T35).
 *
 * **This is not a deploy script.** Pointing it at production is a deliberate
 * act with the credentials to match; build sessions do not do it (`CLAUDE.md`,
 * "never touch the production box").
 */
import process from 'node:process';

import { createSuperuserClient } from '../src/clients.ts';
import { records } from '../src/collections.ts';
import { pickStartsHidden } from '../src/video-picks.ts';
import { VIDEO_PICKS } from '../src/video-picks.data.ts';

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const dryRun = process.argv.includes('--dry-run');
const pb = await createSuperuserClient(flag('url') ? { url: flag('url') } : {});

const trickRows = await records(pb, 'tricks').list({
  fields: 'id,slug,video_id,video_source,video_hidden,video_thumb',
});
const bySlug = new Map(trickRows.map((row) => [row.slug, row]));

let live = 0;
let held = 0;
let kept = 0;
let missing = 0;

for (const pick of VIDEO_PICKS) {
  const row = bySlug.get(pick.slug);

  if (!row) {
    console.error(`no such trick: ${pick.slug}`);
    missing += 1;
    continue;
  }

  // A person's decision outranks the pass, in both directions: a video they
  // chose, and a video they switched off. This is the line that makes the
  // import safe to run again after somebody has done a review sweep.
  if (row.video_source === 'staff') {
    kept += 1;
    continue;
  }

  const hidden = pickStartsHidden(pick);

  if (dryRun) {
    console.log(
      `${pick.slug}: ${hidden ? 'hold back' : 'go live'} — ${pick.title} (${pick.channel})`,
    );
  } else {
    await records(pb, 'tricks').update(row.id, {
      video_id: pick.videoId,
      video_title: pick.title,
      video_channel: pick.channel,
      video_hidden: hidden,
      video_source: 'auto',
      video_off_reason: '',
      // Only when the video actually changed. A stored frame belongs to the id
      // it was fetched for, so keeping it across a swap would show the previous
      // video's first frame under the new one's title — but clearing it on
      // every run would re-download the whole catalogue each time.
      ...(row.video_id === pick.videoId ? {} : { video_thumb: null }),
    });
  }

  if (hidden) held += 1;
  else live += 1;
}

console.log(
  `\n${dryRun ? 'Would import' : 'Imported'} ${live + held} pick(s): ` +
    `${live} live, ${held} held back for checking, ` +
    `${kept} left alone because staff had already chosen them` +
    (missing ? `, ${missing} skipped for having no such trick` : '') +
    '.',
);
