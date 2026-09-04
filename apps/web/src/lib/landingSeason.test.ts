import { AWARDS, LANDED_STAGES, STAGES, TRICKS, type Sticker } from '@landit/core';
import { describe, expect, it } from 'vitest';

import { seasonGrid, seasonLegend } from './landingSeason';

// Widened for the same reason `landingSeason.ts` widens it: `AWARDS` is a tuple
// of differently-shaped literals, and `kind` / `trick` are optional fields that
// only the interface exposes.
const STICKERS: readonly Sticker[] = AWARDS;

/**
 * The landing page's sample season.
 *
 * The grid is the one part of that page built from hand-written ids, and the
 * page is the first thing a stranger sees — so the thing worth testing is that
 * every id still resolves. A renamed or retired trick should fail here, in a
 * second, rather than throwing on the live home page.
 */
describe('the landing page season grid', () => {
  const tiles = seasonGrid();

  it('names only tricks that exist', () => {
    for (const tile of tiles) {
      const trick = TRICKS.find((t) => t.id === tile.id);
      expect(trick, `unknown trick "${tile.id}"`).toBeDefined();
      expect(tile.name).toBe(trick!.name);
    }
  });

  it('shows every trick once, so the wall does not repeat itself', () => {
    const ids = tiles.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Names are what a visitor actually sees, and three sports share several of
    // them — a grid with two "Bunny Hop" tiles reads as a bug.
    const names = tiles.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('leads with the best stages, which is the shape the design asks for', () => {
    const landed = tiles.filter((t) => t.stage !== null);
    const untracked = tiles.filter((t) => t.stage === null);

    // Every landed tile comes before every dashed one.
    expect(tiles.slice(0, landed.length).every((t) => t.stage !== null)).toBe(true);
    expect(untracked.length).toBeGreaterThan(0);

    const rank = (label: string) => STAGES.findIndex((s) => s.short === label);
    const ranks = landed.map((t) => rank(t.stage!.label));
    expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
  });

  it('only shows a stage a rider can actually be at', () => {
    for (const tile of tiles) {
      if (!tile.stage) continue;
      expect(
        STAGES.some((s) => s.short === tile.stage!.label && s.color === tile.stage!.color),
      ).toBe(true);
    }
  });

  /**
   * The rule the design pack was most insistent about: a badge is the award the
   * trick actually grants, looked up by id — never a hand-picked icon.
   */
  it('hangs only that trick’s own live award on a tile', () => {
    for (const tile of tiles) {
      if (!tile.badge) continue;
      const award = STICKERS.find((a) => a.kind === 'trick' && a.trick === tile.id);
      expect(award, `no trick award for "${tile.id}"`).toBeDefined();
      expect(award!.isLive).toBe(true);
      expect(tile.badge.name).toBe(award!.name);
      expect(tile.badge.img).toBe(award!.img);
    }
  });

  it('never puts a badge on a trick nobody has landed', () => {
    // A sticker is earned by landing the trick, so a dashed tile carrying one
    // would be telling a visitor something untrue about how the product works.
    for (const tile of tiles) {
      if (tile.stage === null) expect(tile.badge).toBeNull();
    }
  });

  it('only calls a trick landed at a stage that counts as landed', () => {
    // `some` and above. A "Learning" tile is tracked, not landed, and the grid
    // is allowed to show it — what it must not do is give it a sticker.
    const landedLabels = STAGES.filter((s) =>
      (LANDED_STAGES as readonly string[]).includes(s.id),
    ).map((s) => s.short);

    for (const tile of tiles) {
      if (tile.badge) expect(landedLabels).toContain(tile.stage!.label);
    }
  });
});

describe('the legend under it', () => {
  it('lists every stage the grid uses, and nothing it does not', () => {
    const legend = seasonLegend();
    const used = new Set(
      seasonGrid()
        .filter((t) => t.stage !== null)
        .map((t) => t.stage!.label),
    );

    const stageEntries = legend.filter((e) => e.color !== null);
    expect(new Set(stageEntries.map((e) => e.label))).toEqual(used);
    // Plus the dashed one, always last.
    expect(legend.at(-1)).toEqual({ label: 'Not tracked yet', color: null });
  });
});
