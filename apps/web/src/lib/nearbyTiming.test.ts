import { describe, expect, it } from 'vitest';

import { nearbyReadyBucket } from './nearbyTiming';

describe('how long nearest-first took, as a bucket', () => {
  it('puts each span in its own bucket', () => {
    expect(nearbyReadyBucket(0)).toBe('under_1s');
    expect(nearbyReadyBucket(999)).toBe('under_1s');
    expect(nearbyReadyBucket(1_000)).toBe('1_2s');
    expect(nearbyReadyBucket(1_999)).toBe('1_2s');
    expect(nearbyReadyBucket(2_000)).toBe('2_5s');
    expect(nearbyReadyBucket(4_999)).toBe('2_5s');
    expect(nearbyReadyBucket(5_000)).toBe('5_10s');
    expect(nearbyReadyBucket(9_999)).toBe('5_10s');
    expect(nearbyReadyBucket(10_000)).toBe('over_10s');
    expect(nearbyReadyBucket(60_000)).toBe('over_10s');
  });

  /*
   * The property this function exists for: whatever goes in, one of five fixed
   * strings comes out. A millisecond count reaching PostHog would be a
   * measurement of one child's device precise enough to tell it from another's,
   * which is the thing the catalogue rule in `analytics.ts` forbids.
   */
  it('never answers with anything but one of the five', () => {
    const allowed = ['under_1s', '1_2s', '2_5s', '5_10s', 'over_10s'];
    const awkward = [-1, 0, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 1e12];
    for (const ms of awkward) expect(allowed).toContain(nearbyReadyBucket(ms));
  });

  it('reports a clock that ran backwards as the fastest rather than as nothing', () => {
    expect(nearbyReadyBucket(-5_000)).toBe('under_1s');
    expect(nearbyReadyBucket(Number.NaN)).toBe('under_1s');
  });
});
