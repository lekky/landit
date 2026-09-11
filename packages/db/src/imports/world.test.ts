import {
  SPOTS,
  SPOT_COUNTRY_BY_CODE,
  SPOT_SOURCES,
  SPOT_TYPES,
  distanceMiles,
  spotFeature,
  type Spot,
} from '@landit/core';
import { describe, expect, it } from 'vitest';

import { franceSpots } from './france';
import {
  baseName,
  collapseWorld,
  isGenericWorldName,
  nameWorldSpots,
  osmOnlySpots,
  tagsFor,
  tidyName,
  worldSpots,
} from './world';
import { OSM_BIT, TNF_FLAG, type WorldOsmRow, type WorldSourceRow } from './world-source';
import { WORLD_SNAPSHOT_DATE, WORLD_SOURCE_ROWS } from './world.data';

/**
 * The world mapping, against hand-made rows and against the real snapshot.
 *
 * As with France, the snapshot tests are about *properties* — no name twice in
 * a town, every value inside its column, every country reachable — never counts
 * copied from a run, so a re-capture that changes the numbers fails only if it
 * breaks a rule (LESSONS §10).
 */

type RowFields = {
  id: number;
  osm: string;
  lat: number;
  lng: number;
  osmName: string;
  tnfName: string;
  flags: number;
  osmBits: number;
  address: string;
  phone: string;
  town: string;
  country: string;
};

const row = (over: Partial<RowFields> = {}): WorldSourceRow => [
  over.id ?? 1,
  over.osm ?? '',
  over.lat ?? 37.9561,
  over.lng ?? -91.7568,
  over.osmName ?? '',
  over.tnfName ?? 'Rolla skatepark',
  over.flags ?? 0,
  over.osmBits ?? 0,
  over.address ?? '',
  over.phone ?? '',
  over.town ?? 'Rolla',
  over.country ?? 'US',
];

/** About this many metres north of a latitude. */
const north = (lat: number, metres: number): number => lat + metres / 111_320;

/** The mapping with nothing already seeded, so only the rules under test apply. */
const alone = (rows: readonly WorldSourceRow[]): readonly Spot[] => worldSpots(rows, []);

describe('isGenericWorldName', () => {
  it('reads a facility named after its own town as generic', () => {
    for (const [name, town] of [
      ['Rolla skatepark', 'Rolla'],
      ['Skate Park', 'Leeds'],
      ['Skateanlage', 'Wien'],
      ['Community Skatepark', 'Leeds'],
      ['Parque de Skate', 'Madrid'],
      ['Skatepark Weston-super-Mare', 'Weston-super-Mare'],
      ['Скейтпарк', 'Moscow'],
      ['Rolla Skatepark 2', 'Rolla'],
      ['', 'Rolla'],
    ]) {
      expect(isGenericWorldName(name!, town!), `${name} in ${town}`).toBe(true);
    }
  });

  it('keeps a name that says which park, in any script', () => {
    for (const [name, town] of [
      ['Finlathen skatepark', 'Dundee'],
      ['Southbank Undercroft', 'London'],
      ['Skatepark de l’Hippodrome', 'Vaulx-en-Velin'],
      ['Скейтпарк Сокольники', 'Moscow'],
      ['駒沢公園スケートパーク', 'Tokyo'],
    ]) {
      expect(isGenericWorldName(name!, town!), `${name} in ${town}`).toBe(false);
    }
  });
});

describe('tidyName', () => {
  it('gives the source map’s lowercase suffix its capital', () => {
    expect(tidyName('Finlathen skatepark')).toBe('Finlathen Skatepark');
    expect(tidyName('Sense Pump Zone pumptrack')).toBe('Sense Pump Zone Pumptrack');
  });

  it('re-cases shouting and leaves a human’s casing alone', () => {
    expect(tidyName('KINGS PARK SKATEPARK')).toBe('Kings Park Skatepark');
    expect(tidyName('SkatePark Saint-Joseph')).toBe('SkatePark Saint-Joseph');
  });
});

describe('baseName', () => {
  const place = (over: Partial<RowFields>) => collapseWorld([row(over)])[0]!;

  it('prefers OpenStreetMap’s name to Trucks and Fins’', () => {
    expect(
      baseName(
        place({ osm: 'w1', osmName: 'Kings Park', tnfName: 'Leeds skatepark', town: 'Leeds' }),
      ),
    ).toBe('Kings Park');
  });

  it('falls back to Trucks and Fins’ name when OpenStreetMap’s is generic', () => {
    expect(
      baseName(
        place({ osm: 'w1', osmName: 'Skate Park', tnfName: 'Finlathen skatepark', town: 'Dundee' }),
      ),
    ).toBe('Finlathen Skatepark');
  });

  it('calls a park with no name of its own "Skatepark"', () => {
    expect(baseName(place({ tnfName: 'Rolla skatepark', town: 'Rolla' }))).toBe('Skatepark');
  });

  it('never returns a name wider than the column', () => {
    expect(baseName(place({ tnfName: `${'Very long name '.repeat(8)}skatepark` }))).toBe(
      'Skatepark',
    );
  });
});

describe('collapseWorld', () => {
  it('makes one place of two listings a few metres apart, led by the mapped one', () => {
    const places = collapseWorld([
      row({ id: 5, flags: TNF_FLAG.bowl }),
      row({ id: 9, osm: 'n1', lat: north(37.9561, 20), flags: TNF_FLAG.miniRamp }),
    ]);
    expect(places).toHaveLength(1);
    expect(places[0]!.rows[0]![0]).toBe(9);
    expect(places[0]!.matched).toBe(true);
    expect(places[0]!.flags).toBe(TNF_FLAG.bowl | TNF_FLAG.miniRamp);
  });

  it('keeps two parks 200 metres apart as two', () => {
    expect(collapseWorld([row({ id: 1 }), row({ id: 2, lat: north(37.9561, 200) })])).toHaveLength(
      2,
    );
  });

  it('collapses a chain, each link under 50 metres', () => {
    const lat = 37.9561;
    expect(
      collapseWorld([
        row({ id: 1, lat }),
        row({ id: 2, lat: north(lat, 40) }),
        row({ id: 3, lat: north(lat, 80) }),
      ]),
    ).toHaveLength(1);
  });
});

describe('nameWorldSpots', () => {
  const places = (rows: readonly WorldSourceRow[]) => collapseWorld(rows);

  it('tells two nameless parks in one town apart', () => {
    expect(nameWorldSpots(places([row({ id: 1 }), row({ id: 2, lat: 38.1 })]))).toEqual([
      'Skatepark',
      'Skatepark 2',
    ]);
  });

  it('counts past a name a spot already seeded holds in that town', () => {
    expect(nameWorldSpots(places([row()]), [{ name: 'Skatepark', town: 'Rolla' }])).toEqual([
      'Skatepark 2',
    ]);
  });

  it('lets the same name stand in two towns', () => {
    expect(
      nameWorldSpots(
        places([
          row({ id: 1 }),
          row({ id: 2, lat: 38.1, tnfName: 'Salem skatepark', town: 'Salem' }),
        ]),
      ),
    ).toEqual(['Skatepark', 'Skatepark']);
  });
});

describe('tagsFor', () => {
  it('turns the feature filters into explained tags', () => {
    const tags = tagsFor(TNF_FLAG.bowl | TNF_FLAG.miniRamp | TNF_FLAG.pumpTrack | TNF_FLAG.diy);
    expect([...tags].sort()).toEqual(['Bowl', 'DIY', 'Mini', 'Pump track']);
    for (const tag of tags) expect(spotFeature(tag), tag).not.toBeNull();
  });

  it('makes no tag of a filter that is not a feature', () => {
    expect(
      tagsFor(
        TNF_FLAG.concrete |
          TNF_FLAG.seventies |
          TNF_FLAG.indoor |
          TNF_FLAG.closed |
          TNF_FLAG.streetSpot,
      ),
    ).toEqual([]);
  });
});

describe('worldSpots', () => {
  it('lists a pump track for BMX (the owner’s call, 2026-09-11)', () => {
    expect(alone([row({ flags: TNF_FLAG.pumpTrack })])[0]!.sports).toEqual([
      'scooter',
      'skate',
      'bmx',
    ]);
  });

  it('lists BMX where OpenStreetMap or a name says so, and otherwise scooter and skate', () => {
    expect(alone([row({ osm: 'w1', osmBits: OSM_BIT.bmx })])[0]!.sports).toContain('bmx');
    expect(alone([row({ tnfName: 'Rolla BMX park' })])[0]!.sports).toContain('bmx');
    expect(alone([row()])[0]!.sports).toEqual(['scooter', 'skate']);
  });

  it('stamps a mapped park osm-tnf and an unmapped one tnf', () => {
    const [mapped] = alone([row({ osm: 'w1' })]);
    const [unmapped] = alone([row()]);
    expect([mapped!.source, mapped!.licence]).toEqual([
      SPOT_SOURCES['osm-tnf'].id,
      SPOT_SOURCES['osm-tnf'].licence,
    ]);
    expect([unmapped!.source, unmapped!.licence]).toEqual([
      SPOT_SOURCES.tnf.id,
      SPOT_SOURCES.tnf.licence,
    ]);
  });

  it('says a park has gone only where a source does', () => {
    expect(alone([row({ flags: TNF_FLAG.closed })])[0]!.operating).toBe('closed');
    expect(alone([row({ osm: 'w1', osmBits: OSM_BIT.closed })])[0]!.operating).toBe('closed');
    expect(alone([row()])[0]!.operating).toBe('unknown');
  });

  it('reads the roof and the street spot into the type', () => {
    expect(alone([row({ flags: TNF_FLAG.indoor })])[0]).toMatchObject({
      indoor: true,
      type: 'Indoor park',
    });
    expect(alone([row({ osm: 'w1', osmBits: OSM_BIT.covered })])[0]!.indoor).toBe(true);
    expect(alone([row({ flags: TNF_FLAG.streetSpot })])[0]!.type).toBe('Street spot');
    expect(alone([row()])[0]).toMatchObject({ indoor: false, type: 'Concrete' });
  });

  it('carries an address and a phone only where OpenStreetMap gave one', () => {
    const [bare] = alone([row()]);
    expect(bare!.address).toBeUndefined();
    expect(bare!.phone).toBeUndefined();
    const [full] = alone([row({ osm: 'w1', address: '1600 Farrar Drive', phone: '+1 573 000' })]);
    expect(full).toMatchObject({ address: '1600 Farrar Drive', phone: '+1 573 000' });
  });

  it('drops a park a spot already seeded stands on', () => {
    const existing = { ...(SPOTS[0] as Spot), lat: 37.9561, lng: -91.7568 };
    expect(worldSpots([row()], [existing])).toEqual([]);
    expect(worldSpots([row({ lat: north(37.9561, 400) })], [existing])).toHaveLength(1);
  });
});

type OsmFields = {
  ref: string;
  lat: number;
  lng: number;
  name: string;
  bits: number;
  area: number;
  address: string;
  phone: string;
  town: string;
  country: string;
};

const osmRow = (over: Partial<OsmFields> = {}): WorldOsmRow => [
  over.ref ?? 'w1',
  over.lat ?? 51.5,
  over.lng ?? -0.1,
  over.name ?? '',
  over.bits ?? 0,
  over.area ?? 500,
  over.address ?? '',
  over.phone ?? '',
  over.town ?? 'London',
  over.country ?? 'GB',
];

/** The OpenStreetMap-only mapping with nothing already seeded. */
const osmAlone = (rows: readonly WorldOsmRow[]): readonly Spot[] => osmOnlySpots(rows, []);

describe('osmOnlySpots (#390)', () => {
  it('keeps a park of 300 m² and leaves a 299 m² ramp out', () => {
    expect(osmAlone([osmRow({ area: 300 })])).toHaveLength(1);
    expect(osmAlone([osmRow({ area: 299 })])).toEqual([]);
  });

  it('adds up the pieces of one park before measuring it', () => {
    const spots = osmAlone([
      osmRow({ ref: 'w1', area: 160 }),
      osmRow({ ref: 'w2', area: 160, lat: north(51.5, 20) }),
    ]);
    expect(spots).toHaveLength(1);
  });

  it('never lists a private one, and never lets it lend its size', () => {
    expect(osmAlone([osmRow({ bits: OSM_BIT.private, area: 5000 })])).toEqual([]);
    expect(
      osmAlone([
        osmRow({ ref: 'w1', area: 200 }),
        osmRow({ ref: 'w2', area: 5000, bits: OSM_BIT.private, lat: north(51.5, 20) }),
      ]),
    ).toEqual([]);
  });

  it('drops a place a spot already seeded stands on', () => {
    const existing = { ...(SPOTS[0] as Spot), lat: 51.5, lng: -0.1 };
    expect(osmOnlySpots([osmRow()], [existing])).toEqual([]);
    expect(osmOnlySpots([osmRow({ lat: north(51.5, 400) })], [existing])).toHaveLength(1);
  });

  it('is plain OpenStreetMap: source osm, Open Database Licence', () => {
    expect(osmAlone([osmRow()])[0]).toMatchObject({
      source: SPOT_SOURCES.osm.id,
      licence: SPOT_SOURCES.osm.licence,
    });
  });

  it('names a nameless park "Skatepark", a nameless pump track "Pump track", and keeps a real name', () => {
    expect(osmAlone([osmRow()])[0]!.name).toBe('Skatepark');
    const [pump] = osmAlone([osmRow({ name: 'Pumptrack Koppl', town: 'Koppl' })]);
    expect(pump).toMatchObject({ name: 'Pump track', tags: ['Pump track'] });
    expect(pump!.sports).toContain('bmx');
    expect(osmAlone([osmRow({ name: 'Kings Park Bowl' })])[0]!.name).toBe('Kings Park Bowl');
  });

  it('lists BMX where the sport tag says so, and otherwise scooter and skate', () => {
    expect(osmAlone([osmRow({ bits: OSM_BIT.bmx })])[0]!.sports).toContain('bmx');
    expect(osmAlone([osmRow()])[0]!.sports).toEqual(['scooter', 'skate']);
  });

  it('counts past a name a seeded spot holds in the same town', () => {
    const existing = { ...(SPOTS[0] as Spot), name: 'Skatepark', town: 'London', lat: 0, lng: 0 };
    expect(osmOnlySpots([osmRow()], [existing])[0]!.name).toBe('Skatepark 2');
  });
});

describe('the snapshot', () => {
  const world = worldSpots();
  const osmOnly = osmOnlySpots();
  const spots = [...world, ...osmOnly];
  const existing = [...(SPOTS as readonly Spot[]), ...franceSpots()];
  const label = (spot: Spot) => `${spot.name}|${spot.town}`;

  /*
   * Each rule below walks twenty-five thousand rows, so each collects what
   * breaks it and asserts once: an `expect` per row per rule is a quarter of a
   * million calls, which is slow enough to time out under a full test run, and
   * a single list of offenders is the more useful failure anyway.
   */

  it('was taken on the day the credit line prints', () => {
    expect(SPOT_SOURCES['osm-tnf'].snapshot).toBe(WORLD_SNAPSHOT_DATE);
    expect(SPOT_SOURCES.tnf.snapshot).toBe(WORLD_SNAPSHOT_DATE);
    expect(SPOT_SOURCES.osm.snapshot).toBe(WORLD_SNAPSHOT_DATE);
  });

  it('has thousands of parks, from the three world sources only', () => {
    expect(world.length).toBeGreaterThan(WORLD_SOURCE_ROWS.length / 2);
    expect(osmOnly.length).toBeGreaterThan(1000);
    expect(osmOnly.filter((spot) => spot.source !== 'osm')).toEqual([]);
    expect(world.filter((spot) => spot.source !== 'osm-tnf' && spot.source !== 'tnf')).toEqual([]);
  });

  it('never repeats a name in a town, or takes one a seeded spot holds', () => {
    const keys = new Set(existing.map(label));
    const clashes: string[] = [];
    for (const spot of spots) {
      if (keys.has(label(spot))) clashes.push(label(spot));
      keys.add(label(spot));
    }
    expect(clashes).toEqual([]);
  });

  it('keeps every value inside its column', () => {
    const types = new Set<string>(SPOT_TYPES);
    const outside = spots
      .filter(
        (spot) =>
          spot.name.length === 0 ||
          spot.name.length > 80 ||
          spot.town.length === 0 ||
          spot.town.length > 60 ||
          (spot.country ?? '').length > 60 ||
          (spot.address ?? '').length > 200 ||
          (spot.phone ?? '').length > 40 ||
          !types.has(spot.type) ||
          spot.tags.length > 8,
      )
      .map(label);
    expect(outside).toEqual([]);
  });

  it('puts every park in a country a rider’s code can reach', () => {
    const reachable = new Set(Object.values(SPOT_COUNTRY_BY_CODE));
    const lost = [...new Set(spots.map((spot) => spot.country ?? ''))].filter(
      (country) => !reachable.has(country),
    );
    expect(lost).toEqual([]);
  });

  it('never shows a name or a town still HTML-escaped from the source page', () => {
    const entity = /&(#\d+|#x[0-9a-f]+|[a-z]+);/i;
    expect(
      spots.filter((spot) => entity.test(spot.name) || entity.test(spot.town)).map(label),
    ).toEqual([]);
  });

  it('explains every tag it uses', () => {
    const tags = new Set(spots.flatMap((spot) => spot.tags));
    expect([...tags].filter((tag) => spotFeature(tag) === null)).toEqual([]);
  });

  it('drops every park a researched or French spot already stands on', () => {
    const cell = (lat: number, lng: number) => `${Math.round(lat * 50)},${Math.round(lng * 50)}`;
    const index = new Map<string, Spot[]>();
    for (const spot of existing) {
      const key = cell(spot.lat, spot.lng);
      index.set(key, [...(index.get(key) ?? []), spot]);
    }
    const onTop: string[] = [];
    for (const spot of spots) {
      for (const dy of [-1, 0, 1]) {
        for (const dx of [-1, 0, 1]) {
          for (const other of index.get(cell(spot.lat + dy / 50, spot.lng + dx / 50)) ?? []) {
            if (distanceMiles(spot, other) <= 0.1) onTop.push(`${label(spot)} on ${label(other)}`);
          }
        }
      }
    }
    expect(onTop).toEqual([]);
  });
});
