#!/usr/bin/env node
/**
 * Fetch the preview frame for every curated tutorial that has not got one.
 *
 *   pnpm --filter @landit/db video:thumbs
 *   pnpm --filter @landit/db video:thumbs --dry-run
 *   pnpm --filter @landit/db video:thumbs --url https://…
 *
 * Downloads each video's thumbnail from YouTube's image host **once, here on a
 * server**, and stores it on the trick. The trick page then draws a real frame
 * behind the play mark, served by our own PocketBase — no rider's browser ever
 * asks Google for it, which is the point (see `../src/video-thumbs.ts`).
 *
 * **No API key.** This is a plain image URL, not the Data API, so it works
 * before anybody has made a Google Cloud project — unlike `video:check`. Run it
 * after `video:import`, and on a schedule afterwards to pick up whatever staff
 * changed in the portal.
 *
 * **Nothing here decides what a rider sees.** A trick with no thumbnail renders
 * the drawn poster it always has, so a run that fetches nothing changes no
 * page. Failures are reported and skipped, never retried in a loop and never
 * stored half-written.
 *
 * **This is not a deploy script.** Pointing it at production is a deliberate
 * act with the credentials to match; build sessions do not do it (`CLAUDE.md`,
 * "never touch the production box").
 */
import process from 'node:process';

import { createSuperuserClient } from '../src/clients.ts';
import { records } from '../src/collections.ts';
import {
  needsThumb,
  thumbProblem,
  youtubeThumbSource,
  type ThumbRow,
} from '../src/video-thumbs.ts';

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const dryRun = process.argv.includes('--dry-run');
const pb = await createSuperuserClient(flag('url') ? { url: flag('url') } : {});

const trickRows = await records(pb, 'tricks').list({
  filter: 'video_id != ""',
  fields: 'id,slug,video_id,video_thumb',
});

const rows: ThumbRow[] = trickRows.map((record) => ({
  id: record.id,
  slug: record.slug,
  videoId: record.video_id,
  thumb: record.video_thumb ?? '',
}));

const wanted = rows.filter(needsThumb);

if (wanted.length === 0) {
  console.log(`All ${rows.length} curated tutorial(s) already have a preview frame.`);
  process.exit(0);
}

let stored = 0;
let failed = 0;

for (const row of wanted) {
  if (dryRun) {
    console.log(`${row.slug}: would fetch ${youtubeThumbSource(row.videoId)}`);
    continue;
  }

  try {
    const response = await fetch(youtubeThumbSource(row.videoId));
    const buffer = response.ok ? Buffer.from(await response.arrayBuffer()) : Buffer.alloc(0);

    const problem = thumbProblem({
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get('content-type'),
      bytes: buffer.byteLength,
    });

    if (problem) {
      console.error(`${row.slug}: ${problem}`);
      failed += 1;
      continue;
    }

    // The filename carries the video id so a stored frame can be told apart
    // from the video it belongs to by looking, without opening the image.
    const form = new FormData();
    form.append('video_thumb', new Blob([buffer], { type: 'image/jpeg' }), `${row.videoId}.jpg`);
    await records(pb, 'tricks').update(row.id, form as never);

    console.log(`${row.slug}: stored ${buffer.byteLength} bytes`);
    stored += 1;
  } catch (error) {
    // One unreachable image must not end the run: the rest of the catalogue
    // still wants its frames, and the trick that failed simply keeps the drawn
    // poster until the next run.
    console.error(`${row.slug}: ${error instanceof Error ? error.message : String(error)}`);
    failed += 1;
  }
}

console.log(
  dryRun
    ? `\nDry run: ${wanted.length} of ${rows.length} tutorial(s) need a preview frame.`
    : `\nStored ${stored} preview frame(s), ${failed} failed, ` +
        `${rows.length - wanted.length} already had one.`,
);
