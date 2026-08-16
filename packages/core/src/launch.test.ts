import { describe, expect, it } from 'vitest';

import { isPreviewUnlocked, isSiteLive } from './launch';

/**
 * The gate's whole job is to be shut when nobody said otherwise, so most of
 * these tests are about the answer to a question nobody asked: an absent flag,
 * an empty one, a misspelt one.
 */

describe('isSiteLive', () => {
  it('is live when the flag says so, in any environment', () => {
    for (const siteLive of ['true', 'TRUE', ' True ', '1', 'yes', 'on']) {
      expect(isSiteLive({ siteLive, isProduction: true })).toBe(true);
      expect(isSiteLive({ siteLive, isProduction: false })).toBe(true);
    }
  });

  it('is not live when the flag says so, in any environment', () => {
    // The development half matters as much as the production half: it is how
    // anybody works on the holding page itself.
    for (const siteLive of ['false', 'FALSE', ' false ', '0', 'no', 'off']) {
      expect(isSiteLive({ siteLive, isProduction: true })).toBe(false);
      expect(isSiteLive({ siteLive, isProduction: false })).toBe(false);
    }
  });

  describe('when the flag is unset', () => {
    it('is NOT live in production — a deploy that forgets the flag stays shut', () => {
      expect(isSiteLive({ siteLive: undefined, isProduction: true })).toBe(false);
      expect(isSiteLive({ siteLive: '', isProduction: true })).toBe(false);
      expect(isSiteLive({ siteLive: '   ', isProduction: true })).toBe(false);
    });

    it('is live everywhere else — dev and the e2e suite need no flag', () => {
      expect(isSiteLive({ siteLive: undefined, isProduction: false })).toBe(true);
      expect(isSiteLive({ siteLive: '', isProduction: false })).toBe(true);
    });
  });

  it('fails shut on a value it cannot parse, even in development', () => {
    for (const siteLive of ['ture', 'live', 'maybe', 'y', '2', 'null']) {
      expect(isSiteLive({ siteLive, isProduction: true })).toBe(false);
      expect(isSiteLive({ siteLive, isProduction: false })).toBe(false);
    }
  });
});

describe('isPreviewUnlocked', () => {
  it('unlocks only on an exact match', () => {
    expect(isPreviewUnlocked('s3cret', 's3cret')).toBe(true);
    expect(isPreviewUnlocked('s3cre', 's3cret')).toBe(false);
    expect(isPreviewUnlocked('s3crett', 's3cret')).toBe(false);
    expect(isPreviewUnlocked('S3CRET', 's3cret')).toBe(false);
    expect(isPreviewUnlocked(' s3cret', 's3cret')).toBe(false);
  });

  it('stays shut when no key is configured, rather than letting everyone through', () => {
    // The failure mode this rules out: a missing environment variable quietly
    // becoming "no key required".
    expect(isPreviewUnlocked('anything', undefined)).toBe(false);
    expect(isPreviewUnlocked('anything', '')).toBe(false);
    expect(isPreviewUnlocked('anything', null)).toBe(false);
    expect(isPreviewUnlocked(undefined, undefined)).toBe(false);
    expect(isPreviewUnlocked('', '')).toBe(false);
  });

  it('stays shut when the request carries nothing', () => {
    expect(isPreviewUnlocked(undefined, 's3cret')).toBe(false);
    expect(isPreviewUnlocked(null, 's3cret')).toBe(false);
    expect(isPreviewUnlocked('', 's3cret')).toBe(false);
  });
});
