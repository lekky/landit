/**
 * Turning API rows into things that could be posted.
 *
 * A candidate is `{ angle, key, subject, plate, data }`. `key` is what the
 * cooldown blocks (this exact trick, this exact spot); `subject` is the looser
 * grouping it belongs to; `data` is exactly what the caption and the card need
 * and nothing else.
 *
 * This is the only file that both reads the API and touches the filesystem, so
 * everything downstream of it stays pure and testable.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { FEATURES, sportForDate } from './angles.mjs';
import * as sources from './sources.mjs';

/** Sticker art lives with the UI package; it is the same art the app prints. */
const STICKERS = 'packages/ui-web/assets/stickers';

/** Friday to Sunday of the week `date` falls in — "this weekend". */
export function weekendOf(date) {
  const day = new Date(`${date}T00:00:00Z`);
  const toFriday = (5 - day.getUTCDay() + 7) % 7;
  const friday = new Date(day.getTime() + toFriday * 86_400_000);
  const sunday = new Date(friday.getTime() + 2 * 86_400_000);
  return { from: friday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
}

/**
 * Up to four events, spread across countries.
 *
 * A weekend post that is four English comps is a worse post than one that shows
 * the sport is worldwide, so the first pass takes one per country and the
 * second fills any gap from what is left.
 */
export function spreadEvents(events, limit = 4) {
  const seen = new Set();
  const spread = [];
  for (const event of events) {
    if (spread.length >= limit) break;
    if (seen.has(event.country)) continue;
    seen.add(event.country);
    spread.push(event);
  }
  for (const event of events) {
    if (spread.length >= limit) break;
    if (!spread.includes(event)) spread.push(event);
  }
  return spread;
}

async function stickerDataUrl(slug) {
  try {
    const bytes = await readFile(join(STICKERS, `${slug}.png`));
    return `data:image/png;base64,${bytes.toString('base64')}`;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

/**
 * Every candidate for one angle on one date.
 *
 * Returns an empty array when the data is not there — a Thursday with no events
 * anywhere in the world, say. The caller falls back to another angle rather
 * than posting an empty card.
 */
export async function candidatesFor(angle, date) {
  switch (angle) {
    case 'challenge-new': {
      const [challenge] = await sources.challengesStartingOn(date);
      if (!challenge) return [];
      const { title, verb, goal, starts, ends } = challenge;
      return [
        {
          angle,
          key: `challenge:${starts.slice(0, 10)}`,
          subject: 'challenge',
          plate: 'challenge-new',
          data: { title, verb, goal, starts: starts.slice(0, 10), ends: ends.slice(0, 10) },
        },
      ];
    }

    case 'challenge-last-week': {
      const [challenge] = await sources.challengesRunningOn(date);
      if (!challenge) return [];
      const { title, verb, goal, starts, ends } = challenge;
      return [
        {
          angle,
          key: `challenge-ending:${ends.slice(0, 10)}`,
          subject: 'challenge',
          plate: 'challenge-last-week',
          data: { title, verb, goal, starts: starts.slice(0, 10), ends: ends.slice(0, 10) },
        },
      ];
    }

    case 'trick-of-the-week': {
      const sport = sportForDate(date);
      const { items } = await sources.tricks(sport);
      return items
        .filter((trick) => trick.tips?.trim())
        .map((trick) => ({
          angle,
          key: `trick:${trick.slug}`,
          subject: `trick:${trick.slug}`,
          plate: `trick-${sport}`,
          data: {
            name: trick.name,
            slug: trick.slug,
            sport,
            cat: trick.cat,
            diff: trick.diff,
            tips: trick.tips.trim(),
          },
        }));
    }

    case 'spot-of-the-week': {
      const { items } = await sources.featuredSpots();
      return items
        .filter((spot) => spot.town && spot.tags?.length > 0)
        .map((spot) => ({
          angle,
          key: `spot:${spot.slug}`,
          // The town, so two parks in one town do not arrive a fortnight apart.
          subject: `town:${spot.country}/${spot.town}`,
          plate: 'spot-of-the-week',
          data: {
            name: spot.name,
            slug: spot.slug,
            town: spot.town,
            country: spot.country,
            type: spot.type,
            tags: spot.tags,
            sports: spot.sports,
          },
        }));
    }

    case 'events-weekend': {
      const { from, to } = weekendOf(date);
      const { items } = await sources.eventsBetween(from, to);
      const events = spreadEvents(items);
      if (events.length === 0) return [];
      return [
        {
          angle,
          key: `events:${from}`,
          subject: 'events',
          plate: 'events-weekend',
          data: {
            events: events.map(({ name, slug, date: on, kind, town, country, sports }) => ({
              name,
              slug,
              date: on.slice(0, 10),
              kind,
              town,
              country,
              sports,
            })),
          },
        },
      ];
    }

    case 'sticker-drop': {
      const sport = sportForDate(date);
      const { items } = await sources.tricks(sport);
      const withArt = await Promise.all(
        items.map(async (trick) => ({ trick, art: await stickerDataUrl(trick.slug) })),
      );
      return withArt
        .filter(({ art }) => art)
        .map(({ trick, art }) => ({
          angle,
          key: `sticker:${trick.slug}`,
          subject: `trick:${trick.slug}`,
          plate: 'sticker-drop',
          data: { name: trick.name, slug: trick.slug, sport, stickerDataUrl: art },
        }));
    }

    case 'feature': {
      const totals = await sources.counts();
      return FEATURES.map((feature) => ({
        angle,
        key: `feature:${feature.id}`,
        subject: `feature:${feature.id}`,
        plate: 'did-you-know',
        data: {
          headline: feature.headline,
          line: feature.line,
          countLabel: feature.count ? countLabel(feature.count, totals) : null,
        },
      }));
    }

    default:
      throw new Error(`no candidate builder for angle "${angle}"`);
  }
}

/** "36,391 spots on the map" — the words are ours, the number is the API's. */
function countLabel(which, totals) {
  const number = new Intl.NumberFormat('en-GB').format(totals[which] ?? 0);
  const nouns = {
    spots: `${number} spots on the map`,
    events: `${number} events coming up`,
    tricks: `${number} tricks in the library`,
  };
  return nouns[which];
}
