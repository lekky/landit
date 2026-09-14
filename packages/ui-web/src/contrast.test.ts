import { CHALLENGES } from '@landit/core';
import { describe, expect, it } from 'vitest';

import { contrastRatio, foregroundFor, softFill } from './contrast';

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
    expect(contrastRatio('var(--on-light)', TOKEN.orange)).toBeNull();
    expect(contrastRatio('rebeccapurple', TOKEN.orange)).toBeNull();
  });
});

describe('foregroundFor', () => {
  it('puts ink on the seven accents that carry it', () => {
    for (const name of ['pink', 'orange', 'yellow', 'lime', 'green', 'mint', 'sky'] as const) {
      expect(foregroundFor(TOKEN[name]), name).toBe('var(--on-light)');
    }
  });

  it('puts paper on the two accents that need it', () => {
    expect(foregroundFor(TOKEN.blue)).toBe('var(--on-dark)');
    expect(foregroundFor(TOKEN.violet)).toBe('var(--on-dark)');
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
      const fg = foregroundFor(TOKEN[name]) === 'var(--on-light)' ? TOKEN.ink : TOKEN.paper;
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
      const fg = foregroundFor(TOKEN[name]) === 'var(--on-light)' ? TOKEN.ink : TOKEN.paper;
      expect(contrastRatio(fg, TOKEN[name]), name).toBeLessThan(AA);
      // Close enough that a small darkening of the token would clear it.
      expect(contrastRatio(fg, TOKEN[name]), name).toBeGreaterThan(4.1);
    }
  });

  it('returns undefined for a CSS variable, so the stylesheet still decides', () => {
    expect(foregroundFor('var(--on-light)')).toBeUndefined();
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

/*
 * A challenge card prints its brief in ink on the challenge's own hue — the
 * challenge screen's `.blurb` and Home's `.challengeBlurb` — so every hue in the
 * schedule has to carry ink at AA. Blue, red and violet cannot, and until the
 * 2026-09-11 schedule four slots used one of them.
 */
describe('challenge hues', () => {
  it('carry the ink brief at AA on every scheduled challenge', () => {
    for (const challenge of CHALLENGES) {
      expect(
        contrastRatio(TOKEN.ink, challenge.hue),
        `${challenge.id} ${challenge.hue}`,
      ).toBeGreaterThanOrEqual(AA);
    }
  });
});

describe('softFill', () => {
  it('washes a fill down towards paper without moving its hue', () => {
    // The problem it exists for: a feel face painted in the feel's colour on a
    // cell flooded with that same colour (owner, 2026-09-14, in chat).
    const yellow = '#ffc23f';
    const soft = softFill(yellow)!;
    expect(soft).not.toBe(yellow);
    // Still recognisably the yellow one, and much closer to paper than to it.
    expect(contrastRatio(soft, '#fffdf5')!).toBeLessThan(1.3);
    // And the art on top of it now has somewhere to be seen.
    expect(contrastRatio(soft, yellow)!).toBeGreaterThan(1.1);
  });

  it('reads 0 as paper and 1 as the fill itself', () => {
    expect(softFill('#ffc23f', 0)).toBe('#fffdf5');
    expect(softFill('#ffc23f', 1)).toBe('#ffc23f');
    // Out-of-range strengths clamp rather than producing a broken hex.
    expect(softFill('#ffc23f', -5)).toBe('#fffdf5');
    expect(softFill('#ffc23f', 9)).toBe('#ffc23f');
  });

  it('always returns six-digit hex, including from shorthand', () => {
    const soft = softFill('#f30', 0.5)!;
    expect(soft).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('leaves anything that is not hex alone', () => {
    // Same contract as foregroundFor: "not mine to touch", never a throw. It is
    // what makes this safe to drop into a component whose callers pass tokens.
    expect(softFill('var(--green)')).toBeUndefined();
    expect(softFill(undefined)).toBeUndefined();
    expect(softFill('')).toBeUndefined();
  });

  it('keeps ink readable on every softened feel and weather colour', () => {
    // The labels sit on this tint, so it has to clear AA — which a pale wash
    // does comfortably, where two of the full-strength accents never did.
    for (const fill of ['#10a06a', '#9ce05b', '#ffc23f', '#ff5a1f', '#ff3d78', '#3ac0ff']) {
      const soft = softFill(fill)!;
      expect(foregroundFor(soft), fill).toBe('var(--on-light)');
      expect(contrastRatio(soft, '#12100b')!, fill).toBeGreaterThan(4.5);
    }
  });
});
