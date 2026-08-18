import { describe, expect, it } from 'vitest';

import { EVENTS } from '../data/events';
import type { LandItEvent } from '../types';
import {
  EVENT_KIND_COLORS,
  eventCountriesPresent,
  eventDateBlock,
  eventDistanceLabel,
  eventHasCoords,
  eventKindColor,
  eventKindsPresent,
  eventMapsLink,
  eventMatchesCountry,
  eventMatchesSearch,
  eventPhoneLink,
  eventSourceHost,
  eventSourceLink,
  eventsFor,
  filterEvents,
  isEventPast,
  sortEventsByDistance,
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

/* ------------------------------------------------- where an event is (2026-08) */

describe('country filter', () => {
  it('matches a country whole, so India does not select Indonesia', () => {
    // The bug a prefix match would ship: a rider filtering to India gets Jakarta.
    const india = event({ id: 'a', date: '2026-09-01', country: 'India' });
    const indonesia = event({ id: 'b', date: '2026-09-02', country: 'Indonesia' });
    expect(eventMatchesCountry(india, 'India')).toBe(true);
    expect(eventMatchesCountry(indonesia, 'India')).toBe(false);
  });

  it('ignores case and surrounding space, because staff type these by hand', () => {
    const one = event({ id: 'a', date: '2026-09-01', country: 'New Zealand' });
    expect(eventMatchesCountry(one, '  new zealand ')).toBe(true);
  });

  it('files an event with no country under nothing but "everywhere"', () => {
    // An unresearched event must not be silently filed under the reader's own
    // country — it is unknown, not local.
    const unknown = event({ id: 'a', date: '2026-09-01' });
    expect(eventMatchesCountry(unknown, 'UK')).toBe(false);
    expect(eventMatchesCountry(unknown, null)).toBe(true);
  });

  it('offers only countries that have an event behind them, sorted', () => {
    const list = [
      event({ id: 'c', date: '2026-09-03', country: 'Japan' }),
      event({ id: 'a', date: '2026-09-01', country: 'Australia' }),
      event({ id: 'd', date: '2026-09-04' }),
      event({ id: 'b', date: '2026-09-02', country: 'Japan' }),
      event({ id: 'e', date: '2026-09-05', country: 'Brazil', isLive: false }),
    ];
    // Japan once, Australia present, the blank one absent, and the hidden
    // event's country absent — `sortedEvents` drops it before this counts.
    expect(eventCountriesPresent(list)).toEqual(['Australia', 'Japan']);
  });

  it('narrows the list through filterEvents without disturbing the order', () => {
    const list = [
      event({ id: 'jp-late', date: '2026-10-01', country: 'Japan' }),
      event({ id: 'uk', date: '2026-09-02', country: 'UK' }),
      event({ id: 'jp-soon', date: '2026-09-01', country: 'Japan' }),
    ];
    expect(filterEvents({ country: 'Japan' }, list).map((e) => e.id)).toEqual([
      'jp-soon',
      'jp-late',
    ]);
    // No country asked for is every country, including the unresearched ones.
    expect(filterEvents({}, list)).toHaveLength(3);
  });
});

describe('typing a city', () => {
  it('finds an event by town, venue, name or country', () => {
    const one = event({
      id: 'a',
      date: '2026-09-01',
      name: 'Northern Jam',
      town: 'Manchester',
      venue: 'Projekts MCR',
      country: 'UK',
    });
    expect(eventMatchesSearch(one, 'manchester')).toBe(true);
    expect(eventMatchesSearch(one, 'projekts')).toBe(true);
    expect(eventMatchesSearch(one, 'northern')).toBe(true);
    expect(eventMatchesSearch(one, 'uk')).toBe(true);
    expect(eventMatchesSearch(one, 'liverpool')).toBe(false);
  });

  it('treats an empty box as no filter at all', () => {
    const one = event({ id: 'a', date: '2026-09-01' });
    expect(eventMatchesSearch(one, '')).toBe(true);
    expect(eventMatchesSearch(one, '   ')).toBe(true);
  });
});

describe('near me', () => {
  const projekts = event({ id: 'mcr', date: '2026-09-01', lat: 53.4795, lng: -2.2361 });
  const rampworx = event({ id: 'lpl', date: '2026-09-02', lat: 53.4631, lng: -2.9639 });
  const nowhere = event({ id: 'none', date: '2026-09-03' });

  it('does not believe 0, 0 is a location', () => {
    expect(eventHasCoords(event({ id: 'z', date: '2026-09-01', lat: 0, lng: 0 }))).toBe(false);
    expect(eventHasCoords(projekts)).toBe(true);
    expect(eventHasCoords(nowhere)).toBe(false);
  });

  it('sorts nearest first and leaves unplottable events at the back', () => {
    const fromManchester = { lat: 53.4808, lng: -2.2426 };
    expect(
      sortEventsByDistance([nowhere, rampworx, projekts], fromManchester).map((e) => e.id),
    ).toEqual(['mcr', 'lpl', 'none']);
  });

  it("labels a distance in the reader's own units, and refuses when there is no point", () => {
    const fromManchester = { lat: 53.4808, lng: -2.2426 };
    expect(eventDistanceLabel(fromManchester, projekts, 'km')).toMatch(/km$/);
    expect(eventDistanceLabel(fromManchester, projekts, 'miles')).toMatch(/mi$/);
    expect(eventDistanceLabel(fromManchester, nowhere, 'miles')).toBeNull();
  });

  it('builds a maps link carrying the venue and nothing about the rider', () => {
    const link = eventMapsLink(projekts);
    expect(link).toContain('53.4795,-2.2361');
    // No origin, no "directions from here" (plan §6.4 standard 10).
    expect(link).not.toMatch(/origin|saddr|directions/i);
    expect(eventMapsLink(nowhere)).toBe('');
  });
});

describe('links out of a researched listing', () => {
  it('links only to http and https', () => {
    expect(eventSourceLink('https://example.org/e')).toBe('https://example.org/e');
    expect(eventSourceLink('http://example.org/e')).toBe('http://example.org/e');
  });

  it('refuses a javascript: or data: URI typed into the staff editor', () => {
    // This URL reaches an `href`. The scheme check is the whole guard: a
    // `javascript:` URI in a link runs against the rider's own session.
    expect(eventSourceLink('javascript:alert(1)')).toBe('');
    expect(eventSourceLink('JavaScript:alert(1)')).toBe('');
    expect(eventSourceLink('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(eventSourceLink('not a url at all')).toBe('');
    expect(eventSourceLink('')).toBe('');
    expect(eventSourceLink(undefined)).toBe('');
  });

  it('names the host so a rider can see where a link goes first', () => {
    expect(eventSourceHost('https://www.rampworx.com/events/open')).toBe('rampworx.com');
    expect(eventSourceHost('javascript:alert(1)')).toBe('');
  });

  it('dials a published number without reformatting what is on screen', () => {
    expect(eventPhoneLink('+44 (0)1536 401552')).toBe('tel:+4401536401552');
    expect(eventPhoneLink('01536 401552')).toBe('tel:01536401552');
  });

  it('gives no link rather than a broken one when there is no number', () => {
    expect(eventPhoneLink('')).toBe('');
    expect(eventPhoneLink('call us')).toBe('');
    expect(eventPhoneLink('123')).toBe('');
    expect(eventPhoneLink(undefined)).toBe('');
  });
});

describe('the seeded events', () => {
  it('give every live event a country, so the filter can never miss one', () => {
    // The seed is researched data. An event without a country is reachable only
    // through "Everywhere", which for a real listing is a defect, not a state.
    const missing = sortedEvents(EVENTS).filter((e) => !(e.country ?? '').trim());
    expect(missing.map((e) => e.id)).toEqual([]);
  });

  it('only ever links out over http or https', () => {
    for (const e of sortedEvents(EVENTS)) {
      if (!e.sourceUrl) continue;
      expect(eventSourceLink(e.sourceUrl)).not.toBe('');
    }
  });

  it('plots a venue somewhere real, or nowhere at all', () => {
    for (const e of sortedEvents(EVENTS)) {
      if (e.lat === undefined && e.lng === undefined) continue;
      expect(eventHasCoords(e)).toBe(true);
      expect(Math.abs(e.lat as number)).toBeLessThanOrEqual(90);
      expect(Math.abs(e.lng as number)).toBeLessThanOrEqual(180);
    }
  });
});
