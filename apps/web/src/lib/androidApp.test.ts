import { describe, expect, it } from 'vitest';

import { assetLinkStatements, parseFingerprints } from './androidApp';

/** A real-shaped SHA-256 fingerprint: 32 uppercase hex pairs. */
const A = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, '0').toUpperCase()).join(
  ':',
);
const B = Array.from({ length: 32 }, () => 'AB').join(':');

describe('parseFingerprints', () => {
  it('takes one', () => {
    expect(parseFingerprints(A)).toEqual([A]);
  });

  it('takes both signing keys, however they were separated', () => {
    // Play App Signing means two certificates, and the value gets typed into a
    // shell and into a Coolify box, which disagree about separators.
    expect(parseFingerprints(`${A},${B}`)).toEqual([A, B]);
    expect(parseFingerprints(`${A} ${B}`)).toEqual([A, B]);
    expect(parseFingerprints(`${A}, ${B}`)).toEqual([A, B]);
  });

  it('upper-cases, because keytool and Play Console print different cases of the same key', () => {
    expect(parseFingerprints(A.toLowerCase())).toEqual([A]);
  });

  it('drops anything that is not a whole fingerprint', () => {
    // A truncated fingerprint is the silent failure: it serves, it verifies
    // against nothing, and the app opens with a URL bar.
    expect(parseFingerprints(A.slice(0, 60))).toEqual([]);
    expect(parseFingerprints('nonsense')).toEqual([]);
    expect(parseFingerprints(`${A}:AB`)).toEqual([]);
    expect(parseFingerprints(A.replace(':', ''))).toEqual([]);
  });

  it('is empty when unset', () => {
    expect(parseFingerprints(undefined)).toEqual([]);
    expect(parseFingerprints('')).toEqual([]);
  });
});

describe('assetLinkStatements', () => {
  it('serves nothing until both halves are configured', () => {
    // Every checkout and all of CI is in this state, and so is production
    // until there is a signing key. Serving nothing is the point: a wrong
    // statement file fails as silently as a right one succeeds.
    expect(assetLinkStatements({ packageName: undefined, fingerprints: undefined })).toBeNull();
    expect(
      assetLinkStatements({ packageName: 'com.landthetrick.app', fingerprints: '' }),
    ).toBeNull();
    expect(assetLinkStatements({ packageName: undefined, fingerprints: A })).toBeNull();
  });

  it('refuses a package name Android would not accept', () => {
    expect(assetLinkStatements({ packageName: 'landthetrick', fingerprints: A })).toBeNull();
    expect(assetLinkStatements({ packageName: '9lives.app', fingerprints: A })).toBeNull();
    expect(assetLinkStatements({ packageName: 'com..app', fingerprints: A })).toBeNull();
  });

  it('refuses when every fingerprint was malformed, rather than serving an empty list', () => {
    expect(
      assetLinkStatements({ packageName: 'com.landthetrick.app', fingerprints: 'oops' }),
    ).toBeNull();
  });

  it('builds the statement Android checks on launch', () => {
    expect(
      assetLinkStatements({ packageName: ' com.landthetrick.app ', fingerprints: `${A},${B}` }),
    ).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.landthetrick.app',
          sha256_cert_fingerprints: [A, B],
        },
      },
    ]);
  });

  it('asks for URL handling and nothing else', () => {
    const statements = assetLinkStatements({
      packageName: 'com.landthetrick.app',
      fingerprints: A,
    });
    // `common.get_login_creds` would share saved passwords with the app. There
    // is nothing native to share them with, and this is a children's product.
    expect(statements?.[0]?.relation).toEqual(['delegate_permission/common.handle_all_urls']);
  });
});
