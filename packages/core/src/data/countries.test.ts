import { describe, expect, it } from 'vitest';

import { EEA_COUNTRIES, UNDER_13_DECLINED_COUNTRIES } from '../rules/consent';

import {
  COUNTRIES,
  COUNTRY_CODES,
  COUNTRY_SUGGESTIONS,
  DEFAULT_COUNTRY,
  countryName,
  countryOptions,
} from './countries';

describe('the country list', () => {
  it('covers ISO-3166-1 alpha-2, because anyone can sign up (plan §6.3)', () => {
    expect(COUNTRY_CODES.length).toBeGreaterThan(240);
    expect(COUNTRY_CODES).toContain('GB');
    expect(COUNTRY_CODES).toContain('US');
    expect(COUNTRY_CODES).toContain('JP');
  });

  it('offers a name for every code, and a code for every name', () => {
    // A code the picker offers but cannot name would render as a bare "XK",
    // which reads as a bug to the rider and to nobody else.
    for (const code of COUNTRY_CODES) {
      expect(COUNTRIES[code], code).toBeTruthy();
      expect(code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('names every country the consent rules mention', () => {
    for (const code of [...EEA_COUNTRIES, ...UNDER_13_DECLINED_COUNTRIES, DEFAULT_COUNTRY]) {
      expect(COUNTRY_CODES, code).toContain(code);
    }
  });

  it('starts on the UK and suggests countries it also lists', () => {
    expect(DEFAULT_COUNTRY).toBe('GB');
    for (const code of COUNTRY_SUGGESTIONS) expect(COUNTRY_CODES).toContain(code);
  });

  it('falls back to the code rather than showing nothing', () => {
    expect(countryName('GB')).toBe('United Kingdom');
    expect(countryName('gb-sct')).toBe('United Kingdom');
    expect(countryName('ZZ')).toBe('ZZ');
    expect(countryName('')).toBe('');
  });

  it('sorts a picker by name without a locale-dependent collation', () => {
    // `localeCompare` can order differently on the server and in the browser,
    // and a list that reorders during hydration takes the form with it — the
    // same reason the names are a table (see `countries.ts`).
    const options = countryOptions(['US', 'AU', 'GB']);
    expect(options.map((o) => o.code)).toEqual(['AU', 'GB', 'US']);
  });
});
