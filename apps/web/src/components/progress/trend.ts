/**
 * One sentence that says what the "Landed over time" bars say.
 *
 * The chart is six bars with a number over each. To a sighted rider that is a
 * shape; to a screen reader it is "4 Aug 1 Sep 0 Oct…" with no structure, and
 * the chart guidance is unambiguous that a visual encoding needs a text
 * equivalent. This is that equivalent — the reading a coach would give out
 * loud — and it sits above the bars for everyone, because it is a better
 * summary than the bars are.
 *
 * Pure and integer-only so it can render on either side of hydration without
 * disagreeing with itself (LESSONS §3a): the labels arrive already formatted
 * from `progress/view.ts`.
 */

export type MonthPoint = {
  /** "Aug" — already formatted on the server. */
  readonly label: string;
  /** Tricks landed that month. */
  readonly n: number;
};

/** `months` is oldest → newest, as the chart draws them. */
export function trendLine(months: readonly MonthPoint[]): string {
  if (months.length === 0) return '';
  const total = months.reduce((sum, m) => sum + m.n, 0);
  if (total === 0) return `Nothing landed in the last ${months.length} months.`;

  // Ties go to the most recent month: "best month" should point at the thing
  // the rider did last, not the first time they did it.
  let best = months[0]!;
  for (const m of months) if (m.n >= best.n) best = m;

  const latest = months[months.length - 1]!;
  const previous = months.length > 1 ? months[months.length - 2] : undefined;

  const bestPart = `Best month ${best.label}, ${landed(best.n)}.`;
  if (!previous) return bestPart;

  const delta = latest.n - previous.n;
  const change =
    delta === 0
      ? `level with ${previous.label}`
      : delta > 0
        ? `up ${delta} on ${previous.label}`
        : `down ${-delta} on ${previous.label}`;

  return `${bestPart} ${latest.label}: ${landed(latest.n)}, ${change}.`;
}

function landed(n: number): string {
  return n === 1 ? '1 landed' : `${n} landed`;
}
