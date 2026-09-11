import { describe, expect, it } from 'vitest';

import {
  SPOT_SOURCES,
  creditedSpotSources,
  isIndexedSpotSource,
  spotCredits,
  unindexedSpotSourceIds,
} from './spot-sources';

describe('isIndexedSpotSource', () => {
  it('keeps the world import out of search (the owner, 2026-09-11)', () => {
    expect(isIndexedSpotSource('osm-tnf')).toBe(false);
    expect(isIndexedSpotSource('tnf')).toBe(false);
    expect(isIndexedSpotSource('osm')).toBe(false);
    expect(unindexedSpotSourceIds()).toEqual(['osm-tnf', 'tnf', 'osm']);
  });

  it('leaves every other page as it was, including rows that predate the column', () => {
    for (const id of ['researched', 'rider', 'fr-sports-gouv', '', null, undefined, 'mystery']) {
      expect(isIndexedSpotSource(id), String(id)).toBe(true);
    }
  });

  it('is not fooled by a name every object has', () => {
    expect(isIndexedSpotSource('toString')).toBe(true);
    expect(isIndexedSpotSource('constructor')).toBe(true);
  });
});

describe('spotCredits', () => {
  it('names every credited source in order, then each dataset they draw on once', () => {
    const names = spotCredits().map((credit) => credit.name);
    expect(names).toEqual([
      ...new Set(creditedSpotSources().map((source) => source.name)),
      'GeoNames',
    ]);
    expect(names.filter((name) => name === 'OpenStreetMap contributors')).toHaveLength(1);
    expect(new Set(names).size).toBe(names.length);
  });

  it('carries the snapshot date of a source that has one, for the credit line', () => {
    const osm = spotCredits().find((credit) => credit.name === SPOT_SOURCES['osm-tnf'].name);
    expect(osm?.snapshot).toBe(SPOT_SOURCES['osm-tnf'].snapshot);
  });

  it('never credits a source that granted no licence', () => {
    expect(creditedSpotSources().map((source) => source.id)).not.toContain('tnf');
    for (const source of creditedSpotSources()) expect(source.licenceName).not.toBe('');
  });
});

describe('SPOT_SOURCES', () => {
  it('fits every id and licence in its 40-character column', () => {
    for (const source of Object.values(SPOT_SOURCES)) {
      expect(source.id.length, source.id).toBeLessThanOrEqual(40);
      expect(source.licence.length, source.id).toBeLessThanOrEqual(40);
    }
  });

  it('says honestly that the world rows carry no licence of their own', () => {
    expect(SPOT_SOURCES['osm-tnf'].licence).toBe('ODbL-1.0 AND LicenseRef-none');
    expect(SPOT_SOURCES.tnf.licence).toBe('LicenseRef-none');
  });

  it('gives the OpenStreetMap-only rows the plain licence they carry', () => {
    expect(SPOT_SOURCES.osm.licence).toBe('ODbL-1.0');
    expect(SPOT_SOURCES.osm.credited).toBe(true);
  });
});
