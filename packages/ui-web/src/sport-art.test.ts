import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ICON_NAMES } from './icons';
import { SPORT_ART, SPORT_ART_NAMES, hasSportArt, sportArtSrc, sportArtSrcSet } from './sport-art';

/**
 * The registry and the PNGs are two things that can drift apart silently: a
 * missing file shows up as a broken picture on a trick card, never as a failing
 * build. Same guard the avatar registry gets, for the same reason.
 */
const assets = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sports');
const files = readdirSync(assets).filter((f) => f.endsWith('.png'));

describe('sport equipment art', () => {
  it('covers the three sports and nothing else', () => {
    expect(SPORT_ART_NAMES).toEqual(['scoot', 'board', 'bmx']);
  });

  /**
   * Both sizes, because `Equipment` names both in one `srcset` and a `srcset`
   * candidate that 404s shows a broken image rather than falling back to the
   * `src`. A missing `@2x` is therefore a broken scooter on every phone and
   * nothing at all on the machine that shipped it.
   */
  it('has both PNGs in the package for every registered name', () => {
    const missing = SPORT_ART_NAMES.flatMap((n) =>
      [SPORT_ART[n].file, SPORT_ART[n].file2x].filter((f) => !files.includes(f)),
    );
    expect(missing).toEqual([]);
  });

  it('registers every PNG in the package', () => {
    const known = new Set<string>(
      SPORT_ART_NAMES.flatMap((n) => [SPORT_ART[n].file, SPORT_ART[n].file2x]),
    );
    expect(files.filter((f) => !known.has(f))).toEqual([]);
  });

  /**
   * The 2× is only worth its bytes if it is actually bigger. An export run with
   * the wrong width writes two identical files and nobody notices, so compare
   * them — the 512 is reliably heavier than the 256 of the same art.
   */
  it('exports a 2x that carries more than the 1x', () => {
    for (const name of SPORT_ART_NAMES) {
      const one = statSync(path.join(assets, SPORT_ART[name].file)).size;
      const two = statSync(path.join(assets, SPORT_ART[name].file2x)).size;
      expect(two).toBeGreaterThan(one);
    }
  });

  /**
   * `Equipment` looks art up by icon name so callers can pass `sport.icon`
   * straight through. If a name here ever stopped being a real icon, that
   * lookup would silently fall back to the stroked glyph for a sport that has
   * art sitting right there.
   */
  it('names icons that exist, so the fallback never fires for a sport', () => {
    const strangers = SPORT_ART_NAMES.filter((n) => !ICON_NAMES.includes(n));
    expect(strangers).toEqual([]);
  });

  it('narrows an icon name and builds its URL', () => {
    expect(hasSportArt('board')).toBe(true);
    expect(hasSportArt('flame')).toBe(false);
    expect(sportArtSrc('board')).toBe('/sports/board.png');
    expect(sportArtSrc('board', '/static/eq')).toBe('/static/eq/board.png');
  });

  it('offers both densities from the same base path', () => {
    expect(sportArtSrcSet('board')).toBe('/sports/board.png 1x, /sports/board@2x.png 2x');
    expect(sportArtSrcSet('bmx', '/static/eq')).toBe(
      '/static/eq/bmx.png 1x, /static/eq/bmx@2x.png 2x',
    );
  });

  it('describes each piece of kit for a screen reader', () => {
    expect(SPORT_ART_NAMES.every((n) => SPORT_ART[n].label.length > 0)).toBe(true);
  });
});
