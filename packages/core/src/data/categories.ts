import type { Category, CategoryId } from '../types';

/** Categories in the order the library and the skill tree show them. */
export const CATEGORY_IDS = [
  'flat',
  'street',
  'park',
  'hybrid',
  'air',
] as const satisfies readonly CategoryId[];

export const CATS = {
  flat: {
    id: 'flat',
    label: 'Flat',
    color: '#10A06A',
    blurb: 'Ground tricks. Balance and board control',
  },
  street: {
    id: 'street',
    label: 'Street',
    color: '#FF5A1F',
    blurb: 'Ledges, rails, gaps and stairs',
  },
  park: { id: 'park', label: 'Park', color: '#246BFF', blurb: 'Ramps, boxes and airtime' },
  hybrid: { id: 'hybrid', label: 'Hybrid', color: '#8A3BE0', blurb: 'Combos and deck flips' },
  air: { id: 'air', label: 'Air', color: '#E0392B', blurb: 'Flips and inverts, big consequences' },
} as const satisfies Record<CategoryId, Category>;

/**
 * Difficulty tier names, indexed by `diff - 1`. The locked-trick flag in the
 * library shows the tier name, so a rider is told what they are missing.
 */
export const TIERS_LABEL = ['Rookie', 'Easy', 'Spicy', 'Gnarly', 'Pro'] as const;
