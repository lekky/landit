import { describe, expect, it } from 'vitest';

// Under `src/lib/` because that is the only place `apps/web`'s Vitest looks
// (`vitest.config.ts`), and reaching a pure module elsewhere through `@/` is
// the pattern that config names — `groups.ts` is a map and a filter, no JSX.
import {
  SHELF_CAP,
  capShelf,
  defaultWallView,
  groupWall,
  shelfFor,
} from '@/app/(app)/stickers/groups';
import type { StickerView } from '@/app/(app)/stickers/view';

function sticker(slug: string, kind: string, earned = false, unannounced = false): StickerView {
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
    unannounced,
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

  it('shelves the four kinds that used to reach More by falling through', () => {
    // `comeback`, `founder` and `supporter` were absent from the map and landed
    // on More by accident. `stage-drop` belongs there and now says so, which is
    // what tells the two cases apart.
    expect(shelfFor('comeback')).toBe('streaks');
    expect(shelfFor('founder')).toBe('account');
    expect(shelfFor('supporter')).toBe('account');
    expect(shelfFor('stage-drop')).toBe('other');
  });
});

describe('capShelf', () => {
  const shelf = (n: number) => Array.from({ length: n }, (_, i) => sticker(`s${i}`, 'trick'));

  it('cuts a long shelf at the cap and counts what is left', () => {
    const { shown, hidden } = capShelf(shelf(79));
    expect(shown).toHaveLength(SHELF_CAP);
    expect(hidden).toBe(79 - SHELF_CAP);
    expect(shown.map((s) => s.slug)).toEqual(['s0', 's1', 's2', 's3', 's4', 's5']);
  });

  it('leaves a shelf at or under the cap whole, with no button to draw', () => {
    expect(capShelf(shelf(SHELF_CAP)).hidden).toBe(0);
    expect(capShelf(shelf(SHELF_CAP)).shown).toHaveLength(SHELF_CAP);
    expect(capShelf(shelf(2)).hidden).toBe(0);
    expect(capShelf([]).hidden).toBe(0);
  });

  it('keeps the shelf order — the cap shows the first six, never a sample', () => {
    const { shown } = capShelf([sticker('z', 'trick'), sticker('a', 'trick')], 1);
    expect(shown.map((s) => s.slug)).toEqual(['z']);
  });
});

describe('defaultWallView', () => {
  it('opens a new rider on All, because their Earned shelf is empty', () => {
    expect(defaultWallView([sticker('a', 'trick'), sticker('b', 'streak')])).toBe('all');
    expect(defaultWallView([])).toBe('all');
  });

  it('opens a rider with anything earned on their own collection', () => {
    expect(defaultWallView([sticker('a', 'trick'), sticker('b', 'streak', true)])).toBe('earned');
  });

  /*
   * The one that matters. `StickerWall` acknowledges fresh awards on mount
   * whatever view is showing, so a default that could hide the Earned shelf
   * would stamp `seen_at` without ever drawing the pop — and it is once-only
   * (plan §3). Asserted on its own so that a future change to the "anything
   * earned" line cannot take the pop with it unnoticed.
   */
  it('always opens on Earned when an award has never been announced', () => {
    expect(defaultWallView([sticker('fresh', 'trick', true, true)])).toBe('earned');
  });
});
