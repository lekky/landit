import type { Metadata } from 'next';

import { pastEventsHref } from '@/lib/routes';

import { EventsScreen } from '../../../EventsScreen';
import { loadEvents } from '../../../load';

type Params = { params: Promise<{ year: string; town: string }> };

/**
 * One year-and-town corner of the archive — `/events/past/2026/ventnor`.
 *
 * **The index that points here is capped** (Rachid, 2026-09-06, in chat).
 * `eventArchiveIndex` only ever names combinations that genuinely hold events,
 * and it is the same list the panel renders and `sitemap.ts` advertises — so
 * nothing we publish points at an empty corner. The obvious alternative, a year
 * row crossed with a town row, is a few hundred addresses of which a couple of
 * dozen hold anything: the doorway pattern, built on purpose.
 *
 * **A corner a reader types by hand still answers.** It renders the design's
 * empty state rather than a 404 or a 500 — somebody guessing `2024/ventnor` has
 * asked a reasonable question and deserves the two ways on. What stops that
 * becoming a thin page in an index is `robots: { index: false }`, set below and
 * only on the empty case: a corner with listings in it is a real page and stays
 * crawlable, which is the entire reason for keeping finished events online.
 */
export const dynamic = 'force-dynamic';

/**
 * The year as a number, or `null` for anything that is not a four-digit year.
 *
 * Nothing further down ever sees the raw segment: it is a string a reader
 * typed, and it reaches neither the copy on the page (`ArchiveWhere.town` comes
 * from an event we hold) nor an analytics property.
 */
function yearOf(segment: string): number | null {
  return /^\d{4}$/.test(segment) ? Number(segment) : null;
}

async function resolve(params: Params['params']) {
  const { year: yearParam, town } = await params;
  const year = yearOf(yearParam);
  if (year === null) return null;
  const townSlug = decodeURIComponent(town).toLowerCase();
  const loaded = await loadEvents('past', { year, townSlug });
  return { year, townSlug, ...loaded };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const resolved = await resolve(params);
  if (!resolved) return { title: 'Past events · Land The Trick', robots: { index: false } };

  const { view, year } = resolved;
  const town = view.archive?.where?.town ?? '';
  const empty = view.events.length === 0;

  return {
    title: town
      ? `Past events in ${town}, ${year} · Land The Trick`
      : `Past events · Land The Trick`,
    description: town
      ? `Comps, jams, classes and sessions that happened in ${town} in ${year}.`
      : 'Comps, jams, classes and sessions that have already happened.',
    alternates: {
      canonical: pastEventsHref({ year, townSlug: resolved.townSlug }),
    },
    // An empty corner is answered, not indexed. See the note at the head.
    ...(empty ? { robots: { index: false } } : {}),
  };
}

export default async function PastEventsCornerPage({ params }: Params) {
  const resolved = await resolve(params);

  /*
   * A year segment that is not a year is not a corner of anything, so it falls
   * back to the whole archive rather than 404ing — the reader still gets the
   * index, which is where they were trying to go. `generateMetadata` has
   * already marked it `noindex`.
   */
  if (!resolved) {
    const { view, units, signedIn } = await loadEvents('past');
    return <EventsScreen view={view} units={units} signedIn={signedIn} />;
  }

  const { view, units, signedIn } = resolved;
  return <EventsScreen view={view} units={units} signedIn={signedIn} />;
}
