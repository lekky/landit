import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { AWARDS } from '@landit/core';
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

  it('keeps every badge small enough to ship 135 of them', () => {
    // The originals were ~1.4MB each; the committed set is optimised to a
    // ~77KB average. This is the regression stop for someone re-exporting at
    // full resolution.
    for (const file of readdirSync(ART_DIR)) {
      expect(statSync(join(ART_DIR, file)).size, file).toBeLessThan(250_000);
    }
  });
});
