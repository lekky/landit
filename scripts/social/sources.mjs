/**
 * Read-only accessors over the live API.
 *
 * Everything a post says comes from here. Nothing in this file writes, and
 * nothing above it invents a figure — that is what makes posting unattended
 * safe. The collections are the public ones the website itself reads.
 */

import { config } from './config.mjs';

/**
 * One request to PocketBase. `fields` is always passed: a post needs a handful
 * of columns and asking for the row wholesale would pull rider-submitted text
 * into a process whose whole job is to publish.
 */
async function records(collection, { filter, sort, fields, perPage = 50 } = {}) {
  const url = new URL(`/api/collections/${collection}/records`, config.api);
  url.searchParams.set('perPage', String(perPage));
  if (filter) url.searchParams.set('filter', filter);
  if (sort) url.searchParams.set('sort', sort);
  if (fields) url.searchParams.set('fields', fields);

  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`${collection}: ${response.status} ${response.statusText} for ${url.pathname}`);
  }
  const body = await response.json();
  return { items: body.items ?? [], total: body.totalItems ?? 0 };
}

/** PocketBase compares dates as strings; this is the shape it stores. */
const asStamp = (date) => `${date} 00:00:00.000Z`;

/**
 * The challenges whose window opens on this date — one per sport, and all three
 * share a title. They are scheduled out to 2027, so a challenge post can be
 * built and queued days ahead.
 */
export async function challengesStartingOn(date) {
  const { items } = await records('challenges', {
    filter: `(starts='${asStamp(date)}')`,
    fields: 'title,slug,sport,verb,goal,blurb,starts,ends,reward',
    perPage: 6,
  });
  return items;
}

/** The challenges running on this date, whenever they started. */
export async function challengesRunningOn(date) {
  const { items } = await records('challenges', {
    filter: `(starts<='${asStamp(date)}' && ends>='${asStamp(date)}')`,
    fields: 'title,slug,sport,verb,goal,blurb,starts,ends,reward',
    perPage: 6,
  });
  return items;
}

/**
 * Live events between two dates, worldwide, soonest first.
 *
 * `is_live` is the staff flag: an event that has not been approved is not
 * something to put in front of a child.
 */
export async function eventsBetween(from, to, perPage = 40) {
  const { items, total } = await records('events', {
    filter: `(date>='${from}' && date<='${to}' && is_live=true)`,
    sort: 'date',
    fields: 'name,slug,date,kind,town,country,sports',
    perPage,
  });
  return { items, total };
}

/**
 * Tricks in the library, for the trick and sticker posts.
 *
 * `supervise=false` keeps the risky end of the library out of a feed: a post is
 * an invitation to go and try it, which is not the same as a page a rider chose
 * to open. `hard` and `mistakes` are deliberately not requested — a card has
 * room for one line, and that line is the tip.
 */
export async function tricks(sport) {
  const { items, total } = await records('tricks', {
    filter: `(is_live=true && supervise=false && sport='${sport}')`,
    sort: 'diff,name',
    fields: 'name,slug,sport,cat,diff,tips,fact',
    perPage: 200,
  });
  return { items, total };
}

/**
 * Spots worth a post: live, and researched rather than imported.
 *
 * The world import added tens of thousands of points that carry a name and not
 * much else, and their pages are deliberately kept out of search. The 360
 * researched ones have a type, tags and a town — enough to say something true
 * and specific about the place.
 */
export async function featuredSpots() {
  const { items, total } = await records('spots', {
    filter: "(status='live' && source='researched')",
    sort: 'name',
    fields: 'name,slug,town,country,sports,tags,type,indoor',
    perPage: 400,
  });
  return { items, total };
}

/** Counts for the weekend feature posts. Each is read, never assumed. */
export async function counts() {
  const [spots, events, liveTricks] = await Promise.all([
    records('spots', { filter: "(status='live')", fields: 'id', perPage: 1 }),
    records('events', { filter: `(date>='${today()}' && is_live=true)`, fields: 'id', perPage: 1 }),
    records('tricks', { filter: '(is_live=true)', fields: 'id', perPage: 1 }),
  ]);
  return { spots: spots.total, events: events.total, tricks: liveTricks.total };
}

/** Today in the posting timezone, as YYYY-MM-DD. */
export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone }).format(new Date());
}
