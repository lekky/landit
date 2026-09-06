import { describe, expect, it } from 'vitest';

import { SPOTS } from '../data/spots';
import {
  RESERVED_SLUGS,
  SLUG_FALLBACK,
  SLUG_MAX_LENGTH,
  slugify,
  spotSlug,
  uniqueSlug,
} from './slug';

/**
 * The shape every slug must have, whatever went in: lowercase ASCII words,
 * single hyphens between them, nothing at either end.
 *
 * Asserted as one regex rather than as five separate expectations because it is
 * one promise — that a URL segment is built from an allowlist — and a caller
 * reading a failure wants to see the string that broke it.
 */
const SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The nastiest things a submission form can be handed. Not a list of attacks
 * that were tried: a list of the *kinds* of character that would change what a
 * URL means, one example each.
 */
const HOSTILE: readonly string[] = [
  '../../admin',
  '..%2f..%2fadmin',
  'Ventnor/../../etc/passwd',
  '<script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
  "Bobby'); DROP TABLE spots;--",
  // A null byte, an RTL override and two zero-width joiners: the characters
  // that make one string look like another in an address bar.
  'spot\u0000null',
  'spot\u202Egnp.xmb',
  'spot\u200Bzero\u200Cwidth',
  // Fullwidth Latin, which NFKD flattens back to ASCII rather than dropping.
  '\uFF30\uFF41\uFF52\uFF4B',
  'https://evil.example.com/',
  '   ',
  '---',
  '///',
  '?a=1&b=2#frag',
  '\\\\server\\share',
  // Nothing in the allowlist at all.
  '\u0441\u043f\u043e\u0442',
  '.',
  '..',
];

describe('slugify', () => {
  it('keeps only lowercase ASCII words joined by single hyphens', () => {
    expect(slugify('Ventnor Skatepark')).toBe('ventnor-skatepark');
    expect(slugify('  The   Bowl!!  ')).toBe('the-bowl');
    expect(slugify('Rampworx (Liverpool)')).toBe('rampworx-liverpool');
  });

  it('folds accents to their ASCII letter rather than dropping the word', () => {
    expect(slugify('Skatepark Málaga')).toBe('skatepark-malaga');
    expect(slugify('Montréal')).toBe('montreal');
    expect(slugify('Zürich Bowl')).toBe('zurich-bowl');
  });

  it('returns nothing when nothing survives the allowlist', () => {
    expect(slugify('спот')).toBe('');
    expect(slugify('！！！')).toBe('');
    expect(slugify('')).toBe('');
  });

  it('caps the length and cuts on a word boundary', () => {
    const long = slugify('Ariake Urban Sports Park Skateboarding And BMX Freestyle Arena Tokyo');
    expect(long.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(long).toMatch(SHAPE);
    // The cut fell on a hyphen, so the last word is whole.
    expect(long.endsWith('-')).toBe(false);
  });

  it('caps a single unbroken word too', () => {
    const long = slugify('a'.repeat(200));
    expect(long).toBe('a'.repeat(SLUG_MAX_LENGTH));
  });
});

describe('spotSlug', () => {
  it('reads as the spot does', () => {
    expect(spotSlug('Ventnor Skatepark', 'Ventnor')).toBe('ventnor-skatepark');
    expect(spotSlug('Esplanade Ledges', 'Ventnor')).toBe('esplanade-ledges-ventnor');
    expect(spotSlug('The Bowl', 'Newport')).toBe('the-bowl-newport');
  });

  it('does not repeat the town when the name already ends with it', () => {
    expect(spotSlug('Skatepark Ventnor', 'Ventnor')).toBe('skatepark-ventnor');
    expect(spotSlug('Ventnor', 'Ventnor')).toBe('ventnor');
  });

  it('separates the many spots called the same thing in different towns', () => {
    expect(spotSlug('Skatepark', 'Ventnor')).not.toBe(spotSlug('Skatepark', 'Newport'));
  });

  it('works with no town at all', () => {
    expect(spotSlug('Rampworx', '')).toBe('rampworx');
    expect(spotSlug('Rampworx', null)).toBe('rampworx');
    expect(spotSlug('Rampworx', undefined)).toBe('rampworx');
  });

  it('never returns an empty, hostile or reserved segment', () => {
    for (const input of HOSTILE) {
      const slug = spotSlug(input, input);
      expect(slug, `input: ${JSON.stringify(input)}`).toMatch(SHAPE);
      expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
      // Nothing that would make the URL mean something else.
      expect(slug).not.toContain('/');
      expect(slug).not.toContain('\\');
      expect(slug).not.toContain('.');
      expect(slug).not.toContain('%');
      expect(slug).not.toContain('?');
      expect(slug).not.toContain('#');
      expect(slug).not.toContain('<');
      expect(slug).not.toContain(' ');
    }
  });

  it('falls back rather than returning nothing when the name is unusable', () => {
    expect(spotSlug('   ', '')).toBe(SLUG_FALLBACK);
    expect(spotSlug('спот', '')).toBe(SLUG_FALLBACK);
    expect(spotSlug('...', '...')).toBe(SLUG_FALLBACK);
  });

  it('steps aside for a segment a route might want', () => {
    for (const reserved of RESERVED_SLUGS) {
      expect(spotSlug(reserved, '')).not.toBe(reserved);
      expect(spotSlug(reserved, '')).toMatch(SHAPE);
    }
  });

  it('cannot be talked into a second path segment', () => {
    expect(spotSlug('../admin', '')).toBe('admin');
    expect(spotSlug('spots/new', '')).toBe('spots-new');
  });

  it('gives every canonical spot a distinct, well-shaped slug', () => {
    const seen = new Set<string>();
    for (const spot of SPOTS) {
      const slug = uniqueSlug(spotSlug(spot.name, spot.town), (candidate) => seen.has(candidate));
      expect(slug, `${spot.name}, ${spot.town}`).toMatch(SHAPE);
      expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
      seen.add(slug);
    }
    expect(seen.size).toBe(SPOTS.length);
  });
});

describe('uniqueSlug', () => {
  it('leaves a free slug alone', () => {
    expect(uniqueSlug('ventnor-skatepark', () => false)).toBe('ventnor-skatepark');
  });

  it('counts up deterministically, so a reseed lands on the same URL', () => {
    const taken = new Set(['skatepark-ventnor', 'skatepark-ventnor-2']);
    expect(uniqueSlug('skatepark-ventnor', (c) => taken.has(c))).toBe('skatepark-ventnor-3');
    expect(uniqueSlug('skatepark-ventnor', (c) => taken.has(c))).toBe('skatepark-ventnor-3');
  });

  it('keeps the suffix when the base is already at full length', () => {
    const base = 'a'.repeat(SLUG_MAX_LENGTH);
    const next = uniqueSlug(base, (c) => c === base);
    expect(next.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(next.endsWith('-2')).toBe(true);
  });

  it('gives up rather than hanging when everything is taken', () => {
    expect(uniqueSlug('x', () => true, 3)).toBe('x-4');
  });
});
