import { describe, expect, it } from 'vitest';

import { SPOTS, SPOT_TYPES } from '../data/spots';
import type { SportId } from '../types';
import {
  SPOT_MAX_TAGS,
  distanceKm,
  distanceLabel,
  distanceLabelIn,
  distanceMiles,
  filterSpots,
  hasCoords,
  isValidLatLng,
  mapsLink,
  parseCoords,
  parseSpotLocation,
  readSpotSubmission,
  regionFromAcceptLanguage,
  sortSpotsByDistance,
  spotLatLng,
  spotMatchesSearch,
  spotMatchesSport,
  spotSubmissionProblems,
  splitSpotTags,
  unitsForCountry,
  type SpotSubmissionDraft,
} from './spots';

describe('parsing a pasted spot', () => {
  it('reads a plain coordinate pair', () => {
    expect(parseCoords('53.4084, -2.9916')).toEqual({ lat: 53.4084, lng: -2.9916 });
    expect(parseCoords('53.4084,-2.9916')).toEqual({ lat: 53.4084, lng: -2.9916 });
    expect(parseCoords('53.4084 -2.9916')).toEqual({ lat: 53.4084, lng: -2.9916 });
  });

  it('reads the pair out of a Google Maps link', () => {
    expect(parseCoords('https://www.google.com/maps/@53.4695,-2.9877,17z')).toEqual({
      lat: 53.4695,
      lng: -2.9877,
    });
  });

  it('wants real precision, so a house number is not a coordinate', () => {
    expect(parseCoords('12.3, 4.5')).toBeNull();
    expect(parseCoords('Rampworx, Liverpool')).toBeNull();
  });

  it('rejects coordinates that are not on Earth', () => {
    expect(parseCoords('153.4084, -2.9916')).toBeNull();
    expect(parseCoords('53.4084, -200.9916')).toBeNull();
  });

  it('has nothing to say about nothing', () => {
    expect(parseCoords('')).toBeNull();
    expect(parseCoords(null)).toBeNull();
    expect(parseCoords(undefined)).toBeNull();
  });
});

describe('validating coordinates', () => {
  it('accepts a real pair and refuses everything else', () => {
    expect(isValidLatLng({ lat: 0, lng: 0 })).toBe(true);
    expect(isValidLatLng({ lat: 90, lng: 180 })).toBe(true);
    expect(isValidLatLng({ lat: 91, lng: 0 })).toBe(false);
    expect(isValidLatLng({ lat: 0 })).toBe(false);
    expect(isValidLatLng({ lat: Number.NaN, lng: 0 })).toBe(false);
  });
});

describe('distance', () => {
  it('is zero from a point to itself', () => {
    expect(distanceMiles({ lat: 53.4, lng: -2.9 }, { lat: 53.4, lng: -2.9 })).toBe(0);
  });

  it('measures Liverpool to Manchester at roughly 28 miles', () => {
    const rampworx = { lat: 53.4695, lng: -2.9877 };
    const deansgate = { lat: 53.4779, lng: -2.25 };
    expect(distanceMiles(rampworx, deansgate)).toBeGreaterThan(28);
    expect(distanceMiles(rampworx, deansgate)).toBeLessThan(32);
  });

  it('is symmetric', () => {
    const a = { lat: 51.506, lng: -0.116 };
    const b = { lat: 53.7997, lng: -1.5492 };
    expect(distanceMiles(a, b)).toBeCloseTo(distanceMiles(b, a), 6);
  });

  it('replaces the prototype’s hard-coded per-spot distance', () => {
    // The design pack stored `dist: "2.4 mi"` on each spot, measured from a
    // rider who does not exist. Distance belongs to the viewer.
    for (const spot of SPOTS) {
      expect(spot).not.toHaveProperty('dist');
      expect(distanceMiles({ lat: spot.lat, lng: spot.lng }, spot)).toBe(0);
    }
  });

  it('labels near distances finely and far ones roundly', () => {
    const here = { lat: 53.4695, lng: -2.9877 };
    expect(distanceLabel(here, { lat: 53.4695, lng: -2.9877 })).toBe('0.0 mi');
    expect(distanceLabel(here, { lat: 53.4779, lng: -2.25 })).toMatch(/^\d+ mi$/);
    expect(distanceLabel(here, { lat: 0, lng: 0 })).toBeNull();
  });
});

describe('the units a rider reads distance in', () => {
  it('is miles in the four countries that use them, and a subdivision counts', () => {
    for (const country of ['GB', 'US', 'LR', 'MM']) {
      expect(unitsForCountry(country), country).toBe('miles');
    }
    expect(unitsForCountry('GB-SCT')).toBe('miles');
    expect(unitsForCountry('gb-sct')).toBe('miles');
  });

  it('is kilometres everywhere else', () => {
    for (const country of ['DE', 'FR', 'AU', 'JP', 'CA', 'IE', 'ZA']) {
      expect(unitsForCountry(country), country).toBe('km');
    }
  });

  it('is kilometres when there is no country to read', () => {
    // Metric is what "we do not know" means on a global product.
    // A signed-out visitor has no account and therefore no country. Metric is
    // what "we do not know" means on a global product, and it is settled on the
    // server because nothing that hydrates may be locale-derived (LESSONS §5).
    expect(unitsForCountry('')).toBe('km');
    expect(unitsForCountry(null)).toBe('km');
    expect(unitsForCountry(undefined)).toBe('km');
    expect(unitsForCountry('ZZ')).toBe('km');
  });
});

describe('the region a browser claims in Accept-Language', () => {
  it('reads the region subtag out of the preferred tag', () => {
    expect(regionFromAcceptLanguage('en-GB')).toBe('GB');
    expect(regionFromAcceptLanguage('en-GB,en;q=0.9')).toBe('GB');
    expect(regionFromAcceptLanguage('de-DE,de;q=0.9,en;q=0.8')).toBe('DE');
    expect(regionFromAcceptLanguage('en-us')).toBe('US');
  });

  it('skips a script subtag to find the region behind it', () => {
    expect(regionFromAcceptLanguage('zh-Hans-CN')).toBe('CN');
    expect(regionFromAcceptLanguage('sr-Latn-RS,sr;q=0.9')).toBe('RS');
  });

  it('honours q-weights rather than document order', () => {
    // The browser's own order is not always preference order.
    expect(regionFromAcceptLanguage('en;q=0.5,fr-FR;q=0.9')).toBe('FR');
    expect(regionFromAcceptLanguage('en-US;q=0.2,en-GB;q=0.8')).toBe('GB');
  });

  it('falls through a language with no region to one that has it', () => {
    expect(regionFromAcceptLanguage('en,fr-CA;q=0.8')).toBe('CA');
    expect(regionFromAcceptLanguage('en')).toBe('');
  });

  it('ignores what names no place at all', () => {
    expect(regionFromAcceptLanguage('*')).toBe('');
    expect(regionFromAcceptLanguage('en-GB;q=0')).toBe('');
    // UN M.49 regions name a continent, not a country.
    expect(regionFromAcceptLanguage('es-419')).toBe('');
    expect(regionFromAcceptLanguage('')).toBe('');
    expect(regionFromAcceptLanguage(null)).toBe('');
    expect(regionFromAcceptLanguage(undefined)).toBe('');
  });

  it('survives a header that is nonsense without throwing', () => {
    for (const header of [';;;', ',,,', 'en-GB;q=abc', '  ', '-', 'en-']) {
      expect(() => regionFromAcceptLanguage(header), header).not.toThrow();
    }
    // An unreadable weight is ignored rather than fatal: the tag still says
    // `GB`, and the default weight of 1 is what RFC 9110 gives an absent one.
    expect(regionFromAcceptLanguage('en-GB;q=abc')).toBe('GB');
    expect(regionFromAcceptLanguage(';;;')).toBe('');
  });

  it('feeds the units decision, which is the only reason it exists', () => {
    expect(unitsForCountry(regionFromAcceptLanguage('en-GB,en;q=0.9'))).toBe('miles');
    expect(unitsForCountry(regionFromAcceptLanguage('en-US'))).toBe('miles');
    expect(unitsForCountry(regionFromAcceptLanguage('de-DE'))).toBe('km');
    expect(unitsForCountry(regionFromAcceptLanguage('en-CA'))).toBe('km');
    // No usable header is the same as no country: kilometres.
    expect(unitsForCountry(regionFromAcceptLanguage(null))).toBe('km');
  });
});

describe('a distance label in the reader’s units', () => {
  const here = { lat: 53.4695, lng: -2.9877 };
  const manchester = { lat: 53.4779, lng: -2.25 };

  it('reads the same as the miles-only label when the units are miles', () => {
    expect(distanceLabelIn(here, manchester, 'miles')).toBe(distanceLabel(here, manchester));
    expect(distanceLabelIn(here, { lat: 53.4695, lng: -2.9877 }, 'miles')).toBe('0.0 mi');
  });

  it('converts to kilometres, which are always the larger number', () => {
    expect(distanceLabelIn(here, manchester, 'km')).toMatch(/^\d+ km$/);
    const miles = distanceMiles(here, manchester);
    expect(distanceKm(here, manchester)).toBeCloseTo(miles * 1.609344, 6);
    expect(distanceKm(here, manchester)).toBeGreaterThan(miles);
  });

  it('keeps one decimal place under ten in both units', () => {
    // 5 km away is ~3.1 mi: one decimal in miles, one in km.
    const near = { lat: 53.5145, lng: -2.9877 };
    expect(distanceLabelIn(here, near, 'miles')).toMatch(/^\d\.\d mi$/);
    expect(distanceLabelIn(here, near, 'km')).toMatch(/^\d\.\d km$/);
  });

  it('has nothing to say about a spot with no coordinates', () => {
    expect(distanceLabelIn(here, { lat: 0, lng: 0 }, 'km')).toBeNull();
    expect(distanceLabelIn(here, { lat: 0, lng: 0 }, 'miles')).toBeNull();
  });
});

describe('telling the rider why a paste failed', () => {
  it('reads a good one', () => {
    expect(parseSpotLocation(' 53.4084, -2.9916 ')).toEqual({
      ok: true,
      value: { lat: 53.4084, lng: -2.9916 },
    });
  });

  it('separates a short link from gibberish, because the fix is different', () => {
    // A Maps share sheet hands out a link with no coordinates in it. We do not
    // follow it — the server fetching a URL a rider chose is a forgery surface —
    // so the rider is told to open it and copy the full one.
    expect(parseSpotLocation('https://maps.app.goo.gl/AbCdEf123')).toEqual({
      ok: false,
      reason: 'short-link',
    });
    expect(parseSpotLocation('behind the co-op')).toEqual({ ok: false, reason: 'unreadable' });
    expect(parseSpotLocation('   ')).toEqual({ ok: false, reason: 'empty' });
  });
});

describe('a spot’s point', () => {
  it('does not believe PocketBase’s empty number field', () => {
    // An unset number field comes back as 0, so a spot submitted with no
    // location reads as {0, 0} — a real point in the Gulf of Guinea. Plotting
    // it would put a Liverpool skatepark in the Atlantic.
    expect(hasCoords({ lat: 0, lng: 0 })).toBe(false);
    expect(spotLatLng({ lat: 0, lng: 0 })).toBeNull();
    expect(mapsLink({ lat: 0, lng: 0 })).toBe('');
  });

  it('accepts a real one, including a zero on one axis only', () => {
    expect(hasCoords({ lat: 53.4695, lng: -2.9877 })).toBe(true);
    expect(hasCoords({ lat: 51.4779, lng: 0 })).toBe(true);
    expect(hasCoords({})).toBe(false);
  });

  it('links to the spot and never to the rider', () => {
    const link = mapsLink({ lat: 53.4695, lng: -2.9877 });
    expect(link).toBe('https://www.google.com/maps/search/?api=1&query=53.4695,-2.9877');
    // No `saddr`, no `origin`, nothing that would carry where the rider is
    // (plan §6.4, standard 10).
    expect(link).not.toMatch(/saddr|origin|dir/);
  });
});

describe('narrowing the list', () => {
  const spots = [
    { name: 'Rampworx', town: 'Liverpool', tags: ['Foam pit'], sports: ['scooter', 'skate'] },
    { name: 'Southbank', town: 'London', tags: ['Flat', 'Banks'], sports: ['skate'] },
    { name: 'Untagged', town: 'Corby', tags: [], sports: [] },
  ];

  it('searches the name, the town and the features', () => {
    expect(spotMatchesSearch(spots[0]!, 'ramp')).toBe(true);
    expect(spotMatchesSearch(spots[0]!, 'liverpool')).toBe(true);
    expect(spotMatchesSearch(spots[0]!, 'foam')).toBe(true);
    expect(spotMatchesSearch(spots[0]!, 'bowl')).toBe(false);
    expect(spotMatchesSearch(spots[0]!, '   ')).toBe(true);
  });

  it('treats an untagged spot as good for everyone', () => {
    // Not a scooter-only park — a park nobody has tagged yet.
    expect(spotMatchesSport(spots[2]!, 'bmx')).toBe(true);
    expect(spotMatchesSport(spots[1]!, 'bmx')).toBe(false);
    expect(spotMatchesSport(spots[1]!, null)).toBe(true);
  });

  it('combines the search box and the sport pill', () => {
    expect(filterSpots(spots, { sport: 'skate' }).map((s) => s.name)).toEqual([
      'Rampworx',
      'Southbank',
      'Untagged',
    ]);
    expect(filterSpots(spots, { search: 'london', sport: 'skate' }).map((s) => s.name)).toEqual([
      'Southbank',
    ]);
    expect(filterSpots(spots, {}).length).toBe(3);
  });
});

describe('nearest first', () => {
  const spots = [
    { name: 'Southbank', lat: 51.506, lng: -0.116 },
    { name: 'No location', lat: 0, lng: 0 },
    { name: 'Rampworx', lat: 53.4695, lng: -2.9877 },
    { name: 'Deansgate', lat: 53.4779, lng: -2.25 },
  ];

  it('orders by distance from wherever the rider says they are', () => {
    const fromLiverpool = sortSpotsByDistance(spots, { lat: 53.4084, lng: -2.9916 });
    expect(fromLiverpool.map((s) => s.name)).toEqual([
      'Rampworx',
      'Deansgate',
      'Southbank',
      'No location',
    ]);

    const fromLondon = sortSpotsByDistance(spots, { lat: 51.5, lng: -0.12 });
    expect(fromLondon[0]!.name).toBe('Southbank');
    // A spot with no point cannot be near anything, wherever you stand.
    expect(fromLondon.at(-1)!.name).toBe('No location');
  });

  it('leaves the input alone', () => {
    const before = spots.map((s) => s.name);
    sortSpotsByDistance(spots, { lat: 51.5, lng: -0.12 });
    expect(spots.map((s) => s.name)).toEqual(before);
  });
});

describe('reading a submission', () => {
  const good: SpotSubmissionDraft = {
    name: '  Bramley Bowl  ',
    town: ' Leeds ',
    type: 'Concrete',
    coords: 'https://www.google.com/maps/@53.7997,-1.5492,17z',
    sports: ['scooter'] as SportId[],
    tags: 'Bowl, ledges ,Bowl,,',
  };

  it('turns a filled-in form into the record spots stores', () => {
    const read = readSpotSubmission(good);
    expect(read).toEqual({
      ok: true,
      value: {
        name: 'Bramley Bowl',
        town: 'Leeds',
        type: 'Concrete',
        lat: 53.7997,
        lng: -1.5492,
        sports: ['scooter'],
        tags: ['Bowl', 'ledges'],
      },
    });
  });

  it('insists on a location, which the prototype’s form did not', () => {
    // A spot with no point cannot be plotted on a map whose job is plotting
    // them, and a reviewer handed a name and a town has nothing to check.
    const problems = spotSubmissionProblems({ ...good, coords: '' });
    expect(problems.coords).toBeTruthy();
    expect(readSpotSubmission({ ...good, coords: '' }).ok).toBe(false);
  });

  it('names every other thing that is missing, one message per field', () => {
    const problems = spotSubmissionProblems({
      name: '   ',
      town: '',
      type: 'Rooftop',
      coords: 'nowhere',
      sports: [],
      tags: '',
    });
    expect(Object.keys(problems).sort()).toEqual(['coords', 'name', 'sports', 'town', 'type']);
  });

  it('accepts every type the form offers and nothing else', () => {
    for (const type of SPOT_TYPES) {
      expect(spotSubmissionProblems({ ...good, type }).type).toBeUndefined();
    }
    expect(spotSubmissionProblems({ ...good, type: 'Skatepark' }).type).toBeTruthy();
  });

  it('refuses names and towns longer than the collection stores', () => {
    expect(spotSubmissionProblems({ ...good, name: 'x'.repeat(81) }).name).toBeTruthy();
    expect(spotSubmissionProblems({ ...good, town: 'x'.repeat(61) }).town).toBeTruthy();
  });

  it('tidies the tag field rather than refusing it', () => {
    expect(splitSpotTags(' Bowl , bowl , Ledges ')).toEqual(['Bowl', 'Ledges']);
    expect(splitSpotTags('')).toEqual([]);
    expect(splitSpotTags(Array.from({ length: 20 }, (_, i) => `tag${i}`).join(','))).toHaveLength(
      SPOT_MAX_TAGS,
    );
    expect(splitSpotTags('x'.repeat(40))[0]).toHaveLength(24);
  });
});
