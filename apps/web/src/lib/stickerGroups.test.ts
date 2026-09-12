import { describe, expect, it } from 'vitest';

// Under `src/lib/` because that is the only place `apps/web`'s Vitest looks
// (`vitest.config.ts`), and reaching a pure module elsewhere through `@/` is
// the pattern that config names — `groups.ts` is a map and a filter, no JSX.
import {
  SHELF_CAP,
  capShelf,
  defaultWallView,
  shelfFor,
  shelveWall,
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

describe('shelveWall', () => {
  it('shelves by kind, in display order', () => {
    const groups = shelveWall([
      sticker('acct', 'account-age'),
      sticker('run', 'streak'),
      sticker('kick', 'trick'),
      sticker('ten', 'landed-count'),
    ]);
    expect(groups.map((g) => g.id)).toEqual(['tricks', 'milestones', 'streaks', 'account']);
  });

  it('omits empty shelves, so two badges make two shelves and not eight', () => {
    expect(shelveWall([sticker('only', 'trick')]).map((g) => g.id)).toEqual(['tricks']);
    expect(shelveWall([]).length).toBe(0);
  });

  it('keeps the canonical order inside a shelf', () => {
    const groups = shelveWall([
      sticker('z', 'trick'),
      sticker('a', 'trick'),
      sticker('m', 'trick'),
    ]);
    expect(groups[0]?.stickers.map((s) => s.slug)).toEqual(['z', 'a', 'm']);
  });

  it('never loses a badge: an unknown or legacy kind lands on More', () => {
    expect(shelfFor('')).toBe('other');
    expect(shelfFor('something-new')).toBe('other');
    expect(shelveWall([sticker('legacy', '')]).map((g) => g.id)).toEqual(['other']);
  });

  /*
   * The shape the owner asked for (2026-09-12): the tabs are disjoint halves of
   * one wall, shelved identically. T33 first shipped Earned as a shelf pinned to
   * the top of *both* views, so a badge appeared twice and switching tabs changed
   * nothing above the fold. This asserts the property that broke.
   */
  it('splits into two halves that share shelves and share no badge', () => {
    const wall = [
      sticker('got-trick', 'trick', true),
      sticker('todo-trick', 'trick'),
      sticker('got-streak', 'streak', true),
      sticker('todo-crew', 'crew'),
    ];
    const earned = shelveWall(wall.filter((s) => s.earned));
    const unearned = shelveWall(wall.filter((s) => !s.earned));

    // Same shelf vocabulary on both sides.
    expect(earned.map((g) => g.label)).toEqual(['Trick awards', 'Streaks']);
    expect(unearned.map((g) => g.label)).toEqual(['Trick awards', 'Crew']);

    // Every badge on exactly one side, none on both, none missing.
    const slugs = (gs: ReturnType<typeof shelveWall>) =>
      gs.flatMap((g) => g.stickers.map((s) => s.slug));
    const a = slugs(earned);
    const b = slugs(unearned);
    expect(a.filter((slug) => b.includes(slug))).toEqual([]);
    expect([...a, ...b].sort()).toEqual(wall.map((s) => s.slug).sort());
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
  it('opens a new rider on Not yet, because their earned half is empty', () => {
    expect(defaultWallView([sticker('a', 'trick'), sticker('b', 'streak')])).toBe('unearned');
    expect(defaultWallView([])).toBe('unearned');
  });

  it('opens a rider with anything earned on their own collection', () => {
    expect(defaultWallView([sticker('a', 'trick'), sticker('b', 'streak', true)])).toBe('earned');
  });

  /*
   * The one that matters. `StickerWall` acknowledges fresh awards on mount
   * whatever view is showing, so a default that could hide the earned half
   * would stamp `seen_at` without ever drawing the pop — and it is once-only
   * (plan §3). Now the tabs are disjoint, the other tab genuinely does not hold
   * the new badge. Asserted on its own so that a future change to the "anything
   * earned" line cannot take the pop with it unnoticed.
   */
  it('always opens on Earned when an award has never been announced', () => {
    expect(defaultWallView([sticker('fresh', 'trick', true, true)])).toBe('earned');
  });
});
