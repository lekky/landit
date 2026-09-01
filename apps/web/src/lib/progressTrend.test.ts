import { describe, expect, it } from 'vitest';

// Under `src/lib/` for the same reason as `stickerGroups.test.ts`: the web
// package's Vitest only looks here, and `trend.ts` is pure arithmetic.
import { trendLine } from '@/components/progress/trend';

const m = (label: string, n: number) => ({ label, n });

describe('trendLine', () => {
  it('says nothing landed when nothing did', () => {
    expect(trendLine([m('Apr', 0), m('May', 0), m('Jun', 0)])).toBe(
      'Nothing landed in the last 3 months.',
    );
  });

  it('names the best month and compares the latest with the one before', () => {
    expect(trendLine([m('Jul', 1), m('Aug', 4), m('Sep', 2)])).toBe(
      'Best month Aug, 4 landed. Sep: 2 landed, down 2 on Aug.',
    );
    expect(trendLine([m('Jul', 1), m('Aug', 1), m('Sep', 3)])).toBe(
      'Best month Sep, 3 landed. Sep: 3 landed, up 2 on Aug.',
    );
    expect(trendLine([m('Aug', 2), m('Sep', 2)])).toBe(
      'Best month Sep, 2 landed. Sep: 2 landed, level with Aug.',
    );
  });

  it('gives a tie to the most recent month', () => {
    expect(trendLine([m('Jul', 3), m('Aug', 3), m('Sep', 0)])).toMatch(/^Best month Aug/);
  });

  it('handles one month and the singular', () => {
    expect(trendLine([m('Sep', 1)])).toBe('Best month Sep, 1 landed.');
    expect(trendLine([])).toBe('');
  });
});
