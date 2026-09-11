#!/usr/bin/env node
/**
 * Record what actually reached Buffer.
 *
 * Pass only the dates that were placed. Anything left out stays in the queue
 * for next time, and a partial success still logs, so tomorrow does not repeat
 * today's subject. The history log is what the cooldowns read — it is state,
 * not a receipt, which is why it is committed rather than printed.
 *
 *   node scripts/confirm-social-post.mjs --dates=2026-09-14,2026-09-15
 */

import { confirm, readHistory, readQueue, writeHistory, writeQueue } from './social/queue.mjs';

const found = process.argv.find((value) => value.startsWith('--dates='));
const dates = found?.slice('--dates='.length).split(',').filter(Boolean) ?? [];

if (dates.length === 0) {
  console.error('need --dates=YYYY-MM-DD[,YYYY-MM-DD]');
  process.exit(1);
}

const [queue, history] = await Promise.all([readQueue(), readHistory()]);
const result = confirm(queue, history, dates);

if (result.placed.length === 0) {
  console.error(`none of those dates were in the queue: ${dates.join(', ')}`);
  process.exit(1);
}

await Promise.all([writeQueue(result.queue), writeHistory(result.history)]);

console.log(
  `confirmed ${result.placed.length}: ${result.placed.map((post) => post.date).join(', ')}`,
);
if (result.queue.posts.length > 0) {
  console.log(`still queued: ${result.queue.posts.map((post) => post.date).join(', ')}`);
}
