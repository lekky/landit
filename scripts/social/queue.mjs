/**
 * The two JSON files the pipeline keeps between runs.
 *
 * `pending.json` is the hand-off: what CI built and a Buffer session has not
 * placed yet. `history.json` is what actually went out, and it is state rather
 * than a log — the cooldowns read it to stop the feed repeating itself, so it
 * has to survive a runner being recycled. Both live on the `social` branch,
 * which keeps a daily commit out of `main`.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { config } from './config.mjs';

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export const readQueue = () => readJson(config.paths.queue, { posts: [] });
export const writeQueue = (queue) => writeJson(config.paths.queue, queue);
export const readHistory = () => readJson(config.paths.history, { posts: [] });
export const writeHistory = (history) => writeJson(config.paths.history, history);

/**
 * Every date that already has a post, queued or sent.
 *
 * The build is idempotent because of this: running it twice on the same day
 * adds nothing the second time, so a workflow that retries cannot double-post.
 */
export function takenDates(queue, history) {
  return new Set([...queue.posts, ...history.posts].map((post) => post.date));
}

/**
 * Days since a value was last used, or Infinity if never.
 *
 * `field` is 'key', 'subject' or 'angle' — the three things that go on cooldown.
 * Comparing calendar dates rather than timestamps because a post is a day, not
 * a moment.
 */
export function daysSince(history, field, value, onDate) {
  const used = history.posts
    .filter((post) => post[field] === value)
    .map((post) => Date.parse(`${post.date}T00:00:00Z`));
  if (used.length === 0) return Infinity;
  const on = Date.parse(`${onDate}T00:00:00Z`);
  return Math.round((on - Math.max(...used)) / 86_400_000);
}

/**
 * Record what was placed. Called with only the dates that actually reached
 * Buffer: anything omitted stays queued, and a partial success still logs so
 * the next day does not repeat the same subject.
 */
export function confirm(queue, history, dates) {
  const wanted = new Set(dates);
  const placed = queue.posts.filter((post) => wanted.has(post.date));
  return {
    queue: { ...queue, posts: queue.posts.filter((post) => !wanted.has(post.date)) },
    history: {
      ...history,
      posts: [
        ...history.posts,
        ...placed.map(({ date, angle, key, subject }) => ({
          date,
          angle,
          key,
          subject,
        })),
      ],
    },
    placed,
  };
}
