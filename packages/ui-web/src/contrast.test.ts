import { describe, expect, it } from 'vitest';

import { contrastRatio, foregroundFor } from './contrast';

/**
 * The palette, straight from `styles/tokens.css`. Copied rather than imported
 * because the point of these tests is to catch a token value drifting away from
 * a pairing that was checked — reading the same file the code reads would make
 * that drift invisible.
 */
const TOKEN = {
  ink: '#12100b',
  paper: '#fffdf5',
  pink: '#ff3d78',
  orange: '#ff5a1f',
  yellow: '#ffc23f',
  lime: '#9ce05b',
  green: '#10a06a',
  mint: '#2ec4b6',
  sky: '#3ac0ff',
  blue: '#246bff',
  violet: '#8a3be0',
  red: '#e0392b',
} as const;

/** WCAG AA for body-sized text. Every tag and button label is below 18.66px. */
const AA = 4.5;

describe('contrastRatio', () => {
  it('matches the WCAG reference points', () => {
    // Identical colours are 1:1; black on white is the 21:1 ceiling.
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('is symmetric', () => {
    const a = contrastRatio(TOKEN.ink, TOKEN.orange);
    const b = contrastRatio(TOKEN.orange, TOKEN.ink);
    expect(a).toBeCloseTo(b!, 10);
  });

  it('reads three-digit hex the same as six', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(contrastRatio('#ffffff', '#000000')!, 10);
  });

  it('returns null for anything that is not hex', () => {
    expect(contrastRatio('var(--ink)', TOKEN.orange)).toBeNull();
    expect(contrastRatio('rebeccapurple', TOKEN.orange)).toBeNull();
  });
});

describe('foregroundFor', () => {
  it('puts ink on the seven accents that carry it', () => {
    for (const name of ['pink', 'orange', 'yellow', 'lime', 'green', 'mint', 'sky'] as const) {
      expect(foregroundFor(TOKEN[name]), name).toBe('var(--ink)');
    }
  });

  it('puts paper on the two accents that need it', () => {
    expect(foregroundFor(TOKEN.blue)).toBe('var(--paper)');
    expect(foregroundFor(TOKEN.violet)).toBe('var(--paper)');
  });

  it('clears AA on the eight accents that can', () => {
    for (const name of [
      'pink',
      'orange',
      'yellow',
      'lime',
      'green',
      'mint',
      'sky',
      'violet',
    ] as const) {
      const fg = foregroundFor(TOKEN[name]) === 'var(--ink)' ? TOKEN.ink : TOKEN.paper;
      expect(contrastRatio(fg, TOKEN[name]), name).toBeGreaterThanOrEqual(AA);
    }
  });

  /*
   * The two holes in the palette, asserted as holes.
   *
   * Neither `--blue` nor `--red` reaches 4.5:1 against either foreground, so
   * `foregroundFor` returns the better of two failing options and this test
   * records that it is still failing — otherwise a green suite would read as a
   * pass on every Park tag and every Air tag in the library.
   *
   * Both are a whisker away and both are brand colours, so closing them means
   * changing a palette value, which is the owner's call and not a session's.
   * Note the measurement is against `--paper` (#fffdf5), not pure white: on
   * blue that is the difference between 4.46 and 4.54, which is the difference
   * between failing and passing, so the token is what gets measured.
   */
  it('records blue and red as failing whichever foreground they take', () => {
    for (const name of ['blue', 'red'] as const) {
      const fg = foregroundFor(TOKEN[name]) === 'var(--ink)' ? TOKEN.ink : TOKEN.paper;
      expect(contrastRatio(fg, TOKEN[name]), name).toBeLessThan(AA);
      // Close enough that a small darkening of the token would clear it.
      expect(contrastRatio(fg, TOKEN[name]), name).toBeGreaterThan(4.1);
    }
  });

  it('returns undefined for a CSS variable, so the stylesheet still decides', () => {
    expect(foregroundFor('var(--ink)')).toBeUndefined();
    expect(foregroundFor(undefined)).toBeUndefined();
    expect(foregroundFor('')).toBeUndefined();
  });

  it('beats the prototype default on the two category colours that were failing', () => {
    // Street and Flat are the reason this exists: every trick card in the
    // library carried an 11px white label on them.
    expect(contrastRatio(TOKEN.paper, TOKEN.orange)).toBeLessThan(AA);
    expect(contrastRatio(TOKEN.paper, TOKEN.green)).toBeLessThan(AA);
    expect(contrastRatio(TOKEN.ink, TOKEN.orange)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(TOKEN.ink, TOKEN.green)).toBeGreaterThanOrEqual(AA);
  });
});
