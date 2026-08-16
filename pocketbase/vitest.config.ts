import { defineConfig } from 'vitest/config';

/**
 * These tests drive a real PocketBase over HTTP — the pinned binary, this
 * repo's migrations, this repo's hooks — because plan §3 asks for the four
 * guarantees to be proven "as observed API behaviour, not by reading the rule
 * text". `globalSetup` starts one instance for the whole run on a scratch
 * database and deletes it afterwards.
 */
export default defineConfig({
  test: {
    name: '@landit/pocketbase',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['./tests/global-setup.ts'],
    // First run on a cold machine downloads the pinned binary.
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
