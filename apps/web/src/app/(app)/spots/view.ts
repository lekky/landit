import type { SportId } from '@landit/core';
import type { SpotPoint, SpotsRecord } from '@landit/db';

/**
 * How many spots a page holds, and how many a "Show more" press reveals. A
 * tunable default, not a deliberated number: 24 fills a tall desktop screen
 * and is a few scrolls on a phone. Lives here rather than in `actions.ts`
 * because a `'use server'` module may export nothing but async functions.
 */
export const SPOTS_PAGE = 24;

/** A `spots` row, flattened to what a card needs. */
export interface SpotView {
  readonly id: string;
  /**
   * The slug its own page lives at. `''` for a row that has none — a rider's
   * pending submission has no page, and a card with no `slug` gets no link
   * rather than one to `/spots/`.
   */
  readonly slug: string;
  readonly name: string;
  readonly town: string;
  readonly type: string;
  readonly lat: number;
  readonly lng: number;
  readonly sports: readonly SportId[];
  readonly tags: readonly string[];
  readonly status: 'pending' | 'live' | 'rejected';
  readonly address?: string;
  readonly phone?: string;
  readonly country?: string;
}

/** One record as the screen reads it — the same mapping for the page and the actions. */
export function toSpotView(record: SpotsRecord): SpotView {
  return {
    id: record.id,
    slug: record.slug || '',
    name: record.name,
    town: record.town,
    type: record.type,
    lat: record.lat,
    lng: record.lng,
    sports: (record.sports ?? []) as SportId[],
    tags: Array.isArray(record.tags) ? (record.tags as string[]) : [],
    status: record.status,
    // PocketBase returns '' for an unset text field, and '' is not "absent" to
    // a template — it renders an empty line. Collapse it here, once, so the
    // screen only ever asks whether it has the value.
    address: record.address || undefined,
    phone: record.phone || undefined,
    country: record.country || undefined,
  };
}

/**
 * A point on the wire: positional, because three and a half thousand of them
 * travel together when "Near me" is pressed and the keys would be a third of
 * the bytes. `[id, name, town, lat, lng, sports, tags]`.
 */
export type SpotPointTuple = readonly [
  id: string,
  name: string,
  town: string,
  lat: number,
  lng: number,
  sports: readonly SportId[],
  tags: readonly string[],
];

export function toPointTuple(point: SpotPoint): SpotPointTuple {
  return [point.id, point.name, point.town, point.lat, point.lng, point.sports, point.tags];
}

export function fromPointTuple(tuple: SpotPointTuple): SpotPoint {
  const [id, name, town, lat, lng, sports, tags] = tuple;
  return { id, name, town, lat, lng, sports, tags };
}
