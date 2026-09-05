import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { AWARDS } from '@landit/core';
import { STICKER_ART_WIDTHS, stickerArtSrcSet } from '@landit/ui-web';
import { describe, expect, it } from 'vitest';

/**
 * Every award record names its printed badge (`img`), and a name that points
 * at nothing renders a broken image on a child's sticker wall. The core
 * package checks the *shape* of the name; only this package can check the
 * file, because the art lives in `packages/ui-web/assets/stickers/`, synced
 * into `public/stickers/` at build time (`scripts/sync-stickers.mjs`).
 */
const ART_DIR = join(__dirname, '..', '..', '..', '..', 'packages', 'ui-web', 'assets', 'stickers');

describe('the award art', () => {
  it('has a committed file behind every award record', () => {
    for (const award of AWARDS) {
      expect(existsSync(join(ART_DIR, award.img)), `${award.id} → ${award.img}`).toBe(true);
    }
  });

  it('has no stray art without a record behind it', () => {
    // A file nobody references is either a renamed award (a bug) or leftover
    // scratch (bloat that ships to every rider).
    const wanted = new Set<string>(AWARDS.map((a) => a.img));
    for (const file of readdirSync(ART_DIR)) {
      expect(wanted.has(file), file).toBe(true);
    }
  });

  it('keeps every badge small enough to ship the whole set', () => {
    // The originals were ~1.4MB each; the committed set is optimised to a
    // ~77KB average. This is the regression stop for someone re-exporting at
    // full resolution.
    for (const file of readdirSync(ART_DIR)) {
      expect(statSync(join(ART_DIR, file)).size, file).toBeLessThan(250_000);
    }
  });

  /**
   * Small enough to ship a few hundred of them is still ~83KB each, and a wall
   * draws ~65 at 118px. `sync-stickers.mjs` writes the resized WebP the wall
   * actually fetches, and `stickerArtSrcSet` in `@landit/ui-web` names them —
   * two lists of widths in two packages, and a `srcset` candidate that 404s
   * shows a broken image rather than falling back to the `src`. This is the
   * only place that can see both, because `@landit/ui-web` may not import the
   * app and the script lives here.
   */
  it('resizes to exactly the widths the badge asks for', async () => {
    const { STICKER_WIDTHS } = await import('../../scripts/sync-stickers.mjs');
    expect(STICKER_WIDTHS).toEqual([...STICKER_ART_WIDTHS]);

    for (const width of STICKER_ART_WIDTHS) {
      expect(stickerArtSrcSet('180.png')).toContain(`/w${width}/180.webp ${width}w`);
    }
  });
});
