import { CATEGORY_IDS, SPOT_FEATURES } from '@landit/core';
import { describe, expect, it } from 'vitest';

import { practiseAdvice } from './practise';

describe('where to practise (T31)', () => {
  it('sends every category with advice to a feature that exists and points back at it', () => {
    for (const cat of CATEGORY_IDS) {
      const advice = practiseAdvice(cat);
      if (!advice) continue;
      const feature = SPOT_FEATURES[advice.feature];
      expect(feature, `${cat} → ${advice.feature}`).toBeDefined();
      expect(feature?.tricks, `${cat} → ${advice.feature}`).toBe(cat);
    }
  });

  it('has an answer for the four categories a spot feature claims, and none for hybrid', () => {
    expect(practiseAdvice('flat')?.feature).toBe('flat');
    expect(practiseAdvice('street')?.feature).toBe('ledges');
    expect(practiseAdvice('park')?.feature).toBe('bowl');
    expect(practiseAdvice('air')?.feature).toBe('foam pit');
    expect(practiseAdvice('hybrid')).toBeNull();
  });
});
