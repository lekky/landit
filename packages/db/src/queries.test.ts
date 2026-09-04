import {
  challengeState,
  eventsFor,
  isTrickFree,
  isTrickLocked,
  supervisedTricks,
  trickById,
} from '@landit/core';
import { describe, expect, it } from 'vitest';

import type {
  ChallengesRecord,
  EventsRecord,
  TrickPrereqsRecord,
  TricksRecord,
} from './generated/collections';
import { challengesFromRecords, eventsFromRecords, tricksFromRecords } from './queries';

/**
 * The `tricks` row → `Trick` mapping.
 *
 * Two of these assertions are about the paywall rather than about a mapping.
 * `free_override` is a three-state select and the rule shape is a nullable
 * boolean, so the empty value has to arrive as `undefined`: read as `false` it
 * would put every difficulty-1 trick behind the paywall, and the failure would
 * look like a plan bug rather than a translation bug.
 */

const row = (over: Partial<TricksRecord> & Pick<TricksRecord, 'id' | 'slug'>): TricksRecord => ({
  collectionId: 'c',
  collectionName: 'tricks',
  name: over.slug,
  sport: 'scooter',
  cat: 'flat',
  diff: 1,
  about: '',
  tips: '',
  fact: '',
  free_override: '' as TricksRecord['free_override'],
  supervise: false,
  is_live: true,
  created: '',
  updated: '',
  ...over,
});

const edge = (trick: string, prereq: string): TrickPrereqsRecord => ({
  collectionId: 'e',
  collectionName: 'trick_prereqs',
  id: `${trick}-${prereq}`,
  trick,
  prereq,
  created: '',
});

describe('tricksFromRecords', () => {
  it('keys tricks by slug, not by database id', () => {
    const tricks = tricksFromRecords([row({ id: 'rec1', slug: 'bunny-hop', name: 'Bunny hop' })]);
    expect(tricks[0]?.id).toBe('bunny-hop');
    expect(trickById('bunny-hop', tricks)?.name).toBe('Bunny hop');
  });

  it('resolves prerequisite edges from record ids to slugs', () => {
    const tricks = tricksFromRecords(
      [row({ id: 'rec1', slug: 'bunny-hop' }), row({ id: 'rec2', slug: 'tailwhip', diff: 3 })],
      [edge('rec2', 'rec1')],
    );
    expect(trickById('tailwhip', tricks)?.pre).toEqual(['bunny-hop']);
    expect(trickById('bunny-hop', tricks)?.pre).toEqual([]);
  });

  it('drops an edge naming a trick that is not in the list', () => {
    const tricks = tricksFromRecords(
      [row({ id: 'rec1', slug: 'bunny-hop' })],
      [edge('rec9', 'rec1')],
    );
    expect(tricks[0]?.pre).toEqual([]);
  });

  it('reads an empty free_override as "inherit from difficulty", never as paid', () => {
    const tricks = tricksFromRecords([
      row({ id: 'rec1', slug: 'easy', diff: 1 }),
      row({ id: 'rec2', slug: 'hard', diff: 4 }),
    ]);
    expect(tricks[0]?.free).toBeUndefined();
    expect(isTrickFree(tricks[0]!)).toBe(true);
    expect(isTrickLocked(tricks[0]!, 'rookie')).toBe(false);
    expect(isTrickLocked(tricks[1]!, 'rookie')).toBe(true);
  });

  it('carries the supervise flag through in both directions', () => {
    const tricks = tricksFromRecords([
      row({ id: 'rec1', slug: 'drop-in', diff: 2, supervise: true }),
      row({ id: 'rec2', slug: 'truckdriver', diff: 5, supervise: false }),
    ]);
    expect(supervisedTricks(tricks).map((t) => t.id)).toEqual(['drop-in']);
  });

  it('leaves supervise absent when the row has no such column', () => {
    // A row read from a database that predates
    // `1788134400_trick_supervise.js`. `false` would be a lie about what staff
    // said, and `supervisedTricks()` needs to see the difference so it can fall
    // back to difficulty instead of telling a guardian there is nothing to
    // watch. Built by deleting the key, which is what PocketBase does when the
    // column is not in the collection.
    const old = row({ id: 'rec1', slug: 'pro-trick', diff: 5 });
    delete (old as { supervise?: boolean }).supervise;

    const tricks = tricksFromRecords([old]);
    expect(tricks[0]?.supervise).toBeUndefined();
    expect(Object.hasOwn(tricks[0]!, 'supervise')).toBe(false);
    expect(supervisedTricks(tricks).map((t) => t.id)).toEqual(['pro-trick']);
  });

  it('honours a staff override in both directions', () => {
    const tricks = tricksFromRecords([
      row({ id: 'rec1', slug: 'free-but-hard', diff: 5, free_override: 'free' }),
      row({ id: 'rec2', slug: 'paid-but-easy', diff: 1, free_override: 'paid' }),
    ]);
    expect(isTrickLocked(tricks[0]!, 'rookie')).toBe(false);
    expect(isTrickLocked(tricks[1]!, 'rookie')).toBe(true);
  });

  it('carries the hidden flag through, so the library can drop it', () => {
    const tricks = tricksFromRecords([row({ id: 'rec1', slug: 'pulled', is_live: false })]);
    expect(tricks[0]?.isLive).toBe(false);
  });
});

/* ---------------------------------------------- challenges and events (T12) */

const challengeRow = (
  over: Partial<ChallengesRecord> & Pick<ChallengesRecord, 'id' | 'slug'>,
): ChallengesRecord => ({
  collectionId: 'c',
  collectionName: 'challenges',
  sport: 'scooter',
  week: 'Week 33',
  title: 'Switch Week',
  blurb: 'Roll backwards.',
  starts: '2026-08-10 00:00:00.000Z',
  ends: '2026-08-16 00:00:00.000Z',
  goal: 3,
  reward: 'Challenger sticker',
  hue: '#3AC0FF',
  riders_copy: '',
  verb: 'Log a switch trick',
  created: '',
  updated: '',
  ...over,
});

const eventRow = (
  over: Partial<EventsRecord> & Pick<EventsRecord, 'id' | 'slug'>,
): EventsRecord => ({
  collectionId: 'e',
  collectionName: 'events',
  name: 'Northern Jam',
  kind: 'Comp',
  town: 'Manchester',
  venue: 'Projekts MCR',
  date: '2026-08-29 00:00:00.000Z',
  sports: ['scooter'],
  level: 'All levels',
  price: '£8 entry',
  spots_copy: '40 riders',
  blurb: '',
  is_live: true,
  created: '',
  updated: '',
  // The zero values PocketBase actually returns for an unresearched event —
  // empty strings and `0`, never absent keys. `eventsFromRecords` turning these
  // into `undefined` is the behaviour the tests below pin.
  country: '',
  address: '',
  phone: '',
  source_url: '',
  lat: 0,
  lng: 0,
  ...over,
});

describe('challengesFromRecords', () => {
  it('keys a challenge by slug, not by database id', () => {
    // `Challenge.id` is the slug everywhere in `@landit/core` — `challengeLogged`,
    // the seed and the fixtures all agree on that, and a record id leaking into
    // a rule is what made challenge progress read zero before T12.
    const [challenge] = challengesFromRecords([challengeRow({ id: 'rec1', slug: 'sc-33' })]);
    expect(challenge?.id).toBe('sc-33');
  });

  it('cuts a stored datetime back to the calendar day the rules compare', () => {
    const [challenge] = challengesFromRecords([challengeRow({ id: 'rec1', slug: 'sc-33' })]);
    expect(challenge?.starts).toBe('2026-08-10');
    expect(challenge?.ends).toBe('2026-08-16');
    // And the derived state is then answerable, which is the whole point of the
    // mapping: state is never stored (plan §2.2).
    expect(
      challengeState(challenge!, { now: Date.parse('2026-08-16T20:00:00Z'), timezone: 'UTC' }),
    ).toBe('live');
  });

  it('carries riders_copy through as the handoff’s display string', () => {
    const [challenge] = challengesFromRecords([
      challengeRow({ id: 'rec1', slug: 'sc-33', riders_copy: '1,284 riders in' }),
    ]);
    expect(challenge?.riders).toBe('1,284 riders in');
  });
});

describe('eventsFromRecords', () => {
  it('reads an unresearched event as absent, not as empty strings', () => {
    // PocketBase returns a zero value for every unset field, so an event nobody
    // has researched arrives as `country: ''`. If that reached the screen, the
    // detail modal would render a "Where" row with nothing after it and the
    // country filter would offer a country called "". One translation, here.
    const [event] = eventsFromRecords([eventRow({ id: 'rec1', slug: 'e1' })]);
    expect(event?.country).toBeUndefined();
    expect(event?.address).toBeUndefined();
    expect(event?.phone).toBeUndefined();
    expect(event?.sourceUrl).toBeUndefined();
  });

  it('reads 0, 0 as no location rather than as a point in the Atlantic', () => {
    // The same trap `hasCoords` exists for: an unset number field comes back as
    // `0`, and `{lat: 0, lng: 0}` is a real place six hundred miles off Ghana.
    // A "Near me" sort that believed it would put every unresearched event
    // ahead of the rider's actual local park.
    const [event] = eventsFromRecords([eventRow({ id: 'rec1', slug: 'e1' })]);
    expect(event?.lat).toBeUndefined();
    expect(event?.lng).toBeUndefined();
  });

  it('carries a researched location and source through unchanged', () => {
    const [event] = eventsFromRecords([
      eventRow({
        id: 'rec1',
        slug: 'e1',
        country: 'Japan',
        address: '1-chome Ariake, Koto City, Tokyo',
        phone: '+81 3 1234 5678',
        source_url: 'https://example.org/events/ariake',
        lat: 35.6329,
        lng: 139.7936,
      }),
    ]);
    expect(event?.country).toBe('Japan');
    expect(event?.address).toBe('1-chome Ariake, Koto City, Tokyo');
    expect(event?.phone).toBe('+81 3 1234 5678');
    expect(event?.sourceUrl).toBe('https://example.org/events/ariake');
    expect(event?.lat).toBeCloseTo(35.6329);
    expect(event?.lng).toBeCloseTo(139.7936);
  });

  it('keys an event by slug and reads spots_copy as spots', () => {
    const [event] = eventsFromRecords([eventRow({ id: 'rec1', slug: 'e1' })]);
    expect(event?.id).toBe('e1');
    expect(event?.spots).toBe('40 riders');
    expect(event?.date).toBe('2026-08-29');
  });

  it('carries the hidden flag through, so a pulled event disappears', () => {
    const rows = [
      eventRow({ id: 'rec1', slug: 'on' }),
      eventRow({ id: 'rec2', slug: 'off', is_live: false }),
    ];
    expect(eventsFor('scooter', eventsFromRecords(rows)).map((e) => e.id)).toEqual(['on']);
  });

  it('carries every sport an event is good for', () => {
    const [event] = eventsFromRecords([
      eventRow({ id: 'rec1', slug: 'e1', sports: ['scooter', 'skate', 'bmx'] }),
    ]);
    expect(event?.sports).toEqual(['scooter', 'skate', 'bmx']);
  });
});
