#!/usr/bin/env node
/**
 * Build the next few days of posts: pick, render, queue.
 *
 * This is everything except placing them, which needs a Buffer session and so
 * belongs to `/social-schedule` (see `docs/social-posts.md`). Running it twice
 * is safe: a date that is already queued or already sent is skipped.
 *
 *   node scripts/build-social-post.mjs                 # today and tomorrow
 *   node scripts/build-social-post.mjs --days=3
 *   node scripts/build-social-post.mjs --date=2026-09-14
 *   node scripts/build-social-post.mjs --dry-run       # choose and print, render nothing
 */

import { mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { angleForDate, pickCandidate } from './social/angles.mjs';
import { altFor, captionFor, tiktokTitleFor } from './social/caption.mjs';
import { candidatesFor } from './social/candidates.mjs';
import { cardHtml } from './social/card.mjs';
import { config, PLATES } from './social/config.mjs';
import { readHistory, readQueue, takenDates, writeQueue } from './social/queue.mjs';
import { renderCard } from './social/render.mjs';
import * as sources from './social/sources.mjs';

const argument = (name, fallback) => {
  const found = process.argv.find((value) => value.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);

/** The dates this run covers. */
function datesToBuild() {
  const only = argument('date');
  if (only) return [only];
  const days = Number(argument('days', config.horizonDays));
  const start = Date.parse(`${sources.today()}T00:00:00Z`);
  return Array.from({ length: days }, (_, index) =>
    new Date(start + index * 86_400_000).toISOString().slice(0, 10),
  );
}

/**
 * Choose the day's post.
 *
 * The weekday decides the angle, but an angle with nothing behind it — a
 * weekend with no events anywhere — must not produce an empty card, so it falls
 * back to a feature post, which can always be built.
 */
async function chooseFor(date, history) {
  const [starting, running] = await Promise.all([
    sources.challengesStartingOn(date),
    sources.challengesRunningOn(date),
  ]);

  const wanted = angleForDate(date, { starting, running });
  for (const angle of [wanted, 'feature']) {
    const candidates = await candidatesFor(angle, date);
    const chosen = pickCandidate(candidates, { history, date });
    if (chosen) return chosen;
  }
  return null;
}

/**
 * The plate, inlined into the page.
 *
 * Chromium will not load a `file://` image into a page built with
 * `setContent`: that page has an opaque origin, the request is blocked without
 * an error, and the card renders as text on white with a broken-image icon in
 * the corner. A data URL has no origin to check.
 */
async function plateDataUrl(name) {
  const file = resolve(config.paths.plates, PLATES[name].file);
  return `data:image/jpeg;base64,${(await readFile(file)).toString('base64')}`;
}

async function main() {
  const [queue, history] = await Promise.all([readQueue(), readHistory()]);
  const already = takenDates(queue, history);
  const dryRun = flag('dry-run');
  const built = [];

  await mkdir(config.paths.out, { recursive: true });

  for (const date of datesToBuild()) {
    if (already.has(date)) {
      console.log(`${date}: already queued or sent, skipping`);
      continue;
    }

    const candidate = await chooseFor(date, history);
    if (!candidate) {
      console.log(`${date}: nothing to post`);
      continue;
    }

    const caption = captionFor(candidate, 'instagram');
    console.log(`${date}: ${candidate.angle} — ${candidate.key}`);
    if (dryRun) {
      console.log(caption.replace(/^/gm, '    '));
      continue;
    }

    const plateUrl = await plateDataUrl(candidate.plate);
    const file = join(config.paths.out, `${date}.jpg`);
    await renderCard(cardHtml(candidate, { plateUrl }), file);

    built.push({
      date,
      publishAt: `${date}T${config.postTime}:00`,
      angle: candidate.angle,
      key: candidate.key,
      subject: candidate.subject,
      alt: altFor(candidate),
      tiktokTitle: tiktokTitleFor(candidate),
      // `url` is filled by the workflow once the card is pushed to the `social`
      // branch: every network pulls the image from a public URL rather than
      // accepting an upload, and Buffer's API cannot upload at all.
      image: { file, url: null },
      groups: config.networks.map((network) => ({
        networks: [network],
        caption: captionFor(candidate, network),
      })),
    });
  }

  if (dryRun || built.length === 0) {
    console.log(dryRun ? 'dry run: nothing written' : 'nothing new to queue');
    return;
  }

  await writeQueue({
    timezone: config.timezone,
    updatedAt: new Date().toISOString(),
    posts: [...queue.posts, ...built],
  });
  console.log(`queued ${built.length} post(s) → ${config.paths.queue}`);
}

await main();
