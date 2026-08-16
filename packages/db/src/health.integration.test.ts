import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// @ts-expect-error — a plain .mjs harness, deliberately not part of the build.
import { SUPERUSER_EMAIL, SUPERUSER_PASSWORD, withInstance } from '../scripts/pb-instance.mjs';

import { checkHealth, type HealthReport } from './health';

/**
 * `checkHealth` against a real PocketBase.
 *
 * `health.test.ts` proves the branching with a stubbed `fetch`, which is the
 * fast half and the half that can lie: it asserts that a 400 from a URL
 * containing `auth-with-password` becomes `rejected`, which is a statement about
 * a stub rather than about PocketBase. This is the half that cannot — a real
 * instance, a real superuser, and a real wrong password going through the real
 * SDK. Issue #62 exists because a credential problem was indistinguishable from
 * a transient one; a test that mocks away the credential check would be the same
 * mistake in a different place (LESSONS §5).
 *
 * One instance for all three cases: starting PocketBase is the expensive part
 * and none of these writes anything.
 */

let ok: HealthReport;
let wrongPassword: HealthReport;
let noCredentials: HealthReport;
let instanceDown: HealthReport;

beforeAll(async () => {
  await withInstance(async (url: string) => {
    const original = {
      email: process.env.POCKETBASE_SUPERUSER_EMAIL,
      password: process.env.POCKETBASE_SUPERUSER_PASSWORD,
    };
    const set = (email: string | undefined, password: string | undefined) => {
      if (email === undefined) delete process.env.POCKETBASE_SUPERUSER_EMAIL;
      else process.env.POCKETBASE_SUPERUSER_EMAIL = email;
      if (password === undefined) delete process.env.POCKETBASE_SUPERUSER_PASSWORD;
      else process.env.POCKETBASE_SUPERUSER_PASSWORD = password;
    };

    try {
      set(SUPERUSER_EMAIL, SUPERUSER_PASSWORD);
      ok = await checkHealth({ url });
      // Nothing here is on a live port; the instance the harness started is the
      // only PocketBase in play, so an unused port answers nothing.
      instanceDown = await checkHealth({ url: 'http://127.0.0.1:1' });

      set(SUPERUSER_EMAIL, 'definitely-not-the-harness-password');
      wrongPassword = await checkHealth({ url });

      set(undefined, undefined);
      noCredentials = await checkHealth({ url });
    } finally {
      set(original.email, original.password);
    }
  });
  // Booting PocketBase and four round trips.
}, 120_000);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('checkHealth against a real PocketBase', () => {
  it('is ok when the superuser exists and the password is right', () => {
    expect(ok).toEqual({ ok: true, pocketbase: 'ok', superuser: 'ok' });
  });

  it('says `rejected` when PocketBase itself refuses the password', () => {
    // The case worth having a real instance for: this is PocketBase's own 400
    // from `_superusers/auth-with-password`, not a stub's.
    expect(wrongPassword).toEqual({ ok: false, pocketbase: 'ok', superuser: 'rejected' });
  });

  it('says `missing` — not `rejected` — when nothing is configured', () => {
    expect(noCredentials).toEqual({ ok: false, pocketbase: 'ok', superuser: 'missing' });
  });

  it('says `unreachable` when there is no PocketBase on the other end', () => {
    expect(instanceDown).toEqual({
      ok: false,
      pocketbase: 'unreachable',
      superuser: 'unreachable',
    });
  });
});
