import { readFileSync } from 'node:fs';

import {
  SPOTS,
  SPOT_COUNTRY_BY_CODE,
  SPOT_SOURCES,
  SPOT_TYPES,
  distanceMiles,
  type Spot,
} from '@landit/core';
import { describe, expect, it } from 'vitest';

import {
  baseName,
  collapsePlaces,
  franceSpots,
  isCovered,
  isGenericName,
  nameSpots,
  recaseName,
  sportsEvidence,
  streetName,
  territoryFor,
  townFor,
  type FranceSourceRow,
} from './france';
import { FRANCE_SNAPSHOT_DATE, FRANCE_SOURCE_ROWS } from './france.data';

/**
 * The France mapping, against both hand-written rows and the real snapshot.
 *
 * The rules are pure, so the unit tests below are the whole proof; the
 * integration test in `../seed.integration.test.ts` only has to show the rows
 * land. The snapshot tests are deliberately written against *properties* — no
 * duplicate name in a town, every country reachable, every value inside its
 * column — rather than against counts copied from a run, so a re-fetch that
 * changes the numbers fails only if it breaks a rule (LESSONS §10).
 */

const row = (
  over: Partial<
    Record<'id' | 'inst' | 'eq' | 'commune' | 'cp' | 'street' | 'nature' | 'sol', string>
  > &
    Partial<Record<'lat' | 'lng', number>> = {},
): FranceSourceRow => [
  over.id ?? 'E001I000000001',
  over.inst ?? 'SKATE PARK',
  over.eq ?? 'Skate park',
  over.commune ?? 'Dreux',
  over.cp ?? '28100',
  over.street ?? 'Rue du Stade',
  over.lat ?? 48.7355,
  over.lng ?? 1.3665,
  over.nature ?? 'Découvert',
  over.sol ?? 'Bitume',
];

describe('isGenericName', () => {
  it('reads every spelling of "skate park" as generic', () => {
    for (const name of [
      'SKATE PARK',
      'Skate parc',
      'skatepark',
      'Skate-Park',
      'SKATE  PARK',
      'Skate park 2',
      'Piste de skate',
      'Aire de skate board',
      'Rampe de skate',
      'Skate park couvert',
      'Mini skate park',
      'Roller skate park',
      'Bowl',
      'Pumptrack',
    ]) {
      expect(isGenericName(name), name).toBe(true);
    }
  });

  it('reads a facility type with no proper noun as generic', () => {
    for (const name of [
      'Complexe sportif',
      'COMPLEXE SPORTIF MUNICIPAL',
      'Stade municipal',
      'Terrain multisports',
      'Plateau sportif',
      'Aire de jeux et loisirs',
      'Parc des sports',
      'City stade',
      'Espace de glisse',
    ]) {
      expect(isGenericName(name), name).toBe(true);
    }
  });

  it('keeps a name that says which place', () => {
    for (const name of [
      'STADE JEAN MOULIN',
      'Skate park Vinaigrerie',
      "AIRE DE JEUX ET LOISIRS CAPRIATA D'ORBA",
      'Complexe Georges Fustier',
      'Skate Park de Bercy',
      'Espace Glisse Paris 18',
    ]) {
      expect(isGenericName(name), name).toBe(false);
    }
  });
});

describe('recaseName', () => {
  it('title-cases a shouted name and keeps French particles low', () => {
    expect(recaseName('STADE JEAN MOULIN')).toBe('Stade Jean Moulin');
    expect(recaseName('COMPLEXE SPORTIF DE LA GARE')).toBe('Complexe Sportif de la Gare');
    expect(recaseName("AIRE DE JEUX CAPRIATA D'ORBA")).toBe('Aire de Jeux Capriata d’Orba');
    expect(recaseName('SKATE PARK SAINT-JOSEPH')).toBe('Skate Park Saint-Joseph');
    expect(recaseName('PISTE BMX DES BOIFFIERS')).toBe('Piste BMX des Boiffiers');
  });

  it('title-cases a whispered or sentence-cased name', () => {
    expect(recaseName('skate park de la gare')).toBe('Skate Park de la Gare');
    expect(recaseName('Skate park valgelas')).toBe('Skate Park Valgelas');
  });

  it('tolerates a lowercase particle inside a shouted name', () => {
    expect(recaseName('TERRAIN PHILOMENE DUCHAMP et SKATEPARK')).toBe(
      'Terrain Philomene Duchamp et Skatepark',
    );
  });

  it('leaves a name a human cased alone, and only tidies its spaces', () => {
    expect(recaseName('SkatePark Saint-Joseph')).toBe('SkatePark Saint-Joseph');
    expect(recaseName('Skate  Park   Mont Olympe')).toBe('Skate Park Mont Olympe');
    expect(recaseName('Skate Park - TREILLES')).toBe('Skate Park - TREILLES');
  });

  it('capitalises a particle that opens the name', () => {
    expect(recaseName('LA CHALP ARVIEUX')).toBe('La Chalp Arvieux');
    expect(recaseName("L'ÉTANG")).toBe('L’Étang');
  });
});

describe('territoryFor', () => {
  it('names each overseas territory from its postcode prefix', () => {
    expect(territoryFor('97139')).toBe('Guadeloupe');
    expect(territoryFor('97233')).toBe('Martinique');
    expect(territoryFor('97300')).toBe('French Guiana');
    expect(territoryFor('97419')).toBe('Réunion');
    expect(territoryFor('97500')).toBe('St Pierre & Miquelon');
    expect(territoryFor('97615')).toBe('Mayotte');
    expect(territoryFor('98714')).toBe('French Polynesia');
    expect(territoryFor('98800')).toBe('New Caledonia');
  });

  it('is France for everything else, the two-digit overseas look-alikes included', () => {
    expect(territoryFor('28100')).toBe('France');
    expect(territoryFor('97000')).toBe('France');
    expect(territoryFor('')).toBe('France');
  });

  it('spells every territory the way the country table can route to', () => {
    const reachable = new Set(Object.values(SPOT_COUNTRY_BY_CODE));
    for (const cp of [
      '97139',
      '97233',
      '97300',
      '97419',
      '97500',
      '97615',
      '98714',
      '98800',
      '28100',
    ]) {
      expect(reachable, territoryFor(cp)).toContain(territoryFor(cp));
    }
  });
});

describe('isCovered', () => {
  it('reads a hall, a canopy and an opening roof as covered, and nothing else', () => {
    expect(isCovered('Intérieur')).toBe(true);
    expect(isCovered('Extérieur couvert')).toBe(true);
    expect(isCovered('Découvrable')).toBe(true);
    expect(isCovered('Découvert')).toBe(false);
    expect(isCovered('Site naturel aménagé')).toBe(false);
    expect(isCovered('')).toBe(false);
  });
});

describe('townFor and streetName', () => {
  it('drops an arrondissement from the town but not from anything else', () => {
    expect(townFor('Paris 18e Arrondissement')).toBe('Paris');
    expect(townFor('Lyon 1er Arrondissement')).toBe('Lyon');
    expect(townFor('Parisot')).toBe('Parisot');
    expect(townFor('Saint-Pierre')).toBe('Saint-Pierre');
  });

  it('strips a house number and keeps the street', () => {
    expect(streetName('6 rue du château')).toBe('rue du château');
    expect(streetName('12 bis Avenue des Alpes')).toBe('Avenue des Alpes');
    expect(streetName('Chemin de la Scierie')).toBe('Chemin de la Scierie');
  });
});

describe('collapsePlaces', () => {
  it('folds the pieces of one park at one point into one place, indoor if any is', () => {
    const rows = [
      row({ id: 'E002', eq: 'Skate park 2' }),
      row({ id: 'E001', eq: 'Skate park', nature: 'Intérieur' }),
      row({ id: 'E003', eq: 'Skate park 3', lat: 48.73551 }),
    ];
    const places = collapsePlaces(rows);
    expect(places).toHaveLength(1);
    expect(places[0]!.rows.map((r) => r[0])).toEqual(['E001', 'E002', 'E003']);
    expect(places[0]!.indoor).toBe(true);
  });

  it('keeps two parks in one commune apart when the points differ', () => {
    expect(collapsePlaces([row({ id: 'E001' }), row({ id: 'E002', lat: 48.74 })])).toHaveLength(2);
  });

  it('keeps the same point apart when the communes differ', () => {
    expect(
      collapsePlaces([row({ id: 'E001' }), row({ id: 'E002', commune: 'Vernouillet' })]),
    ).toHaveLength(2);
  });
});

describe('baseName and nameSpots', () => {
  it('prefers a real installation name, then a real equipment name, then "Skatepark"', () => {
    expect(baseName(collapsePlaces([row({ inst: 'STADE JEAN MOULIN' })])[0]!)).toBe(
      'Stade Jean Moulin',
    );
    expect(
      baseName(collapsePlaces([row({ inst: 'COMPLEXE SPORTIF', eq: 'Bowl du Prado' })])[0]!),
    ).toBe('Bowl du Prado');
    expect(baseName(collapsePlaces([row()])[0]!)).toBe('Skatepark');
  });

  it('leaves two generic parks in different towns both called "Skatepark"', () => {
    const places = collapsePlaces([
      row({ id: 'E001' }),
      row({ id: 'E002', commune: 'Vitré', lat: 48.12 }),
    ]);
    expect(nameSpots(places)).toEqual(['Skatepark', 'Skatepark']);
  });

  it('tells two generic parks in one town apart by street, then by ordinal', () => {
    const places = collapsePlaces([
      row({ id: 'E001', street: '6 rue du château' }),
      row({ id: 'E002', lat: 48.74, street: 'Avenue des Alpes' }),
      row({ id: 'E003', lat: 48.75, street: '' }),
    ]);
    expect(nameSpots(places)).toEqual([
      'Skatepark Rue du Château',
      'Skatepark Avenue des Alpes',
      'Skatepark 2',
    ]);
  });

  it('names a park by its equipment when the installation name says nothing', () => {
    const places = collapsePlaces([
      row({ id: 'E001', eq: 'Bowl' }),
      row({ id: 'E002', lat: 48.74, eq: 'Piste BMX des Boiffiers' }),
    ]);
    expect(nameSpots(places)).toEqual(['Skatepark', 'Piste BMX des Boiffiers']);
  });

  it('tells two parks at one venue apart by their equipment names before the street', () => {
    const places = collapsePlaces([
      row({ id: 'E001', inst: 'STADE JEAN MOULIN', eq: 'Skate park nord' }),
      row({ id: 'E002', lat: 48.74, inst: 'STADE JEAN MOULIN', eq: 'Skate park sud' }),
    ]);
    expect(nameSpots(places)).toEqual(['Skate Park Nord', 'Skate Park Sud']);
  });

  it('never lets a contested park take an uncontested park’s name', () => {
    const places = collapsePlaces([
      row({ id: 'E001', inst: 'SKATE PARK', eq: 'Skate park' }),
      row({ id: 'E002', lat: 48.74, inst: 'SKATE PARK', eq: 'Skate park' }),
      row({ id: 'E003', lat: 48.75, inst: 'Skatepark Rue du Stade' }),
    ]);
    const names = nameSpots(places);
    expect(new Set(names).size).toBe(3);
    expect(names[2]).toBe('Skatepark Rue du Stade');
  });
});

describe('franceSpots', () => {
  it('drops a row that sits on a hand-researched spot', () => {
    const curated: Spot[] = [
      {
        name: 'Skate park Jules Noël',
        town: 'Paris',
        type: 'Concrete',
        lat: 48.7355,
        lng: 1.3665,
        sports: ['skate'],
        tags: [],
        status: 'live',
      },
    ];
    expect(franceSpots([row()], curated)).toHaveLength(0);
    expect(franceSpots([row({ lat: 48.8 })], curated)).toHaveLength(1);
  });

  it('writes what the census can say and nothing it cannot', () => {
    const [spot] = franceSpots([row({ inst: 'STADE JEAN MOULIN', nature: 'Intérieur' })], []);
    expect(spot).toEqual({
      name: 'Stade Jean Moulin',
      town: 'Dreux',
      country: 'France',
      type: 'Indoor park',
      lat: 48.7355,
      lng: 1.3665,
      sports: ['scooter', 'skate'],
      tags: [],
      status: 'live',
      address: 'Rue du Stade, 28100 Dreux',
      indoor: true,
      operating: 'unknown',
      source: 'fr-sports-gouv',
      licence: 'etalab-2.0',
    });
  });

  it('re-cases a shouted street in the address', () => {
    const [spot] = franceSpots([row({ street: '39 BOULEVARD VINCENT AURIOL' })], []);
    expect(spot!.address).toBe('39 Boulevard Vincent Auriol, 28100 Dreux');
  });
});

describe('sportsEvidence', () => {
  const place = (...rows: FranceSourceRow[]) => collapsePlaces(rows)[0]!;

  it('reads a census that says nothing as a park with no BMX', () => {
    expect(sportsEvidence(place(row()))).toEqual({ bmx: false, bmxTrackOnly: false });
  });

  it('takes BMX from either name column, whatever its case', () => {
    expect(sportsEvidence(place(row({ inst: 'Skate Park & BMX' }))).bmx).toBe(true);
    expect(sportsEvidence(place(row({ eq: 'Aire de skate, roller et bmx' }))).bmx).toBe(true);
  });

  it('never finds BMX inside another word', () => {
    expect(sportsEvidence(place(row({ inst: 'SUBMX ARENA' }))).bmx).toBe(false);
  });

  it('reads a BMX track on dirt as a BMX track', () => {
    expect(sportsEvidence(place(row({ eq: 'PISTE DE BMX', sol: 'Terre battue' })))).toEqual({
      bmx: true,
      bmxTrackOnly: true,
    });
  });

  it('keeps every sport where any piece of the place is hard ground', () => {
    const mixed = place(
      row({ id: 'E001I000000001', eq: 'PISTE DE BMX', sol: 'Terre battue' }),
      row({ id: 'E001I000000002', eq: 'Skate park', sol: 'Béton' }),
    );
    expect(sportsEvidence(mixed)).toEqual({ bmx: true, bmxTrackOnly: false });
  });

  it('never takes a sport away for loose ground alone', () => {
    expect(sportsEvidence(place(row({ sol: 'Gazon naturel' })))).toEqual({
      bmx: false,
      bmxTrackOnly: false,
    });
  });
});

describe('the snapshot', () => {
  const spots = franceSpots();

  it('is the size the research said, give or take a re-fetch', () => {
    // 3,141 in issue #362; the census gains a few rows a week.
    expect(FRANCE_SOURCE_ROWS.length).toBeGreaterThan(3000);
    expect(spots.length).toBeGreaterThan(3000);
    expect(spots.length).toBeLessThanOrEqual(FRANCE_SOURCE_ROWS.length);
  });

  it('is dated the day the credit line says', () => {
    expect(SPOT_SOURCES['fr-sports-gouv'].snapshot).toBe(FRANCE_SNAPSHOT_DATE);
  });

  it('has no two spots with one name in one town', () => {
    const keys = spots.map((s) => `${s.name}|${s.town}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('fits every value inside its column', () => {
    for (const spot of spots) {
      expect(spot.name.length, spot.name).toBeLessThanOrEqual(80);
      expect(spot.town.length, spot.town).toBeLessThanOrEqual(60);
      expect(spot.address!.length, spot.address).toBeLessThanOrEqual(200);
      expect(spot.country!.length).toBeLessThanOrEqual(60);
      expect(SPOT_TYPES).toContain(spot.type);
      expect(Math.abs(spot.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(spot.lng)).toBeLessThanOrEqual(180);
    }
  });

  it('routes every country it names from a region code', () => {
    const reachable = new Set(Object.values(SPOT_COUNTRY_BY_CODE));
    for (const country of new Set(spots.map((s) => s.country))) {
      expect(reachable, country).toContain(country);
    }
  });

  it('lists scooter and skate, BMX where named, and never claims a park is open', () => {
    for (const spot of spots) {
      expect([['scooter', 'skate'], ['scooter', 'skate', 'bmx'], ['bmx']]).toContainEqual([
        ...spot.sports,
      ]);
      expect(spot.operating).toBe('unknown');
      expect(spot.status).toBe('live');
    }
  });

  it('lists a park for BMX alone only where it is a BMX track on loose ground', () => {
    const at = new Map(collapsePlaces(FRANCE_SOURCE_ROWS).map((p) => [`${p.lat},${p.lng}`, p]));
    for (const spot of spots.filter((s) => s.sports.length === 1)) {
      const found = at.get(`${spot.lat},${spot.lng}`)!;
      expect(sportsEvidence(found).bmxTrackOnly, spot.name).toBe(true);
    }
  });

  /*
   * The migration that brought the live rows level lists its BMX places as
   * text, because a JSVM migration cannot import from the workspace. It is read
   * here the way `pocketbase/tests/spot-slugs.test.ts` reads its own, and this
   * fails if the two ever disagree about which park gets BMX.
   */
  it('agrees with the live-data migration about every BMX park', () => {
    const migration = readFileSync(
      new URL(
        '../../../../pocketbase/migrations/1789084800_import_sports_rule.js',
        import.meta.url,
      ),
      'utf8',
    );
    const listed = (name: string): string[] => {
      const block = new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\);`).exec(migration);
      if (!block) throw new Error(`${name} is not in the migration any more.`);
      return [...block[1]!.matchAll(/'([^']*)'/g)].map((m) => m[1]!).sort();
    };
    const keyOf = (s: Spot) => `${s.name}|${s.town}`;
    expect(listed('WITH_BMX')).toEqual(
      spots
        .filter((s) => s.sports.length === 3)
        .map(keyOf)
        .sort(),
    );
    expect(listed('BMX_ONLY')).toEqual(
      spots
        .filter((s) => s.sports.length === 1)
        .map(keyOf)
        .sort(),
    );
  });

  it('stamps every row with the census and its licence', () => {
    for (const spot of spots) {
      expect(spot.source).toBe(SPOT_SOURCES['fr-sports-gouv'].id);
      expect(spot.licence).toBe(SPOT_SOURCES['fr-sports-gouv'].licence);
    }
  });

  it('marks the covered parks indoor, and calls them indoor parks', () => {
    const indoor = spots.filter((s) => s.indoor);
    expect(indoor.length).toBeGreaterThan(40);
    for (const spot of indoor) expect(spot.type).toBe('Indoor park');
    for (const spot of spots.filter((s) => !s.indoor)) expect(spot.type).toBe('Concrete');
  });

  it('does not re-import a park a session already researched', () => {
    const curated = (SPOTS as readonly Spot[]).filter((s) => s.country === 'France');
    for (const spot of curated) {
      const twin = spots.find((s) => distanceMiles(s, spot) <= 0.1);
      expect(twin, `${spot.name} was imported again as ${twin?.name}`).toBeUndefined();
    }
  });

  it('names the overseas territories, and there are a few dozen of them', () => {
    const overseas = spots.filter((s) => s.country !== 'France');
    expect(overseas.length).toBeGreaterThan(30);
    expect(overseas.length).toBeLessThan(80);
    expect(new Set(overseas.map((s) => s.country))).toContain('Réunion');
    expect(new Set(overseas.map((s) => s.country))).toContain('New Caledonia');
  });
});
