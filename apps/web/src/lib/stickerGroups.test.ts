import { describe, expect, it } from 'vitest';

// Under `src/lib/` because that is the only place `apps/web`'s Vitest looks
// (`vitest.config.ts`), and reaching a pure module elsewhere through `@/` is
// the pattern that config names — `groups.ts` is a map and a filter, no JSX.
import { groupWall, shelfFor } from '@/app/(app)/stickers/groups';
import type { StickerView } from '@/app/(app)/stickers/view';

function sticker(slug: string, kind: string, earned = false): StickerView {
  return {
    slug,
    name: slug,
    hue: '#ffc23f',
    kind,
    sport: null,
    sportLabel: null,
    sportColor: null,
    sportIcon: null,
    condition: '',
    earned,
    earnedLabel: earned ? 'Earned' : null,
    unannounced: false,
    riderStickerId: earned ? `rs-${slug}` : null,
    caption: '',
    shareHeadline: '',
  };
}

describe('groupWall', () => {
  it('puts everything earned first, whatever its kind', () => {
    const groups = groupWall([
      sticker('a', 'trick'),
      sticker('b', 'streak', true),
      sticker('c', 'trick', true),
    ]);
    expect(groups[0]?.id).toBe('earned');
    expect(groups[0]?.stickers.map((s) => s.slug)).toEqual(['b', 'c']);
  });

  it('shelves locked awards by kind, in display order', () => {
    const groups = groupWall([
      sticker('acct', 'account-age'),
      sticker('run', 'streak'),
      sticker('kick', 'trick'),
      sticker('ten', 'landed-count'),
    ]);
    expect(groups.map((g) => g.id)).toEqual(['tricks', 'milestones', 'streaks', 'account']);
  });

  it('omits empty shelves and an empty Earned', () => {
    expect(groupWall([sticker('only', 'trick')]).map((g) => g.id)).toEqual(['tricks']);
    expect(groupWall([]).length).toBe(0);
  });

  it('keeps the canonical order inside a shelf', () => {
    const groups = groupWall([sticker('z', 'trick'), sticker('a', 'trick'), sticker('m', 'trick')]);
    expect(groups[0]?.stickers.map((s) => s.slug)).toEqual(['z', 'a', 'm']);
  });

  it('never loses a badge: an unknown or legacy kind lands on More', () => {
    expect(shelfFor('')).toBe('other');
    expect(shelfFor('something-new')).toBe('other');
    const groups = groupWall([sticker('legacy', '')]);
    expect(groups.map((g) => g.id)).toEqual(['other']);
  });

  it('shelves every kind the type declares', () => {
    // Mirrors `AwardKind` in `@landit/core`. A kind added there without a
    // shelf here would land on More — which this test turns into a failure
    // rather than a surprise on the wall.
    const kinds = [
      'trick',
      'landed-count',
      'sport-landed-count',
      'mastered-count',
      'hard-mastered',
      'sport-cat-count',
      'streak',
      'challenges',
      'clips',
      'spots-approved',
      'events-going',
      'crew',
      'crew-owned',
      'sports-landed',
      'sport-cats-landed',
      'profile-complete',
      'account-age',
    ];
    for (const kind of kinds) expect(shelfFor(kind), kind).not.toBe('other');
  });
});
