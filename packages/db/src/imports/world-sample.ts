import type { SeedPlan } from '../seed';

/** How many world rows an integration test seeds. */
export const WORLD_SAMPLE = 400;

/**
 * A seed plan with the world import's tables cut to a sample spread across each,
 * for the integration tests that seed a real PocketBase.
 *
 * The whole table is twenty-odd thousand creates, which would add minutes to
 * every run of those suites — France's three thousand already take about half
 * a minute — and what they prove about world rows (that the columns and values
 * land, that a re-seed leaves them alone, that the server's filters agree with
 * core's) a few hundred rows from every part of the snapshot prove as well as
 * all of them. Every row is seeded end to end once, by hand, when the snapshot
 * changes; the PR that changes it records the run.
 */
export function sampleWorld(plan: SeedPlan, size: number = WORLD_SAMPLE): SeedPlan {
  return {
    tables: plan.tables.map((table) => {
      if (!table.label?.startsWith('spots (world')) return table;
      const step = Math.max(1, Math.ceil(table.rows.length / size));
      return { ...table, rows: table.rows.filter((_, i) => i % step === 0) };
    }),
  };
}
