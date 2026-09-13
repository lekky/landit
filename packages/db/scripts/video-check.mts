#!/usr/bin/env node
/**
 * The nightly tutorial liveness check (#463) — the half that talks to things.
 *
 *   YOUTUBE_API_KEY=… pnpm --filter @landit/db video:check
 *   YOUTUBE_API_KEY=… pnpm --filter @landit/db video:check --dry-run
 *   YOUTUBE_API_KEY=… pnpm --filter @landit/db video:check --url https://…
 *
 * Asks YouTube which curated tutorials still play, switches off the ones that
 * do not, and puts back the ones this job switched off that have come back. The
 * deciding is in `../src/video-check.ts` and is unit-tested without a network;
 * this file is the fetching, the writing and the summary.
 *
 * **What "switched off" means to a rider: nothing at all.** The trick page
 * renders no panel for a hidden video, which is the same page every uncurated
 * trick already shows. The worst this job can do while unattended is return a
 * trick to the state most of the library is in — which is why it is safe to let
 * it run on a schedule, and why it hides rather than clears the link.
 *
 * **Credentials come from the environment, never an argument**, so they do not
 * end up in a shell history or a process list. `YOUTUBE_API_KEY` is a YouTube
 * Data API v3 key from a Google Cloud project; without it this exits saying so
 * and writes nothing. Quota: 50 ids per call at one unit each, so the whole
 * 259-trick library is six units against a free 10,000 a day.
 *
 * **This is not a deploy script.** Pointing it at production is a deliberate
 * act with the credentials to match; build sessions do not do it (`CLAUDE.md`,
 * "never touch the production box").
 */
import process from 'node:process';

import { createSuperuserClient } from '../src/clients.ts';
import { records } from '../src/collections.ts';
import {
  videoCheckBatches,
  videoCheckChange,
  verdictsFor,
  type VideoCheckRow,
  type YouTubeVideoItem,
} from '../src/video-check.ts';

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const dryRun = process.argv.includes('--dry-run');
const apiKey = process.env.YOUTUBE_API_KEY?.trim();

if (!apiKey) {
  console.error(
    'No YOUTUBE_API_KEY in the environment, so nothing was checked and nothing was changed.\n' +
      'It is a YouTube Data API v3 key from a Google Cloud project — see docs/infrastructure.md.',
  );
  process.exit(1);
}

const pb = await createSuperuserClient(flag('url') ? { url: flag('url') } : {});

// Every trick that has a video at all, hidden or not: the hidden ones are
// exactly where a video that has come back would be found.
const trickRows = await records(pb, 'tricks').list({
  filter: 'video_id != ""',
  fields: 'id,slug,video_id,video_hidden,video_off_reason',
});

const rows: VideoCheckRow[] = trickRows.map((record) => ({
  id: record.id,
  slug: record.slug,
  videoId: record.video_id,
  hidden: Boolean(record.video_hidden),
  offReason: record.video_off_reason ?? '',
}));

if (rows.length === 0) {
  console.log('No curated tutorials yet, so there was nothing to check.');
  process.exit(0);
}

const byVideoId = new Map(rows.map((row) => [row.videoId, row]));
const batches = videoCheckBatches([...byVideoId.keys()]);

const items: YouTubeVideoItem[] = [];
for (const batch of batches) {
  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.searchParams.set('part', 'status');
  url.searchParams.set('id', batch.join(','));
  url.searchParams.set('key', apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    // A failed call is not evidence that any video is dead. Stopping without
    // writing is the only safe response: a 403 for an over-quota key would
    // otherwise read as "every id is missing" and hide the whole catalogue.
    console.error(
      `YouTube answered ${response.status} for a batch of ${batch.length}. Nothing was changed.`,
    );
    process.exit(1);
  }

  const body = (await response.json()) as { items?: YouTubeVideoItem[] };
  items.push(...(body.items ?? []));
}

const verdicts = verdictsFor([...byVideoId.keys()], items);
const checked = new Date().toISOString().replace('T', ' ').slice(0, 19);

const changes = rows
  .map((row) => {
    const verdict = verdicts.get(row.videoId);
    return verdict ? videoCheckChange(row, verdict) : null;
  })
  .filter((change) => change !== null);

for (const change of changes) {
  console.log(change.note);
}

if (dryRun) {
  console.log(
    `\nDry run: ${changes.length} change(s) across ${rows.length} tutorials, none written.`,
  );
  process.exit(0);
}

for (const change of changes) {
  await records(pb, 'tricks').update(change.id, {
    video_hidden: change.hidden,
    video_off_reason: change.offReason,
  });
}

// The stamp goes on every row that was asked about, not only the ones that
// changed, because "when did we last get an answer about this" is the question
// it exists to answer — and for a healthy catalogue that is every row and no
// changes at all.
for (const row of rows) {
  await records(pb, 'tricks').update(row.id, { video_checked: checked });
}

console.log(
  `\nChecked ${rows.length} tutorial(s) in ${batches.length} call(s): ` +
    `${changes.filter((c) => c.hidden).length} switched off, ` +
    `${changes.filter((c) => !c.hidden).length} back on.`,
);
