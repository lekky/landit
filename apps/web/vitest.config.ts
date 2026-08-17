import { defineConfig } from 'vitest/config';

/**
 * `apps/web`'s unit tests — deliberately a very short list.
 *
 * The root config used to say this package was "deliberately absent: screens
 * are covered by Playwright, not by unit tests", and that still holds for
 * screens. T15 added the one thing Playwright cannot reach: the Stripe webhook
 * signature check. Proving it needs a payload signed the way Stripe signs one
 * and a second, tampered payload that must be refused — an assertion about a
 * digest, made without a browser and without a Stripe account.
 *
 * `include` is narrow on purpose. This is not an invitation to unit-test
 * components; a screen tested here is a screen tested twice, and the copy
 * decisions that matter are asserted against the rendered page in `e2e/`
 * (LESSONS §3a).
 */
export default defineConfig({
  test: {
    name: '@landit/web',
    include: ['src/lib/**/*.test.ts'],
    environment: 'node',
  },
});
