import { SPOT_FEATURES, type CategoryId } from '@landit/core';

/**
 * Where a category's tricks get practised, for the trick page's "Where to
 * practise" line (T31).
 *
 * This is the inverse of `SPOT_FEATURES[...].tricks` in `@landit/core`: that
 * table says which library category a spot feature is *for*, and this one
 * picks, per category, the feature to send a rider looking for and the words
 * to say it with. One representative feature rather than every matching one,
 * because the line links to a single filter and a rider wants one answer —
 * "find spots with flat near you", not a list of nine tags.
 *
 * `hybrid` has no entry and gets no line. Combos and linked tricks are ridden
 * wherever their halves are, and no feature in the table claims them; the
 * honest answer is nothing, which is also what the feature table does for a
 * pump track. `practise.test.ts` holds each entry to a feature that exists and
 * that points back at this category.
 */
export interface PractiseAdvice {
  /** The spot feature tag, as `SPOT_FEATURES` keys it. */
  readonly feature: string;
  /** "smooth flat ground" — what the tricks want. */
  readonly want: string;
  /** "find spots with flat near you" — the link's text, without the arrow. */
  readonly find: string;
}

const ADVICE: Readonly<Partial<Record<CategoryId, PractiseAdvice>>> = {
  flat: { feature: 'flat', want: 'smooth flat ground', find: 'find spots with flat near you' },
  street: {
    feature: 'ledges',
    want: 'ledges and rails',
    find: 'find spots with ledges near you',
  },
  park: {
    feature: 'bowl',
    want: 'bowls and quarter pipes',
    find: 'find spots with a bowl near you',
  },
  air: {
    feature: 'foam pit',
    want: 'a foam pit or a resi ramp',
    find: 'find parks with a foam pit near you',
  },
};

/** The advice for a category, or `null` where there is honestly none. */
export function practiseAdvice(cat: CategoryId): PractiseAdvice | null {
  const advice = ADVICE[cat];
  return advice && SPOT_FEATURES[advice.feature] ? advice : null;
}
