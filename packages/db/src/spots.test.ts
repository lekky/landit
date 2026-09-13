import { SPORT_IDS } from '@landit/core';
import { describe, expect, it } from 'vitest';

import { pageWindows, spotListFilter, spotPlaceFilters } from './spots';

/**
 * The pure halves of the paged spots list. The filters' *meaning* is proven
 * against a real PocketBase in `spots.integration.test.ts`; this is the shape
 * of what is sent and the arithmetic of what is asked for.
 */

describe('spotListFilter', () => {
  it('asks for live spots and nothing else when there is no query', () => {
    expect(spotListFilter({})).toEqual({ filter: "status = 'live'", params: {} });
  });

  it('folds a search to lowercase and looks in the name, the town and the tags', () => {
    const { filter, params } = spotListFilter({ search: '  Bowl ' });
    expect(params).toEqual({ q: 'bowl' });
    expect(filter).toContain('name:lower ~ {:q}');
    expect(filter).toContain('town:lower ~ {:q}');
    expect(filter).toContain('tags:lower ~ {:q}');
  });

  it('lets a park with no sports listed match every sport', () => {
    const { filter, params } = spotListFilter({ sport: 'bmx' });
    expect(params).toEqual({ sport0: 'bmx' });
    expect(filter).toContain('sports:each ?= {:sport0}');
    expect(filter).toContain('sports:length = 0');
  });

  it('ORs the chosen sports, with one escape for the untagged park', () => {
    const { filter, params } = spotListFilter({ sports: ['scooter', 'bmx'] });
    expect(params).toEqual({ sport0: 'scooter', sport1: 'bmx' });
    expect(filter).toContain(
      '(sports:each ?= {:sport0} || sports:each ?= {:sport1} || sports:length = 0)',
    );
  });

  it('asks for no sport clause when every sport is chosen', () => {
    // Every sport matches everything the unfiltered query matches, and three
    // `:each` scans of a JSON column to prove it is three scans wasted.
    expect(spotListFilter({ sports: [...SPORT_IDS] })).toEqual({
      filter: "status = 'live'",
      params: {},
    });
  });

  it('prefers the chosen list over the single sport a caller also sent', () => {
    const { params } = spotListFilter({ sport: 'skate', sports: ['bmx'] });
    expect(params).toEqual({ sport0: 'bmx' });
  });

  it('matches a feature as a whole tag, quotes included, case folded', () => {
    const { filter, params } = spotListFilter({ feature: 'Street  Course' });
    expect(params).toEqual({ feature: '"street course"' });
    expect(filter).toContain('tags:lower ~ {:feature}');
  });

  it('leaves out a clause whose value is empty or null', () => {
    expect(spotListFilter({ search: '   ', sport: null, sports: [], feature: '' }).filter).toBe(
      "status = 'live'",
    );
  });
});

describe('pageWindows', () => {
  it('cuts a page wholly inside the home list from the home list', () => {
    expect(pageWindows(100, 0, 24)).toEqual({ home: { start: 0, end: 24 }, others: null });
    expect(pageWindows(100, 72, 24)).toEqual({ home: { start: 72, end: 96 }, others: null });
  });

  it('splits the page that crosses from home into the others', () => {
    expect(pageWindows(100, 96, 24)).toEqual({
      home: { start: 96, end: 100 },
      others: { start: 0, end: 20 },
    });
  });

  it('cuts a page past the home list from the others, offset by the home length', () => {
    expect(pageWindows(100, 120, 24)).toEqual({
      home: null,
      others: { start: 20, end: 44 },
    });
  });

  it('is only the others when there is no home list', () => {
    expect(pageWindows(0, 24, 24)).toEqual({ home: null, others: { start: 24, end: 48 } });
  });
});

describe('spotPlaceFilters', () => {
  it('asks for the town first and then the country, live rows only', () => {
    expect(spotPlaceFilters({ town: 'Salford', country: 'UK' })).toEqual([
      { filter: "status = 'live' && town:lower = {:town}", params: { town: 'salford' } },
      { filter: "status = 'live' && country:lower = {:country}", params: { country: 'uk' } },
    ]);
  });

  // Whole strings, because `nearnessBetween` compares whole strings: a
  // contains here would file Indonesia's spots under India's.
  it('compares whole strings, never a substring', () => {
    for (const { filter } of spotPlaceFilters({ town: 'India', country: 'India' })) {
      expect(filter).not.toContain('~');
    }
  });

  it('folds the case it compares, the way `nearnessBetween` does', () => {
    const [town] = spotPlaceFilters({ town: '  SALFORD ' });
    expect(town?.params).toEqual({ town: 'salford' });
  });

  // A band with an empty needle is a query nobody asked for, and on this
  // collection every query nobody asked for is thirty thousand rows.
  it('leaves out a band it has nothing to match on', () => {
    expect(spotPlaceFilters({ town: 'Salford', country: '  ' })).toHaveLength(1);
    expect(spotPlaceFilters({})).toEqual([]);
  });
});
