import { describe, expect, it } from 'vitest';

import { EVENTS } from '../data/events';
import type { LandItEvent } from '../types';
import {
  EVENT_KIND_COLORS,
  eventDateBlock,
  eventKindColor,
  eventKindsPresent,
  eventsFor,
  filterEvents,
  isEventPast,
  sortedEvents,
} from './events';

const event = (over: Partial<LandItEvent> & Pick<LandItEvent, 'id' | 'date'>): LandItEvent => ({
  name: 'Test Event',
  kind: 'Comp',
  town: 'Coventry',
  venue: 'The Park',
  sports: ['scooter'],
  level: 'All levels',
  price: 'Free',
  spots: 'Drop in',
  blurb: '',
  isLive: true,
  ...over,
});

const at = (iso: string, timezone = 'Europe/London') => ({ now: Date.parse(iso), timezone });

describe('ordering and visibility', () => {
  it('puts the soonest event first whatever order it was given in', () => {
    const list = [
      event({ id: 'late', date: '2026-10-03' }),
      event({ id: 'soon', date: '2026-08-29' }),
      event({ id: 'mid', date: '2026-09-05' }),
    ];
    expect(sortedEvents(list).map((e) => e.id)).toEqual(['soon', 'mid', 'late']);
  });

  it('drops an event staff have pulled, rather than merely greying it', () => {
    const list = [
      event({ id: 'on', date: '2026-08-29' }),
      event({ id: 'off', date: '2026-08-30', isLive: false }),
    ];
    expect(sortedEvents(list).map((e) => e.id)).toEqual(['on']);
    expect(eventsFor('scooter', list).map((e) => e.id)).toEqual(['on']);
  });
});

describe('filtering', () => {
  const list = [
    event({ id: 'a', date: '2026-08-29', kind: 'Comp', sports: ['scooter', 'skate'] }),
    event({ id: 'b', date: '2026-09-05', kind: 'Class', sports: ['skate'] }),
    event({ id: 'c', date: '2026-09-19', kind: 'Jam', sports: ['bmx'] }),
    event({ id: 'd', date: '2026-09-21', kind: 'Comp', sports: ['bmx', 'scooter'] }),
  ];

  it('narrows to one sport without naming any sport in the code', () => {
    expect(eventsFor('bmx', list).map((e) => e.id)).toEqual(['c', 'd']);
    expect(eventsFor('skate', list).map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('narrows by kind and by sport together', () => {
    expect(filterEvents({ kind: 'Comp', sport: 'bmx' }, list).map((e) => e.id)).toEqual(['d']);
  });

  it('treats a null kind or sport as "everything"', () => {
    expect(filterEvents({ kind: null, sport: null }, list)).toHaveLength(4);
    expect(filterEvents({}, list)).toHaveLength(4);
  });

  it('can drop the days that have already gone, on the rider’s calendar', () => {
    const clock = at('2026-09-05T12:00:00Z');
    const ids = filterEvents({ upcomingOnly: true, clock }, list).map((e) => e.id);
    // The 5th itself is still on: an event is not past on the day it happens.
    expect(ids).toEqual(['b', 'c', 'd']);
  });

  it('offers only the kinds that are actually in the list, in canonical order', () => {
    expect(eventKindsPresent(list)).toEqual(['Comp', 'Class', 'Jam']);
    expect(eventKindsPresent([])).toEqual([]);
  });
});

describe('is it over', () => {
  const day = event({ id: 'x', date: '2026-08-29' });

  it('is not past on the day itself, and is the day after', () => {
    // 22:00 UTC, not 23:00: London is on BST in August, so 23:00 UTC is already
    // the next day there — which is exactly the boundary this is checking.
    expect(isEventPast(day, at('2026-08-29T22:00:00Z'))).toBe(false);
    expect(isEventPast(day, at('2026-08-30T01:30:00Z'))).toBe(true);
  });

  it('answers on the rider’s calendar, not the server’s', () => {
    // 13:00 UTC on the 29th is already the 30th in Auckland.
    const instant = '2026-08-29T13:00:00Z';
    expect(isEventPast(day, at(instant, 'Pacific/Auckland'))).toBe(true);
    expect(isEventPast(day, at(instant, 'America/Los_Angeles'))).toBe(false);
  });
});

describe('the date block', () => {
  it('splits a day key into the block the row draws, with no leading zero', () => {
    expect(eventDateBlock('2026-09-05')).toEqual({
      day: '5',
      month: 'Sep',
      full: 'Saturday 5 September',
    });
    expect(eventDateBlock('2026-08-29').day).toBe('29');
  });

  it('never asks ICU for a month name', () => {
    // The guard behind LESSONS §3a: a month rendered on both sides of a
    // hydration boundary has to come from a table, not from the runtime.
    expect(eventDateBlock('2026-01-01').month).toBe('Jan');
    expect(eventDateBlock('2026-12-31').month).toBe('Dec');
  });
});

describe('kind colours', () => {
  it('gives each named kind the design pack’s hue', () => {
    expect(eventKindColor('Comp')).toBe(EVENT_KIND_COLORS.Comp);
    expect(eventKindColor('Jam')).toBe(EVENT_KIND_COLORS.Jam);
  });

  it('falls back to ink for a kind the design never named', () => {
    expect(eventKindColor('Something Else')).toBe('var(--ink)');
  });
});

describe('the shipped events', () => {
  it('are all live and all carry at least one sport', () => {
    for (const shipped of EVENTS) {
      expect(shipped.isLive).toBe(true);
      expect(shipped.sports.length).toBeGreaterThan(0);
    }
  });
});
