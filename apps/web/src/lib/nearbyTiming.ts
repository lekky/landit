/**
 * How long nearest-first took, as one of five words.
 *
 * The whole of `nearby_sort_ready`'s `bucket` property, kept here rather than
 * inline in `SpotsScreen` for the reason every privacy decision in this app is
 * kept out of a component: this is the line between a duration and a
 * fingerprint, and a line nobody can run a test against is not a line.
 *
 * **A count of milliseconds never leaves the browser.** Sent raw it would be a
 * measurement of a particular device on a particular connection, precise to
 * the millisecond and arriving alongside everything else in the same event —
 * which is a way of telling one child's phone from another's without ever
 * calling it an identifier. The question the event is for is "is this seconds,
 * or is it instant", and five buckets answer it exactly as well.
 *
 * The boundaries are where the answers differ rather than round numbers for
 * their own sake: under a second reads as instant, one to two as quick, two to
 * five as a wait a rider will sit through, five to ten as long enough to press
 * again, and over ten as the broken-feeling case that started this work.
 */
export type NearbyReadyBucket = 'under_1s' | '1_2s' | '2_5s' | '5_10s' | 'over_10s';

export function nearbyReadyBucket(ms: number): NearbyReadyBucket {
  // A clock that ran backwards — a system time change mid-press, which is the
  // one way `performance.now()`'s monotonic guarantee gets lost across a tab
  // suspend — is reported as the fastest bucket rather than as nothing.
  if (!Number.isFinite(ms) || ms < 1_000) return 'under_1s';
  if (ms < 2_000) return '1_2s';
  if (ms < 5_000) return '2_5s';
  if (ms < 10_000) return '5_10s';
  return 'over_10s';
}
