import { describe, expect, it } from 'vitest';

import {
  clampPage,
  defaultOpenMonths,
  pageCount,
  pageRangeLabel,
  pageWindow,
  previousMonthKey,
  sessionCountLabel,
  sessionListFilter,
  sparkHeight,
  topSpotBarWidth,
  trickCountLabel,
} from './sessionList';

describe('sessionListFilter', () => {
  it('adds no sport clause for a scope that is every sport', () => {
    expect(sessionListFilter([], false)).toEqual({});
    expect(sessionListFilter([], true)).toEqual({ atEvent: true });
  });

  it('narrows to the one sport a scope resolves to', () => {
    expect(sessionListFilter(['bmx'], false)).toEqual({ sport: 'bmx' });
  });

  it('lets the scope and the event pill hold at once, which the old chip row could not', () => {
    expect(sessionListFilter(['scooter'], true)).toEqual({ sport: 'scooter', atEvent: true });
  });
});

describe('count labels', () => {
  it('says sessions and tricks in the singular and plural', () => {
    expect(sessionCountLabel(0)).toBe('No sessions');
    expect(sessionCountLabel(1)).toBe('1 session');
    expect(sessionCountLabel(10)).toBe('10 sessions');
    expect(trickCountLabel(0)).toBe('');
    expect(trickCountLabel(1)).toBe('1 trick');
    expect(trickCountLabel(2)).toBe('2 tricks');
  });
});

describe('pages', () => {
  it('counts pages, never fewer than one', () => {
    expect(pageCount(0, 3)).toBe(1);
    expect(pageCount(3, 3)).toBe(1);
    expect(pageCount(10, 3)).toBe(4);
  });

  it('holds a page inside the list', () => {
    expect(clampPage(0, 4)).toBe(1);
    expect(clampPage(9, 4)).toBe(4);
    expect(clampPage(2, 0)).toBe(1);
  });

  it('writes the range as the design does, and never past the end', () => {
    expect(pageRangeLabel(1, 3, 10)).toBe('Showing 1–3 of 10');
    expect(pageRangeLabel(4, 3, 10)).toBe('Showing 10–10 of 10');
    // A delete took the last page away: the label follows the clamp.
    expect(pageRangeLabel(5, 3, 9)).toBe('Showing 7–9 of 9');
    expect(pageRangeLabel(1, 3, 0)).toBe('Showing none');
  });

  it('draws a sliding window of page numbers that keeps the current page in it', () => {
    expect(pageWindow(1, 4)).toEqual([1, 2, 3, 4]);
    expect(pageWindow(1, 40)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(20, 40)).toEqual([18, 19, 20, 21, 22]);
    expect(pageWindow(40, 40)).toEqual([36, 37, 38, 39, 40]);
    expect(pageWindow(99, 40)).toEqual([36, 37, 38, 39, 40]);
    expect(pageWindow(1, 1)).toEqual([1]);
  });
});

describe('months', () => {
  it('steps back a month, across a year', () => {
    expect(previousMonthKey('2026-09')).toBe('2026-08');
    expect(previousMonthKey('2026-01')).toBe('2025-12');
    expect(previousMonthKey('nonsense')).toBe('');
  });

  it('opens this month and last month by default, as design 2b does', () => {
    expect(defaultOpenMonths('2026-09')).toEqual(['2026-09', '2026-08']);
    expect(defaultOpenMonths('2027-01')).toEqual(['2027-01', '2026-12']);
  });
});

describe('bars', () => {
  it('scales a session bar at 11px an hour with a floor', () => {
    expect(sparkHeight(120)).toBe(22);
    expect(sparkHeight(180)).toBe(33);
    expect(sparkHeight(30)).toBe(6);
    expect(sparkHeight(0)).toBe(6);
  });

  it('scales a spot bar against the busiest spot with a floor', () => {
    expect(topSpotBarWidth(1)).toBe(64);
    expect(topSpotBarWidth(0.5)).toBe(32);
    expect(topSpotBarWidth(0.05)).toBe(14);
    expect(topSpotBarWidth(Number.NaN)).toBe(14);
    expect(topSpotBarWidth(3)).toBe(64);
  });
});
