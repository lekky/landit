import type { LandedStageId, Stage, StageId } from '../types';

/** The five stages, in order. The stage picker renders them in this order. */
export const STAGES = [
  { id: 'want', label: 'Want to learn', short: 'Want', color: '#8A3BE0', pct: 0 },
  { id: 'trying', label: 'Learning', short: 'Learning', color: '#FF9F1C', pct: 25 },
  { id: 'some', label: 'Sometimes', short: 'Sometimes', color: '#3AC0FF', pct: 55 },
  { id: 'most', label: 'Most times', short: 'Most times', color: '#2EC4B6', pct: 80 },
  { id: 'every', label: 'Every time', short: 'Every time', color: '#10A06A', pct: 100 },
] as const satisfies readonly Stage[];

export const STAGE_IDS = STAGES.map((s) => s.id) as readonly StageId[];

const byStageId = {} as Record<StageId, Stage>;
for (const stage of STAGES) byStageId[stage.id] = stage;

/** Stage id to record, for the many places that only have the id. */
export const STAGE: Readonly<Record<StageId, Stage>> = byStageId;

/**
 * The stages that count as landed. A trick is landed at `some` or above — the
 * one rule the whole product is scored on.
 */
export const LANDED_STAGES = ['some', 'most', 'every'] as const satisfies readonly LandedStageId[];
