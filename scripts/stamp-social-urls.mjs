#!/usr/bin/env node
/**
 * Point each queued post at the card that was just committed.
 *
 * Every network pulls the image from a public URL rather than accepting an
 * upload — Buffer's API cannot upload at all — so the card has to be reachable
 * before the post is placed. The URL is pinned to the **commit SHA** rather
 * than the branch name: a `…/social/images/x.jpg` URL is CDN-cached for around
 * five minutes, which on the launch run meant a stale image being served to
 * Instagram after a re-render.
 *
 *   node scripts/stamp-social-urls.mjs --sha=<commit> --repo=owner/name
 */

import { config } from './social/config.mjs';
import { readQueue, writeQueue } from './social/queue.mjs';

const argument = (name) => {
  const found = process.argv.find((value) => value.startsWith(`--${name}=`));
  return found?.slice(name.length + 3);
};

const sha = argument('sha');
const repo = argument('repo');
if (!sha || !repo) {
  console.error('need --sha=<commit> and --repo=owner/name');
  process.exit(1);
}

const queue = await readQueue();
let stamped = 0;

for (const post of queue.posts) {
  if (post.image?.url) continue;
  const name = post.image.file.split(/[\\/]/).pop();
  post.image.url = `https://raw.githubusercontent.com/${repo}/${sha}/images/${name}`;
  stamped += 1;
}

if (stamped > 0) await writeQueue(queue);
console.log(`stamped ${stamped} post(s) with ${sha.slice(0, 8)} → ${config.paths.queue}`);
