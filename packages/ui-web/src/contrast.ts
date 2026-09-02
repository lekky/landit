/**
 * Which foreground to put on a solid fill.
 *
 * The visual language paints text straight onto loud colour — category tags,
 * stat blocks, sport chips, stage strips — and the prototype answered that with
 * `#fff` everywhere. Measured against the palette it is the wrong default: paper
 * clears 4.5:1 on one of the ten accents, while ink clears it on seven.
 *
 *   ink on --orange  6.10:1     paper on --orange  3.06:1
 *   ink on --green   5.67:1     paper on --green   3.29:1
 *   ink on --violet  3.42:1     paper on --violet  5.45:1
 *
 * So the answer is per-colour, not per-product, and it is arithmetic rather than
 * taste — which is why it lives in a function instead of in a review checklist.
 * `foregroundFor` returns whichever of ink and paper contrasts better with the
 * fill it is given.
 *
 * Two accents clear nothing. `--blue` is 4.18:1 on ink and 4.46:1 on paper and
 * `--red` is 4.34:1 and 4.31:1, so both miss AA whichever way they are painted.
 * This function still answers for them — the better of two failing options —
 * and `contrast.test.ts` asserts that the answer is below AA, so a green suite
 * never reads as a pass. Closing either means darkening a brand colour, which
 * is the owner's call.
 *
 * The measurement is against `--paper` (#fffdf5), not pure white. On blue that
 * is 4.46 against 4.54 — the difference between failing and passing — so what
 * the product actually paints is what gets measured.
 *
 * It only understands hex, deliberately. Callers that pass `var(--ink)` cannot
 * be resolved here without reading computed style, and they get `undefined` so
 * the stylesheet's own default still applies — adding this to a component can
 * therefore never change what such a call site already renders.
 */

/** The two foregrounds the design language allows on a colour fill. */
const INK = '#12100b';
const PAPER = '#fffdf5';

/** sRGB channel → linear light, per WCAG 2.x relative luminance. */
function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * `#rgb` or `#rrggbb` → `[r, g, b]`, or null for anything else.
 *
 * Anything else includes `var(--x)`, `rgb()`, colour keywords and the empty
 * string. Returning null rather than throwing is the point: an unparseable fill
 * means "leave this one alone", not "the caller made a mistake".
 */
function parseHex(color: string): [number, number, number] | null {
  const hex = color.trim().replace(/^#/, '');
  if (hex.length === 3) {
    const [r, g, b] = [...hex].map((d) => parseInt(d + d, 16));
    return [r, g, b].some(Number.isNaN) ? null : [r!, g!, b!];
  }
  if (hex.length === 6) {
    const parts: number[] = [];
    for (let i = 0; i < 6; i += 2) parts.push(parseInt(hex.slice(i, i + 2), 16));
    return parts.some(Number.isNaN) ? null : [parts[0]!, parts[1]!, parts[2]!];
  }
  return null;
}

/** WCAG 2.x relative luminance of a parsed sRGB triple. */
function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.x contrast ratio between two relative luminances. */
function ratio(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The better of ink and paper on `fill`, or `undefined` when `fill` is not hex.
 *
 * Undefined means "the stylesheet decides", which is what keeps this safe to
 * drop into an existing component.
 */
export function foregroundFor(fill: string | undefined): string | undefined {
  if (!fill) return undefined;
  const rgb = parseHex(fill);
  if (!rgb) return undefined;
  const l = luminance(rgb);
  return ratio(l, luminance(parseHex(INK)!)) >= ratio(l, luminance(parseHex(PAPER)!))
    ? 'var(--ink)'
    : 'var(--paper)';
}

/**
 * The contrast ratio between two hex colours, or null if either is unparseable.
 *
 * Exported for the tests that assert the palette's pairings, so the numbers in
 * the comment above are checked rather than trusted.
 */
export function contrastRatio(a: string, b: string): number | null {
  const x = parseHex(a);
  const y = parseHex(b);
  if (!x || !y) return null;
  return ratio(luminance(x), luminance(y));
}
