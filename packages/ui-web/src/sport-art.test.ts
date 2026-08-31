import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ICON_NAMES } from './icons';
import { SPORT_ART, SPORT_ART_NAMES, hasSportArt, sportArtSrc } from './sport-art';

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

  it('has a PNG in the package for every registered name', () => {
    const missing = SPORT_ART_NAMES.filter((n) => !files.includes(SPORT_ART[n].file));
    expect(missing).toEqual([]);
  });

  it('registers every PNG in the package', () => {
    const known = new Set<string>(SPORT_ART_NAMES.map((n) => SPORT_ART[n].file));
    expect(files.filter((f) => !known.has(f))).toEqual([]);
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

  it('describes each piece of kit for a screen reader', () => {
    expect(SPORT_ART_NAMES.every((n) => SPORT_ART[n].label.length > 0)).toBe(true);
  });
});
