import { describe, expect, it } from 'vitest';

import { EVENTS } from '../data/events';
import type { LandItEvent } from '../types';
import {
  EVENT_REFERRAL_SOURCE,
  EVENT_KIND_COLORS,
  eventAgoLabel,
  eventArchiveIndex,
  eventBySlug,
  eventCountriesPresent,
  eventCountryForRegion,
  eventDateBlock,
  eventDateState,
  eventDaysAway,
  eventDistanceLabel,
  eventHasCoords,
  eventKindColor,
  eventKindsPresent,
  eventLongDate,
  eventMapsLink,
  eventMatchesCountry,
  eventMatchesSearch,
  eventPhoneLink,
  eventSourceHost,
  eventSourceLink,
  eventSourceReferralLink,
  eventTownSlug,
  eventsAtVenue,
  eventsFor,
  eventsNear,
  filterEvents,
  isEventPast,
  nearestFirst,
  nearnessBetween,
  pastEvents,
  pastEventsIn,
  sortEventsByDistance,
  sortedEvents,
  upcomingEvents,
} from './events';
import { SPOT_COUNTRY_BY_CODE } from './spots';

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

describe('which country the calendar opens on', () => {
  const list = [
    event({ id: 'au', date: '2026-09-01', country: 'Australia' }),
    event({ id: 'uk', date: '2026-09-02', country: 'UK' }),
    event({ id: 'jp', date: '2026-09-03', country: 'Japan' }),
  ];

  it('opens on the reader own country, joined from an alpha-2 code', () => {
    // `AU` is a code; `Australia` is how the data spells it on a card. The join
    // between the two is the whole reason this function is not `includes`.
    expect(eventCountryForRegion('AU', list)).toBe('Australia');
    expect(eventCountryForRegion('GB', list)).toBe('UK');
    expect(eventCountryForRegion('JP', list)).toBe('Japan');
  });

  it('opens on Everywhere when that country has nothing on', () => {
    // Ireland is a country we can name and have no events in. Opening a reader
    // there on an empty filter would be worse than opening them on the world,
    // and picking a neighbour would be a country they never asked for
    // (Rachid, 2026-09-12, in chat).
    expect(eventCountryForRegion('IE', list)).toBeNull();
  });

  it('opens on Everywhere when the signal says nothing usable', () => {
    for (const region of [null, undefined, '', '  ', 'ZZ', 'not-a-code']) {
      expect(eventCountryForRegion(region, list)).toBeNull();
    }
  });

  it('never names a country the filter does not offer', () => {
    // The default and the `<select>` options have to agree: a default the
    // dropdown cannot show is a filter a rider cannot undo by choosing.
    const offered = eventCountriesPresent(list);
    for (const code of ['AU', 'GB', 'JP', 'IE', 'US', 'FR', 'ZZ', '']) {
      const opened = eventCountryForRegion(code, list);
      if (opened !== null) expect(offered).toContain(opened);
    }
  });

  it('ignores hidden events, exactly as the filter row does', () => {
    const hidden = [event({ id: 'x', date: '2026-09-01', country: 'Japan', isLive: false })];
    expect(eventCountryForRegion('JP', hidden)).toBeNull();
  });

  it('answers per half, because the two halves are in different countries', () => {
    // Handed the archive, it may only name an archive country — a calendar
    // country defaulted onto the archive filters that list to nothing.
    const archiveOnly = [event({ id: 'p', date: '2020-01-01', country: 'Japan' })];
    expect(eventCountryForRegion('AU', archiveOnly)).toBeNull();
    expect(eventCountryForRegion('JP', archiveOnly)).toBe('Japan');
  });

  it('can name every country the shipped calendar is actually in', () => {
    /*
     * The guard against a new event country that no reader can ever be opened
     * on: `SPOT_COUNTRY_BY_CODE` is the one code-to-name table, and a country
     * spelled in `EVENTS` but missing from it is a rider in that country who
     * silently gets "Everywhere" forever. Same check `data.test.ts` makes for
     * spots — it fails here rather than being noticed by nobody.
     */
    const reachable = new Set(Object.values(SPOT_COUNTRY_BY_CODE));
    const unreachable = eventCountriesPresent(EVENTS).filter((name) => !reachable.has(name));
    expect(unreachable).toEqual([]);
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

  it('carries our referral, because rel="noreferrer" means nothing else does', () => {
    const link = eventSourceReferralLink('https://example.org/e');
    const params = new URL(link).searchParams;
    expect(params.get('utm_source')).toBe(EVENT_REFERRAL_SOURCE);
    // Without a medium the visit is filed under "(not set)" and nobody reads it.
    expect(params.get('utm_medium')).toBe('referral');
  });

  it('keeps the organiser\u2019s own query string and fragment', () => {
    const link = eventSourceReferralLink('https://example.org/e?id=7#tickets');
    const url = new URL(link);
    expect(url.searchParams.get('id')).toBe('7');
    expect(url.searchParams.get('utm_source')).toBe(EVENT_REFERRAL_SOURCE);
    expect(url.hash).toBe('#tickets');
  });

  it('leaves a link the organiser has already tagged exactly as it is', () => {
    // Their campaign, not ours. Overwriting `utm_source` would move the visit
    // out of the campaign they built and into ours.
    const theirs = 'https://example.org/e?utm_source=newsletter&utm_campaign=spring';
    expect(eventSourceReferralLink(theirs)).toBe(theirs);
    expect(eventSourceReferralLink('https://example.org/e?UTM_Source=newsletter')).toBe(
      'https://example.org/e?UTM_Source=newsletter',
    );
  });

  it('applies the same scheme check before it tags anything', () => {
    expect(eventSourceReferralLink('javascript:alert(1)')).toBe('');
    expect(eventSourceReferralLink('')).toBe('');
    expect(eventSourceReferralLink(undefined)).toBe('');
  });

  it('never tags the URL that structured data claims is the organiser\u2019s page', () => {
    // `sameAs` says "this URL *is* them". A tagged copy is a different URL.
    expect(eventSourceLink('https://example.org/e')).toBe('https://example.org/e');
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

describe('an event as its own page', () => {
  const clock = at('2026-09-05T09:00:00Z');

  it('reads the three states off the date and the rider clock, never off a flag', () => {
    expect(eventDateState(event({ id: 'a', date: '2026-09-26' }), clock)).toBe('upcoming');
    expect(eventDateState(event({ id: 'b', date: '2026-09-05' }), clock)).toBe('today');
    expect(eventDateState(event({ id: 'c', date: '2026-06-13' }), clock)).toBe('over');
  });

  it('agrees with isEventPast, so the page and the list can never disagree', () => {
    for (const date of ['2026-06-13', '2026-09-04', '2026-09-05', '2026-09-06']) {
      const one = event({ id: date, date });
      expect(eventDateState(one, clock) === 'over').toBe(isEventPast(one, clock));
    }
  });

  it('turns over at midnight where the rider is, not where the server is', () => {
    // 22:00 UTC on the 5th is already the 6th in Auckland, so an event on the
    // 5th is over there and still happening in London.
    const one = event({ id: 'a', date: '2026-09-05' });
    expect(eventDateState(one, at('2026-09-05T22:00:00Z'))).toBe('today');
    expect(eventDateState(one, at('2026-09-05T22:00:00Z', 'Pacific/Auckland'))).toBe('over');
  });

  it('counts whole days away, and goes negative once it has been', () => {
    expect(eventDaysAway(event({ id: 'a', date: '2026-09-26' }), clock)).toBe(21);
    expect(eventDaysAway(event({ id: 'b', date: '2026-09-05' }), clock)).toBe(0);
    expect(eventDaysAway(event({ id: 'c', date: '2026-09-04' }), clock)).toBe(-1);
  });

  it('writes the long date with its year, because the page outlives the year', () => {
    expect(eventLongDate('2026-09-26')).toBe('Saturday 26 September 2026');
  });

  it('coarsens how long ago it was, and says nothing about a date still to come', () => {
    const ago = (date: string) => eventAgoLabel(event({ id: date, date }), clock);
    expect(ago('2026-09-04')).toBe('yesterday');
    expect(ago('2026-09-01')).toBe('4 days ago');
    expect(ago('2026-06-13')).toBe('12 weeks ago');
    expect(ago('2025-09-05')).toBe('12 months ago');
    expect(ago('2024-01-05')).toBe('2 years ago');
    expect(ago('2026-09-05')).toBe('');
    expect(ago('2026-09-26')).toBe('');
  });
});

describe('near, when all you hold is a town and a country', () => {
  const clock = at('2026-09-05T09:00:00Z');

  it('matches a town whole and case-insensitively, never as a prefix', () => {
    expect(nearnessBetween({ town: 'Ventnor' }, { town: 'ventnor ' })).toBe('town');
    expect(nearnessBetween({ town: 'Ventnor' }, { town: 'Ventnorville' })).toBe(null);
    expect(
      nearnessBetween({ town: 'A', country: 'India' }, { town: 'B', country: 'Indonesia' }),
    ).toBe(null);
  });

  it('treats a missing field as matching nothing rather than as matching everything', () => {
    expect(nearnessBetween({ town: '' }, { town: '' })).toBe(null);
    expect(nearnessBetween({ town: 'Ventnor' }, {})).toBe(null);
  });

  it('puts the same town first, then the rest of the country, and drops the rest', () => {
    const here = { town: 'Ventnor', country: 'United Kingdom' };
    const places = [
      { id: 'far', town: 'Tallinn', country: 'Estonia' },
      { id: 'uk', town: 'Newport', country: 'United Kingdom' },
      { id: 'home', town: 'Ventnor', country: 'United Kingdom' },
    ];
    expect(nearestFirst(here, places).map((p) => p.id)).toEqual(['home', 'uk']);
  });

  it('offers only upcoming events, and never the one being read', () => {
    const here = event({
      id: 'this',
      date: '2026-06-13',
      town: 'Ventnor',
      country: 'United Kingdom',
      venue: 'Ventnor Skatepark',
    });
    const list = [
      here,
      event({ id: 'gone', date: '2026-07-01', town: 'Ventnor', country: 'United Kingdom' }),
      event({ id: 'soon', date: '2026-09-19', town: 'Newport', country: 'United Kingdom' }),
      event({ id: 'home', date: '2026-10-11', town: 'Ventnor', country: 'United Kingdom' }),
      event({ id: 'abroad', date: '2026-09-20', town: 'Tallinn', country: 'Estonia' }),
      event({ id: 'hidden', date: '2026-09-18', town: 'Ventnor', isLive: false }),
    ];
    expect(eventsNear(here, list, { clock }).map((e) => e.id)).toEqual(['home', 'soon']);
  });

  it('keeps the venue block and the nearby block from listing the same row twice', () => {
    const here = event({
      id: 'this',
      date: '2026-09-26',
      town: 'Ventnor',
      country: 'United Kingdom',
      venue: 'Ventnor Skatepark',
    });
    const alsoHere = event({
      id: 'same-park',
      date: '2026-11-07',
      town: 'Ventnor',
      country: 'United Kingdom',
      venue: 'ventnor skatepark',
    });
    const list = [here, alsoHere];
    expect(eventsAtVenue(here, list, { clock }).map((e) => e.id)).toEqual(['same-park']);
    expect(eventsNear(here, list, { clock }).map((e) => e.id)).toEqual([]);
  });

  it('will not join two skateparks of the same name in different towns', () => {
    const here = event({ id: 'a', date: '2026-09-26', town: 'Ventnor', venue: 'Riverside' });
    const elsewhere = event({ id: 'b', date: '2026-09-27', town: 'Ryde', venue: 'Riverside' });
    expect(eventsAtVenue(here, [here, elsewhere], { clock }).map((e) => e.id)).toEqual([]);
  });

  it('finds a live event by slug and refuses a hidden one', () => {
    const list = [
      event({ id: 'live-one', date: '2026-09-26' }),
      event({ id: 'hidden-one', date: '2026-09-27', isLive: false }),
    ];
    expect(eventBySlug('live-one', list)?.id).toBe('live-one');
    expect(eventBySlug('hidden-one', list)).toBe(null);
    expect(eventBySlug('nothing-like-it', list)).toBe(null);
  });
});

describe('the archive: upcoming and past are two halves of one cut', () => {
  const clock = at('2026-09-05T09:00:00Z');

  /*
   * The listing this suite is about. Two events have gone, two have not, one is
   * today (which is upcoming, not past — `isEventPast` is the definition and it
   * is strictly "before today"), and one is hidden by staff so it belongs in
   * neither half.
   */
  const list = [
    event({ id: 'gone-jun', date: '2026-06-13', town: 'Ventnor', country: 'United Kingdom' }),
    event({ id: 'gone-may', date: '2026-05-02', town: 'Ventnor', country: 'United Kingdom' }),
    event({ id: 'gone-2025', date: '2025-08-01', town: 'Corby', country: 'United Kingdom' }),
    event({ id: 'today', date: '2026-09-05', town: 'Corby', country: 'United Kingdom' }),
    event({ id: 'soon', date: '2026-09-26', town: 'Ventnor', country: 'United Kingdom' }),
    event({ id: 'hidden-past', date: '2026-01-01', town: 'Ventnor', isLive: false }),
  ];

  /*
   * The bug the design handoff records: the prototype's upcoming list carried
   * events that had already happened and its archive carried ones that had not.
   * These two assertions are the whole of that, stated as the property rather
   * than as a pair of examples — no row may be on the wrong side, whatever the
   * filters above it are doing.
   */
  it('never lets a past event into the upcoming list', () => {
    expect(upcomingEvents(list, clock).map((e) => e.id)).toEqual(['today', 'soon']);
    for (const e of upcomingEvents(list, clock)) expect(isEventPast(e, clock)).toBe(false);
  });

  it('never lets an upcoming event into the archive', () => {
    expect(pastEvents(list, clock).map((e) => e.id)).toEqual(['gone-jun', 'gone-may', 'gone-2025']);
    for (const e of pastEvents(list, clock)) expect(isEventPast(e, clock)).toBe(true);
  });

  it('splits the live list in two with nothing shared and nothing dropped', () => {
    const upcoming = upcomingEvents(list, clock).map((e) => e.id);
    const past = pastEvents(list, clock).map((e) => e.id);
    // Disjoint...
    expect(upcoming.filter((id) => past.includes(id))).toEqual([]);
    // ...and, between them, the whole of the live calendar.
    expect([...upcoming, ...past].sort()).toEqual(
      sortedEvents(list)
        .map((e) => e.id)
        .sort(),
    );
  });

  it('reads the archive most recent first, and the calendar soonest first', () => {
    expect(pastEvents(list, clock)[0]?.id).toBe('gone-jun');
    expect(upcomingEvents(list, clock)[0]?.id).toBe('today');
  });

  it('keeps a hidden event out of both halves', () => {
    const ids = [...upcomingEvents(list, clock), ...pastEvents(list, clock)].map((e) => e.id);
    expect(ids).not.toContain('hidden-past');
  });

  it('indexes only the year and town corners that actually hold events', () => {
    const index = eventArchiveIndex(list, clock);
    expect(index.years).toEqual([2026, 2025]);
    expect(index.towns.map((t) => t.townSlug)).toEqual(['corby', 'ventnor']);
    expect(index.combinations.map((c) => `${c.year}/${c.townSlug}:${c.count}`)).toEqual([
      '2026/ventnor:2',
      '2025/corby:1',
    ]);
    // The cross-product would be four; the cap is the whole point (Rachid,
    // 2026-09-06). 2026/Corby has only a *future* event and 2025/Ventnor has
    // none at all, so neither is published or advertised.
    expect(index.combinations).toHaveLength(2);
    for (const combination of index.combinations) expect(combination.count).toBeGreaterThan(0);
  });

  it('narrows to one corner exactly, and answers an empty corner with nothing', () => {
    expect(pastEventsIn({ year: 2026, townSlug: 'ventnor' }, list, clock).map((e) => e.id)).toEqual(
      ['gone-jun', 'gone-may'],
    );
    expect(pastEventsIn({ year: 2024, townSlug: 'ventnor' }, list, clock)).toEqual([]);
    expect(pastEventsIn({ year: 2026, townSlug: 'nowhere' }, list, clock)).toEqual([]);
    // A narrowing is never a way back to an upcoming event.
    expect(pastEventsIn({ townSlug: 'corby' }, list, clock).map((e) => e.id)).toEqual([
      'gone-2025',
    ]);
  });

  it('matches a town whole, never as a prefix', () => {
    const towns = [
      event({ id: 'newport', date: '2026-06-01', town: 'Newport' }),
      event({ id: 'pagnell', date: '2026-06-02', town: 'Newport Pagnell' }),
    ];
    expect(eventTownSlug('Newport Pagnell')).toBe('newport-pagnell');
    expect(pastEventsIn({ townSlug: 'newport' }, towns, clock).map((e) => e.id)).toEqual([
      'newport',
    ]);
  });
});
