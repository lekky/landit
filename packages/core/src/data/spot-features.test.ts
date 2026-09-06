import { describe, expect, it } from 'vitest';

import { CATEGORY_IDS } from './categories';
import { SPOTS } from './spots';
import { SPOT_FEATURE_LIST, SPOT_FEATURES, spotFeature, spotFeatureId } from './spot-features';

/**
 * The grid on a spot page is the whole reason that page is worth publishing, so
 * the thing worth testing is that it is **full**: every tag the researched
 * spots actually carry has a sentence waiting for it, and every link it offers
 * points at a category the library really has.
 */
describe('spot features', () => {
  it('explains every tag the canonical spots carry', () => {
    const missing = new Set<string>();
    for (const spot of SPOTS) {
      for (const tag of spot.tags) {
        if (!spotFeature(tag)) missing.add(tag);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it('only ever links to a category the library sorts by', () => {
    for (const feature of SPOT_FEATURE_LIST) {
      if (feature.tricks === null) continue;
      expect(CATEGORY_IDS, feature.label).toContain(feature.tricks);
    }
  });

  it('says something about every feature, link or no link', () => {
    for (const feature of SPOT_FEATURE_LIST) {
      expect(feature.about.length, feature.label).toBeGreaterThan(30);
      expect(feature.label.length).toBeGreaterThan(0);
    }
  });

  it('carries a noun phrase that reads in a sentence', () => {
    for (const feature of SPOT_FEATURE_LIST) {
      // Lowercase, because it is dropped mid-sentence after "with".
      expect(feature.phrase, feature.label).toBe(feature.phrase.toLowerCase());
      expect(feature.phrase.length).toBeGreaterThan(2);
    }
    expect(spotFeature('Bowl')?.phrase).toBe('a bowl');
    expect(spotFeature('Flat')?.phrase).toBe('flat ground');
    expect(spotFeature('Ledges')?.phrase).toBe('ledges');
  });

  it('is keyed by the normalised tag, so casing and spacing cannot miss', () => {
    expect(spotFeatureId('  Box   Jump ')).toBe('box jump');
    expect(spotFeature('BOWL')?.label).toBe('Bowl');
    expect(spotFeature(' ledges ')?.label).toBe('Ledges');
    expect(spotFeature('Box Jump')?.label).toBe('Box jump');
  });

  it('returns null for a tag nobody has written an explanation for', () => {
    expect(spotFeature('quarter pounder')).toBeNull();
    expect(spotFeature('')).toBeNull();
  });

  it('has one entry per id', () => {
    expect(Object.keys(SPOT_FEATURES)).toHaveLength(SPOT_FEATURE_LIST.length);
  });
});
