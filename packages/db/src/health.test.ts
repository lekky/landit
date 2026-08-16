import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { checkHealth, superuserCredentialsPresent } from './health';

/**
 * The point of these is the *distinctions*, not the happy path.
 *
 * Issue #62 is a story about three different failures that all looked like one:
 * a rider being told "try again in a moment" whether nobody had set the
 * credentials, somebody had set the wrong ones, or PocketBase was simply down.
 * Each needs a different person to do a different thing, so each has a test
 * here. A version of `checkHealth` that returned `missing` for all three would
 * be no more use than the silent catch it replaces.
 */

const HEALTH = '/api/health';
const AUTH = '/api/collections/_superusers/auth-with-password';

type Outcome = 'ok' | 'refused' | 'down';

/**
 * Stand in for a PocketBase. `health` and `auth` are answered independently, so
 * "the server is up and the password is wrong" is expressible — which is the
 * whole `rejected` case.
 */
function stubPocketBase({ health, auth }: { health: Outcome; auth: Outcome }): void {
  vi.stubGlobal('fetch', (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    const which = url.includes(AUTH) ? auth : url.includes(HEALTH) ? health : 'down';

    if (which === 'down') return Promise.reject(new Error('connection refused'));
    if (which === 'refused') {
      return Promise.resolve(
        new Response(JSON.stringify({ code: 400, message: 'Failed to authenticate.' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }

    const body = url.includes(AUTH)
      ? { token: 'a-token', record: { id: 'su000000000000', email: 'ops@landit.invalid' } }
      : { code: 200, message: 'API is healthy.' };
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });
}

function withCredentials(): void {
  vi.stubEnv('POCKETBASE_SUPERUSER_EMAIL', 'ops@landit.invalid');
  vi.stubEnv('POCKETBASE_SUPERUSER_PASSWORD', 'a-long-local-test-password');
}

beforeEach(() => {
  vi.stubEnv('POCKETBASE_URL', 'http://pocketbase.test');
  vi.stubEnv('NEXT_PUBLIC_POCKETBASE_URL', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('superuserCredentialsPresent', () => {
  it('is true only when both variables have a value', () => {
    withCredentials();
    expect(superuserCredentialsPresent()).toBe(true);
  });

  it('is false when the password is missing', () => {
    vi.stubEnv('POCKETBASE_SUPERUSER_EMAIL', 'ops@landit.invalid');
    vi.stubEnv('POCKETBASE_SUPERUSER_PASSWORD', '');
    expect(superuserCredentialsPresent()).toBe(false);
  });

  it('is false when the email is missing', () => {
    vi.stubEnv('POCKETBASE_SUPERUSER_EMAIL', '');
    vi.stubEnv('POCKETBASE_SUPERUSER_PASSWORD', 'a-long-local-test-password');
    expect(superuserCredentialsPresent()).toBe(false);
  });
});

describe('checkHealth', () => {
  it('is ok when PocketBase answers and the credentials authenticate', async () => {
    withCredentials();
    stubPocketBase({ health: 'ok', auth: 'ok' });

    await expect(checkHealth()).resolves.toEqual({
      ok: true,
      pocketbase: 'ok',
      superuser: 'ok',
    });
  });

  it('says `missing` when the variables are unset, and does not call it a bad password', async () => {
    vi.stubEnv('POCKETBASE_SUPERUSER_EMAIL', '');
    vi.stubEnv('POCKETBASE_SUPERUSER_PASSWORD', '');
    stubPocketBase({ health: 'ok', auth: 'ok' });

    const report = await checkHealth();
    expect(report).toEqual({ ok: false, pocketbase: 'ok', superuser: 'missing' });
  });

  it('says `rejected` when they are set and PocketBase refuses them', async () => {
    withCredentials();
    stubPocketBase({ health: 'ok', auth: 'refused' });

    const report = await checkHealth();
    expect(report).toEqual({ ok: false, pocketbase: 'ok', superuser: 'rejected' });
  });

  it('says `unreachable`, not `rejected`, when PocketBase is down', async () => {
    // The distinction that matters most: a server that is not answering must
    // never send somebody off to reset a password that was fine all along.
    withCredentials();
    stubPocketBase({ health: 'down', auth: 'down' });

    const report = await checkHealth();
    expect(report).toEqual({ ok: false, pocketbase: 'unreachable', superuser: 'unreachable' });
  });

  it('says `unreachable` when PocketBase goes away between the two calls', async () => {
    // The narrow race: the health ping answered, and the authentication that
    // followed got no answer at all. The SDK reports that as status 0, which is
    // not a refusal — and must not be reported as a wrong password.
    withCredentials();
    stubPocketBase({ health: 'ok', auth: 'down' });

    const report = await checkHealth();
    expect(report).toEqual({ ok: false, pocketbase: 'ok', superuser: 'unreachable' });
  });

  it('reports unreachable rather than throwing when no URL is configured', async () => {
    withCredentials();
    vi.stubEnv('POCKETBASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_POCKETBASE_URL', '');
    stubPocketBase({ health: 'ok', auth: 'ok' });

    const report = await checkHealth();
    expect(report).toEqual({ ok: false, pocketbase: 'unreachable', superuser: 'unreachable' });
  });

  it('takes an explicit URL over the environment', async () => {
    withCredentials();
    const seen: string[] = [];
    vi.stubGlobal('fetch', (input: string | URL | Request) => {
      seen.push(String(input instanceof Request ? input.url : input));
      return Promise.resolve(
        new Response(JSON.stringify({ token: 't', record: { id: 'x' }, code: 200 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    });

    await checkHealth({ url: 'http://explicit.test' });
    expect(seen.every((url) => url.startsWith('http://explicit.test'))).toBe(true);
  });
});

describe('the superuser credentials stay out of any browser bundle', () => {
  // The same guard `clients.test.ts` puts on `clients.ts`, for the same reason:
  // a bundler substitutes `process.env.FOO` only where it appears verbatim, so
  // writing one of these literally is how a secret ends up in browser JavaScript.
  const source = readFileSync(fileURLToPath(new URL('./health.ts', import.meta.url)), 'utf8');

  it('never reads the server-only variables literally', () => {
    expect(source).not.toContain('process.env.POCKETBASE_URL');
    expect(source).not.toContain('process.env.POCKETBASE_SUPERUSER_EMAIL');
    expect(source).not.toContain('process.env.POCKETBASE_SUPERUSER_PASSWORD');
  });
});
