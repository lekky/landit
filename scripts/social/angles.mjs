/**
 * What goes out on a given day, and which one of it.
 *
 * Two decisions live here and both are deterministic: the **angle** comes from
 * the weekday, and the **candidate** within that angle comes from a draw seeded
 * by the date. Same date and same history always give the same post, so a dry
 * run tells you exactly what will be published — and a workflow that retries
 * cannot produce a different card.
 *
 * Every function here is pure. The data arrives already fetched (`sources.mjs`)
 * so the choosing can be unit-tested without a network.
 */

import { daysSince } from './queue.mjs';
import { config } from './config.mjs';

/** Monday is 1. The week is a rotation, which is what the owner asked for. */
const BY_WEEKDAY = {
  1: 'challenge',
  2: 'trick-of-the-week',
  3: 'spot-of-the-week',
  4: 'events-weekend',
  5: 'sticker-drop',
  6: 'feature',
  0: 'feature',
};

export const ANGLES = [
  'challenge-new',
  'challenge-last-week',
  'trick-of-the-week',
  'spot-of-the-week',
  'events-weekend',
  'sticker-drop',
  'feature',
];

/** The three sports take turns on the trick and sticker posts. */
const SPORTS = ['scooter', 'skate', 'bmx'];

export function weekdayOf(date) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** Whole days from `date` to `to`, both calendar dates. */
export function daysBetween(date, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
}

/**
 * The angle for a date.
 *
 * Monday is the only one that reads the data: a challenge fortnight opens on
 * some Mondays and not others, so the Monday in between says "last week to log
 * it" instead. If neither applies — a gap in the schedule — Monday falls back
 * to a feature post rather than printing nothing.
 */
export function angleForDate(date, { starting = [], running = [] } = {}) {
  const base = BY_WEEKDAY[weekdayOf(date)];
  if (base !== 'challenge') return base;
  if (starting.length > 0) return 'challenge-new';
  const [live] = running;
  if (live && daysBetween(date, live.ends.slice(0, 10)) <= 7) return 'challenge-last-week';
  return 'feature';
}

/**
 * Which sport this date's trick or sticker post belongs to.
 *
 * Monday-aligned deliberately. The epoch was a Thursday, so dividing the
 * timestamp by a week puts the boundary mid-week — and Tuesday's trick would
 * then be one sport while Friday's sticker, in the same week to anyone reading
 * the feed, was another.
 */
export function sportForDate(date) {
  const days = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  return SPORTS[Math.floor((days + 3) / 7) % SPORTS.length];
}

/** A small deterministic generator, seeded by a string. */
export function seeded(seed) {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return function next() {
    hash += 0x6d2b79f5;
    let t = hash;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pick one candidate, with the feed's memory applied.
 *
 * A `key` that has been used inside `cooldown.key` days is blocked outright — a
 * trick should not come round twice in a year. A `subject` used recently is
 * damped rather than blocked, so a spot in the same town can still appear if
 * the pool is thin. If everything is blocked the raw weights come back: a
 * quiet pool must still produce a post.
 */
export function pickCandidate(candidates, { history, date }) {
  if (candidates.length === 0) return null;

  const weigh = (candidate) => {
    const keyAge = daysSince(history, 'key', candidate.key, date);
    if (keyAge < config.cooldown.key) return 0;
    const subjectAge = daysSince(history, 'subject', candidate.subject ?? candidate.key, date);
    return subjectAge < config.cooldown.subject
      ? (candidate.weight ?? 1) * 0.1
      : (candidate.weight ?? 1);
  };

  const weighted = candidates.map((candidate) => ({ candidate, weight: weigh(candidate) }));
  const usable = weighted.some(({ weight }) => weight > 0)
    ? weighted
    : candidates.map((candidate) => ({ candidate, weight: candidate.weight ?? 1 }));

  const total = usable.reduce((sum, { weight }) => sum + weight, 0);
  let roll = seeded(date)() * total;
  for (const { candidate, weight } of usable) {
    roll -= weight;
    if (roll <= 0) return candidate;
  }
  return usable[usable.length - 1].candidate;
}

/**
 * The evergreen weekend posts. Each one is a fact about the product that stays
 * true, with its number read from the API at build time rather than written
 * here — the copy says "spots on the map", the count comes from the count.
 */
export const FEATURES = [
  { id: 'rookie-free', headline: 'Rookie is free', line: 'A free tier that is not a trial.' },
  {
    id: 'five-stages',
    headline: 'Five stages',
    line: 'Want it, trying it, landed it, landing it, every time.',
  },
  { id: 'stickers', headline: 'Earn stickers', line: 'One for every trick in the library.' },
  {
    id: 'spots',
    headline: 'Find a spot',
    line: 'Skateparks worldwide, on one map.',
    count: 'spots',
  },
  {
    id: 'events',
    headline: 'Ride out',
    line: 'Comps, jams and sessions near you.',
    count: 'events',
  },
  {
    id: 'library',
    headline: 'The library',
    line: 'Every trick, with tips that make sense.',
    count: 'tricks',
  },
];
