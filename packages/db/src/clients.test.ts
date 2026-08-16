import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { MissingPocketBaseUrl, createBrowserClient, createServerClient } from './clients';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createBrowserClient', () => {
  it('prefers an explicitly passed URL', () => {
    vi.stubEnv('NEXT_PUBLIC_POCKETBASE_URL', 'https://env.example');
    expect(createBrowserClient({ url: 'https://explicit.example' }).baseURL).toBe(
      'https://explicit.example',
    );
  });

  it('falls back to NEXT_PUBLIC_POCKETBASE_URL', () => {
    vi.stubEnv('NEXT_PUBLIC_POCKETBASE_URL', 'https://api.example');
    expect(createBrowserClient().baseURL).toBe('https://api.example');
  });

  it('ignores the server-only POCKETBASE_URL', () => {
    // The browser is never told the internal address; being handed one here
    // would mean a screen quietly talking to somewhere it cannot reach.
    vi.stubEnv('POCKETBASE_URL', 'http://pocketbase:8090');
    vi.stubEnv('NEXT_PUBLIC_POCKETBASE_URL', '');
    expect(() => createBrowserClient()).toThrow(MissingPocketBaseUrl);
  });

  it('names the public variable when there is no URL at all', () => {
    vi.stubEnv('NEXT_PUBLIC_POCKETBASE_URL', '');
    expect(() => createBrowserClient()).toThrow(/NEXT_PUBLIC_POCKETBASE_URL/);
  });
});

describe('createServerClient', () => {
  it('prefers POCKETBASE_URL over the public variable', () => {
    vi.stubEnv('POCKETBASE_URL', 'http://pocketbase:8090');
    vi.stubEnv('NEXT_PUBLIC_POCKETBASE_URL', 'https://api.example');
    expect(createServerClient().baseURL).toBe('http://pocketbase:8090');
  });

  it('falls back to the public variable', () => {
    vi.stubEnv('POCKETBASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_POCKETBASE_URL', 'https://api.example');
    expect(createServerClient().baseURL).toBe('https://api.example');
  });
});

describe('the browser URL is readable by a bundler', () => {
  // The regression this guards is invisible to every runtime test above: under
  // Node both a literal and a dynamic read work, and the browser is the only
  // place they differ. Next substitutes `process.env.NEXT_PUBLIC_*` only where
  // it appears verbatim, so the source text itself is the thing to assert on.
  const source = readFileSync(fileURLToPath(new URL('./clients.ts', import.meta.url)), 'utf8');

  it('reads NEXT_PUBLIC_POCKETBASE_URL literally somewhere in clients.ts', () => {
    expect(source).toContain('process.env.NEXT_PUBLIC_POCKETBASE_URL');
  });

  it('never reads the server-only variables literally', () => {
    // Inlining any of these would ship them in the browser bundle.
    expect(source).not.toContain('process.env.POCKETBASE_URL');
    expect(source).not.toContain('process.env.POCKETBASE_SUPERUSER_EMAIL');
    expect(source).not.toContain('process.env.POCKETBASE_SUPERUSER_PASSWORD');
  });
});
