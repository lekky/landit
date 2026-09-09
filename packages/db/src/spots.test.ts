import { describe, expect, it } from 'vitest';

import { pageWindows, spotListFilter } from './spots';

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
    expect(params).toEqual({ sport: 'bmx' });
    expect(filter).toContain('sports:each ?= {:sport}');
    expect(filter).toContain('sports:length = 0');
  });

  it('matches a feature as a whole tag, quotes included, case folded', () => {
    const { filter, params } = spotListFilter({ feature: 'Street  Course' });
    expect(params).toEqual({ feature: '"street course"' });
    expect(filter).toContain('tags:lower ~ {:feature}');
  });

  it('leaves out a clause whose value is empty or null', () => {
    expect(spotListFilter({ search: '   ', sport: null, feature: '' }).filter).toBe(
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
