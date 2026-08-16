import type { Category, CategoryId, Sport, SportId } from '../types';

import { SPORTS } from './sports';

/** Categories in the order the library and the skill tree show them. */
export const CATEGORY_IDS = [
  'flat',
  'street',
  'park',
  'hybrid',
  'air',
] as const satisfies readonly CategoryId[];

export const CATS = {
  // The `flat` and `hybrid` blurbs were skate-flavoured — "board control" and
  // "deck flips" — and categories are sport-agnostic (plan §3), so the copy has
  // to be too. Reworded under the owner's exception (Rachid, 2026-08-16, plan
  // §7 T21). Copy only; no id, colour or behaviour moved.
  flat: {
    id: 'flat',
    label: 'Flat',
    color: '#10A06A',
    blurb: 'Ground tricks. Balance and control',
  },
  street: {
    id: 'street',
    label: 'Street',
    color: '#FF5A1F',
    blurb: 'Ledges, rails, gaps and stairs',
  },
  park: { id: 'park', label: 'Park', color: '#246BFF', blurb: 'Ramps, boxes and airtime' },
  hybrid: { id: 'hybrid', label: 'Hybrid', color: '#8A3BE0', blurb: 'Combos and linked tricks' },
  air: { id: 'air', label: 'Air', color: '#E0392B', blurb: 'Flips and inverts, big consequences' },
} as const satisfies Record<CategoryId, Category>;

/**
 * What to call a category **to a rider of a given sport**.
 *
 * Category ids are shared and stay shared — stats, stickers and the skill tree
 * all key off them, and nothing here touches that. Only the word on the chip
 * moves, and only where a sport says it should: BMX shows "Flatground" where
 * scooter and skate show "Flat", because "Flat" alone reads as Flatland to a
 * BMX rider — one of that sport's five named disciplines, and not what this
 * category holds.
 *
 * Pass no sport and you get the shared label, which is what every screen that
 * is not looking at one sport should do.
 */
export function categoryLabel(category: CategoryId, sport?: SportId): string {
  // Read through `Sport`: the literals are `as const`, so a sport that
  // overrides nothing has no `categoryLabels` key in its inferred type at all.
  const record: Sport | undefined = sport ? SPORTS[sport] : undefined;
  return record?.categoryLabels?.[category] ?? CATS[category].label;
}

/**
 * Difficulty tier names, indexed by `diff - 1`. The locked-trick flag in the
 * library shows the tier name, so a rider is told what they are missing.
 */
export const TIERS_LABEL = ['Rookie', 'Easy', 'Spicy', 'Gnarly', 'Pro'] as const;
